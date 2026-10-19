import express from 'express';
import mongoose from 'mongoose';
import { Part, PART_CODE_PATTERN, PART_CATEGORIES, matchCategory } from '../models/Part.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

const fail = (res, code, error) => res.status(code).json({ success: false, error });
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const duplicateCode = (err) => err?.code === 11000;
const MAX_IMPORT_ROWS = 2000;

// Validate the editable fields. With `partial` only the fields that were sent are checked.
const parseFields = (body, { partial }) => {
  const out = {};

  if (!partial || body.code !== undefined) {
    const code = String(body.code ?? '').trim().toUpperCase();
    if (!PART_CODE_PATTERN.test(code)) {
      return { error: 'Item code must be 1-30 characters: letters, numbers, dot, dash or underscore (e.g. FUSE-400A)' };
    }
    out.code = code;
  }
  if (!partial || body.name !== undefined) {
    const name = String(body.name ?? '').trim();
    if (!name || name.length > 120) return { error: 'Item name is required (maximum 120 characters)' };
    out.name = name;
  }
  if (!partial || body.unitPrice !== undefined) {
    const price = Number(body.unitPrice);
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000) {
      return { error: 'Unit price must be a number between 0 and 1,000,000' };
    }
    out.unitPrice = Math.round(price * 100) / 100;
  }
  if (!partial || body.category !== undefined) {
    const category = matchCategory(body.category) || (body.category === undefined || body.category === '' ? 'General' : null);
    if (!category) return { error: `Category must be one of: ${PART_CATEGORIES.join(', ')}` };
    out.category = category;
  }
  if (partial && body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') return { error: 'isActive must be true or false' };
    out.isActive = body.isActive;
  }
  return { value: out };
};

/*
 * GET /api/parts - search, filter, sort and page through the catalog (done in the database so it
 * stays fast with thousands of items).
 *   q         text matched against item code and name
 *   category  one of the categories (omit for all)
 *   status    admin only: "active" | "hidden" (omit for all). Engineers only ever see active items.
 *   sort      code | name | category | unitPrice | status        dir: asc | desc
 *   page, limit (default 20, max 100)
 */
const SORT_FIELDS = { code: 'code', name: 'name', category: 'category', unitPrice: 'unitPrice', status: 'isActive' };

router.get('/', requireRole('admin', 'engineer'), async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const filter = {};

    if (!isAdmin) filter.isActive = true;
    else if (req.query.status === 'active') filter.isActive = true;
    else if (req.query.status === 'hidden') filter.isActive = false;

    const q = String(req.query.q || '').trim().slice(0, 100);
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ code: rx }, { name: rx }];
    }

    if (req.query.category) {
      const category = matchCategory(req.query.category);
      if (!category) return fail(res, 400, `Category must be one of: ${PART_CATEGORIES.join(', ')}`);
      filter.category = category;
    }

    const sortField = SORT_FIELDS[req.query.sort] || 'code';
    const dir = req.query.dir === 'desc' ? -1 : 1;
    const sort = sortField === 'code' ? { code: dir } : { [sortField]: dir, code: 1 };

    const limit = clamp(parseInt(req.query.limit, 10) || 20, 1, 100);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    const [total, parts] = await Promise.all([
      Part.countDocuments(filter),
      Part.find(filter).collation({ locale: 'en', strength: 2 }).sort(sort).skip((page - 1) * limit).limit(limit)
    ]);

    res.json({ success: true, parts, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    console.error('List parts error:', err);
    fail(res, 500, 'Server error');
  }
});

/*
 * POST /api/parts/import - admin adds / updates many items at once (from a CSV file).
 * Body: { items: [{ row?, code, name, unitPrice, category? }], dryRun?: boolean }
 *  - A code that already exists is UPDATED (name / price / category); a new code is CREATED.
 *  - Rows that fail validation are skipped and reported; valid rows are still imported.
 *  - dryRun: true only reports what would happen, writing nothing (used for the preview step).
 */
router.post('/import', requireRole('admin'), async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : null;
    if (!items || items.length === 0) return fail(res, 400, 'There are no rows to import');
    if (items.length > MAX_IMPORT_ROWS) {
      return fail(res, 400, `Too many rows (maximum ${MAX_IMPORT_ROWS} per import). Please split the file.`);
    }
    const dryRun = req.body.dryRun === true;

    const errors = [];
    const valid = [];
    const seen = new Set();

    items.forEach((raw, i) => {
      const row = Number.isInteger(raw?.row) ? raw.row : i + 2;
      const code = String(raw?.code ?? '').trim().toUpperCase();
      const name = String(raw?.name ?? '').trim();
      const priceText = String(raw?.unitPrice ?? '').trim();
      const price = Number(priceText.replace(/[$,\s]/g, ''));
      const catText = String(raw?.category ?? '').trim();

      let error = null;
      let category = '';
      if (!PART_CODE_PATTERN.test(code)) error = 'Invalid item code (letters, numbers, . - _ only, max 30)';
      else if (seen.has(code)) error = 'Duplicate code in this file';
      else if (!name || name.length > 120) error = 'Item name is required (maximum 120 characters)';
      else if (!priceText || !Number.isFinite(price) || price < 0 || price > 1_000_000) error = 'Invalid unit price';
      else if (catText) {
        category = matchCategory(catText);
        if (!category) error = `Unknown category "${catText}" (use: ${PART_CATEGORIES.join(', ')})`;
      }

      if (error) {
        errors.push({ row, code, error });
        return;
      }
      seen.add(code);
      valid.push({ code, name, unitPrice: Math.round(price * 100) / 100, category });
    });

    // Work out what would be created / updated / left alone.
    const existing = await Part.find({ code: { $in: valid.map((v) => v.code) } });
    const existingByCode = new Map(existing.map((p) => [p.code, p]));
    const ops = [];
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const v of valid) {
      const old = existingByCode.get(v.code);
      if (!old) {
        created++;
        ops.push({
          updateOne: {
            filter: { code: v.code },
            update: { $set: { name: v.name, unitPrice: v.unitPrice }, $setOnInsert: { isActive: true, category: v.category || 'General' } },
            upsert: true
          }
        });
      } else if (old.name !== v.name || old.unitPrice !== v.unitPrice || (v.category && old.category !== v.category)) {
        updated++;
        const set = { name: v.name, unitPrice: v.unitPrice };
        if (v.category) set.category = v.category;
        ops.push({ updateOne: { filter: { code: v.code }, update: { $set: set } } });
      } else {
        unchanged++;
      }
    }

    if (!dryRun && ops.length > 0) await Part.bulkWrite(ops, { ordered: false });

    res.json({
      success: true,
      dryRun,
      totalRows: items.length,
      created,
      updated,
      unchanged,
      skipped: errors.length,
      errors: errors.slice(0, 50)
    });
  } catch (err) {
    console.error('Import parts error:', err);
    fail(res, 500, 'Server error');
  }
});

// POST /api/parts - admin adds an item
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const parsed = parseFields(req.body, { partial: false });
    if (parsed.error) return fail(res, 400, parsed.error);

    const part = await Part.create(parsed.value);
    res.status(201).json({ success: true, part });
  } catch (err) {
    if (duplicateCode(err)) return fail(res, 409, 'Another item already uses that code');
    console.error('Create part error:', err);
    fail(res, 500, 'Server error');
  }
});

// PATCH /api/parts/:id - admin edits an item. Past reports keep the price they were logged at.
router.patch('/:id', requireRole('admin'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, 'Item not found');

    const parsed = parseFields(req.body, { partial: true });
    if (parsed.error) return fail(res, 400, parsed.error);
    if (Object.keys(parsed.value).length === 0) return fail(res, 400, 'Nothing to update');

    const part = await Part.findByIdAndUpdate(req.params.id, parsed.value, { new: true, runValidators: true });
    if (!part) return fail(res, 404, 'Item not found');
    res.json({ success: true, part });
  } catch (err) {
    if (duplicateCode(err)) return fail(res, 409, 'Another item already uses that code');
    console.error('Update part error:', err);
    fail(res, 500, 'Server error');
  }
});

// DELETE /api/parts/:id - admin removes an item (work already logged is unaffected: lines are snapshots)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, 'Item not found');
    const part = await Part.findByIdAndDelete(req.params.id);
    if (!part) return fail(res, 404, 'Item not found');
    res.json({ success: true, message: `${part.code} deleted` });
  } catch (err) {
    fail(res, 500, 'Server error');
  }
});

export default router;
