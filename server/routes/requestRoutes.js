import express from 'express';
import { Request, TAX_RATE } from '../models/Request.js';
import { Engineer } from '../models/Engineer.js';
import { Account } from '../models/Account.js';
import { Part } from '../models/Part.js';
import { nextSeq } from '../models/Counter.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

/*
 * Ticket life-cycle (the only order things may happen in):
 *
 *   Pending --assign--> Assigned --> En Route --> In Progress --report(completed)--> Completed
 *   Completed --send invoice--> Billed --mark paid--> Paid
 *
 * Once an invoice has been sent the ticket is LOCKED: the work log, parts, hours and engineer
 * can no longer change, so an invoice that was sent or paid never changes afterwards.
 */
const CATEGORIES = ['Electrical', 'HVAC', 'Automation', 'Mechanical', 'Software'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Emergency'];
const NEXT_STATUS = { Assigned: 'En Route', 'En Route': 'In Progress' }; // steps done via /status
const REASSIGNABLE = ['Pending', 'Assigned', 'En Route', 'In Progress'];
const REPORTABLE = ['Assigned', 'En Route', 'In Progress', 'Completed'];

const now = () => new Date().toLocaleString('en-US');
const fail = (res, code, error) => res.status(code).json({ success: false, error });
const isInvoiced = (r) => r.billing.billingStatus !== 'Unbilled' || ['Billed', 'Paid'].includes(r.status);
const LOCKED = 'This job has already been invoiced, so it can no longer be changed.';

const actor = (req) => ({
  name: req.user.name,
  role: req.user.role === 'engineer' ? 'Staff Engineer' : req.user.role === 'admin' ? 'Admin' : 'Customer'
});

const recalcBilling = (request) => {
  const b = request.billing;
  const laborTotal = (b.totalHours || 0) * (b.hourlyRate || 0);
  const partsTotal = (request.fieldReport.partsUsed || []).reduce((s, p) => s + p.qty * p.unitPrice, 0);
  const subtotal = (b.baseCalloutFee || 0) + laborTotal + partsTotal;
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  b.laborTotal = laborTotal;
  b.partsTotal = partsTotal;
  b.subtotal = subtotal;
  b.tax = tax;
  b.grandTotal = Math.round((subtotal + tax) * 100) / 100;
};

/*
 * Turn the engineer's submitted parts into stored report lines. The engineer only chooses an item
 * (by catalog code) and a quantity - name and unit price always come from the catalog, never from
 * the browser, so prices can't be typed in or tampered with.
 *   - A line already in this report keeps the name/price it was saved with (price at time of use),
 *     even if the catalog price changed or the item was deactivated since.
 *   - Older free-text lines (no code) can stay and have their quantity changed, but new ones can't be typed in.
 */
const resolveParts = async (rawParts, existing) => {
  if (rawParts.length > 50) return { error: 'Too many parts (maximum 50)' };

  const seen = new Set();
  const lines = [];
  for (const raw of rawParts) {
    const qty = Number(raw?.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000) {
      return { error: 'Quantity must be a whole number from 1 to 1000' };
    }

    const code = String(raw?.code || '').trim().toUpperCase();
    if (code) {
      if (seen.has(code)) return { error: `Item ${code} is listed twice - change its quantity instead` };
      seen.add(code);

      const saved = existing.find((p) => p.code === code);
      if (saved) {
        lines.push({ code, description: saved.description, qty, unitPrice: saved.unitPrice });
        continue;
      }
      const part = await Part.findOne({ code });
      if (!part || !part.isActive) return { error: `Item ${code} is not in the parts catalog` };
      lines.push({ code, description: part.name, qty, unitPrice: part.unitPrice });
    } else {
      const description = String(raw?.description || '').trim();
      const saved = existing.find((p) => !p.code && p.description === description);
      if (!saved) return { error: 'Choose each part from the parts catalog by item name or code' };
      const key = `legacy|${description}`;
      if (seen.has(key)) return { error: `"${description}" is listed twice - change its quantity instead` };
      seen.add(key);
      lines.push({ code: '', description: saved.description, qty, unitPrice: saved.unitPrice });
    }
  }
  return { lines };
};

// Validate the engineer's field-report payload. Returns { error } or { value }.
const parseReport = async (body, existingParts) => {
  const hours = Number(body.hoursSpent);
  if (!Number.isFinite(hours) || hours < 0 || hours > 48) {
    return { error: 'Hours spent must be a number between 0 and 48' };
  }
  const diagnosis = String(body.diagnosis || '').trim();
  const rawParts = Array.isArray(body.partsUsed) ? body.partsUsed : [];

  const resolved = await resolveParts(rawParts, existingParts);
  if (resolved.error) return { error: resolved.error };
  const partsUsed = resolved.lines;

  const isCompleted = body.isCompleted === true;
  if (isCompleted && (hours <= 0 || !diagnosis)) {
    return { error: 'To complete a job you must log the hours spent and a diagnosis' };
  }
  return { value: { hours, diagnosis, partsUsed, isCompleted } };
};

// GET /api/requests - scoped to the caller's role
router.get('/', async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'customer') filter = { email: req.user.email };
    else if (req.user.role === 'engineer') filter = { assignedEngineerId: req.user.engineerId };

    const requests = await Request.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, requests });
  } catch (err) {
    fail(res, 500, 'Server error');
  }
});

// POST /api/requests - customer (or admin on a customer's behalf) submits a service request
router.post('/', requireRole('customer', 'admin'), async (req, res) => {
  try {
    const { title, category, priority, contactPerson, phone, location, description } = req.body;
    if (!String(title || '').trim() || !String(description || '').trim()) {
      return fail(res, 400, 'Title and description are required');
    }
    if (category && !CATEGORIES.includes(category)) return fail(res, 400, 'Invalid category');
    if (priority && !PRIORITIES.includes(priority)) return fail(res, 400, 'Invalid priority');

    // Who owns the ticket comes from the login, never from the request body.
    // (Otherwise a customer could file tickets under another customer's email.)
    let ownerEmail;
    let ownerCompany;
    if (req.user.role === 'customer') {
      ownerEmail = req.user.email;
      ownerCompany = req.user.customerName;
    } else {
      const acct = await Account.findOne({ email: String(req.body.email || '').trim().toLowerCase(), role: 'customer' });
      if (!acct) return fail(res, 400, 'Choose an existing customer account for this ticket');
      ownerEmail = acct.email;
      ownerCompany = acct.customerName;
    }

    const seq = await nextSeq('request');
    const newId = `REQ-2026-${String(seq).padStart(3, '0')}`;
    const timestamp = now();
    const contact = String(contactPerson || '').trim() || req.user.name;

    const newReq = new Request({
      id: newId,
      title: String(title).trim().slice(0, 200),
      category: category || 'Electrical',
      priority: priority || 'High',
      customerName: ownerCompany || 'Unknown Customer',
      contactPerson: contact,
      phone: String(phone || '').trim() || '+1 (555) 000-0000',
      email: ownerEmail,
      location: String(location || '').trim() || 'Main Facility',
      description: String(description).trim().slice(0, 5000),
      dateSubmitted: timestamp,
      status: 'Pending',
      assignedEngineerId: '',
      assignedEngineerName: 'Unassigned',
      workLog: [{
        timestamp,
        author: contact,
        role: 'Customer',
        text: `Service request submitted. Category [${category || 'Electrical'}].`
      }],
      fieldReport: { hoursSpent: 0, diagnosis: '', partsUsed: [], completedAt: null },
      billing: {
        baseCalloutFee: 150,
        hourlyRate: 100,
        totalHours: 0,
        laborTotal: 0,
        partsTotal: 0,
        subtotal: 0,
        tax: 0,
        grandTotal: 0,
        billingStatus: 'Unbilled',
        invoiceNumber: `INV-2026-${String(seq).padStart(4, '0')}`,
        invoiceDate: null
      }
    });

    await newReq.save();
    res.status(201).json({ success: true, request: newReq });
  } catch (err) {
    console.error('Create request error:', err);
    fail(res, 500, 'Server error');
  }
});

// PATCH /api/requests/:id/assign - admin assigns (or reassigns) a staff engineer
router.patch('/:id/assign', requireRole('admin'), async (req, res) => {
  try {
    const request = await Request.findOne({ id: req.params.id });
    const engineer = await Engineer.findOne({ id: req.body.engineerId });
    if (!request || !engineer) return fail(res, 404, 'Request or Engineer not found');

    if (isInvoiced(request)) return fail(res, 409, LOCKED);
    if (!REASSIGNABLE.includes(request.status)) {
      return fail(res, 409, `A ${request.status} job can no longer be reassigned.`);
    }
    if (engineer.isActive === false) return fail(res, 400, 'Cannot assign an inactive engineer');
    if (request.assignedEngineerId === engineer.id) return fail(res, 400, `Already assigned to ${engineer.name}`);

    const previous = request.assignedEngineerName;
    const wasStarted = request.status === 'En Route' || request.status === 'In Progress';

    request.assignedEngineerId = engineer.id;
    request.assignedEngineerName = engineer.name;
    // A new engineer starts the job from the beginning of the field flow.
    if (request.status === 'Pending' || wasStarted) request.status = 'Assigned';
    request.billing.hourlyRate = engineer.hourlyRate;
    recalcBilling(request);

    request.workLog.push({
      timestamp: now(),
      author: req.user.name,
      role: 'Admin',
      text: previous && previous !== 'Unassigned'
        ? `Reassigned from ${previous} to ${engineer.name} (${engineer.specialty}).`
        : `Assigned Staff Engineer ${engineer.name} (${engineer.specialty}) to this dispatch.`
    });

    await request.save();
    res.json({ success: true, request });
  } catch (err) {
    fail(res, 500, 'Server error');
  }
});

// PATCH /api/requests/:id/status - engineer (or admin) advances the job one step in the field flow
router.patch('/:id/status', requireRole('engineer', 'admin'), async (req, res) => {
  try {
    const { status, remark } = req.body;
    const request = await Request.findOne({ id: req.params.id });
    if (!request) return fail(res, 404, 'Request not found');

    if (req.user.role === 'engineer' && request.assignedEngineerId !== req.user.engineerId) {
      return fail(res, 403, 'This dispatch is not assigned to you');
    }
    if (isInvoiced(request)) return fail(res, 409, LOCKED);

    const allowedNext = NEXT_STATUS[request.status];
    if (!allowedNext) {
      return fail(res, 409, `A ${request.status} job has no further field steps. Completing a job is done by logging the work report.`);
    }
    if (status !== allowedNext) {
      return fail(res, 400, `A ${request.status} job can only move to "${allowedNext}".`);
    }

    request.status = status;
    const { name, role } = actor(req);
    request.workLog.push({
      timestamp: now(),
      author: name,
      role,
      text: `Status updated to [${status}].` + (remark ? ` Remark: "${String(remark).slice(0, 500)}"` : '')
    });

    await request.save();
    res.json({ success: true, request });
  } catch (err) {
    fail(res, 500, 'Server error');
  }
});

// PATCH /api/requests/:id/report - engineer saves the field report & parts (and may complete the job)
router.patch('/:id/report', requireRole('engineer', 'admin'), async (req, res) => {
  try {
    const request = await Request.findOne({ id: req.params.id });
    if (!request) return fail(res, 404, 'Request not found');

    if (req.user.role === 'engineer' && request.assignedEngineerId !== req.user.engineerId) {
      return fail(res, 403, 'This dispatch is not assigned to you');
    }
    if (isInvoiced(request)) return fail(res, 409, LOCKED);
    if (!REPORTABLE.includes(request.status)) {
      return fail(res, 409, 'A work report can only be logged once an engineer has been assigned.');
    }

    const parsed = await parseReport(req.body, request.fieldReport.partsUsed || []);
    if (parsed.error) return fail(res, 400, parsed.error);
    const { hours, diagnosis, partsUsed, isCompleted } = parsed.value;

    const timestamp = now();
    request.fieldReport = {
      hoursSpent: hours,
      diagnosis,
      partsUsed,
      completedAt: isCompleted ? (request.fieldReport.completedAt || timestamp) : request.fieldReport.completedAt
    };
    request.billing.totalHours = hours;
    recalcBilling(request);
    if (isCompleted) request.status = 'Completed';

    request.workLog.push({
      timestamp,
      author: req.user.name,
      role: req.user.role === 'engineer' ? 'Staff Engineer' : 'Admin',
      text: `${isCompleted ? 'Completed job' : 'Updated work log'}: ${hours} hrs logged, ${partsUsed.length} part(s) recorded.`
    });

    await request.save();
    res.json({ success: true, request });
  } catch (err) {
    fail(res, 500, 'Server error');
  }
});

// POST /api/requests/:id/remark - any authenticated participant adds a note
router.post('/:id/remark', async (req, res) => {
  try {
    const text = String(req.body.text || '').trim();
    if (!text) return fail(res, 400, 'Message text required');

    const request = await Request.findOne({ id: req.params.id });
    if (!request) return fail(res, 404, 'Request not found');

    if (req.user.role === 'customer' && request.email !== req.user.email) return fail(res, 403, 'Not your request');
    if (req.user.role === 'engineer' && request.assignedEngineerId !== req.user.engineerId) {
      return fail(res, 403, 'Not assigned to you');
    }

    const { name, role } = actor(req);
    request.workLog.push({ timestamp: now(), author: name, role, text: text.slice(0, 2000) });
    await request.save();
    res.json({ success: true, request });
  } catch (err) {
    fail(res, 500, 'Server error');
  }
});

// POST /api/requests/:id/rating - customer rates a completed job
router.post('/:id/rating', requireRole('customer'), async (req, res) => {
  try {
    const { stars, review } = req.body;
    const n = Number(stars);
    if (!Number.isInteger(n) || n < 1 || n > 5) return fail(res, 400, 'Rating must be an integer from 1 to 5');

    const request = await Request.findOne({ id: req.params.id });
    if (!request) return fail(res, 404, 'Request not found');
    if (request.email !== req.user.email) return fail(res, 403, 'Not your request');
    if (!['Completed', 'Billed', 'Paid'].includes(request.status)) {
      return fail(res, 400, 'You can only rate a completed job');
    }

    const timestamp = now();
    request.rating = { stars: n, review: String(review || '').slice(0, 1000), ratedBy: req.user.name, ratedAt: timestamp };
    request.workLog.push({
      timestamp,
      author: req.user.name,
      role: 'Customer',
      text: `Customer rated the service ${n}/5.` + (review ? ` "${String(review).slice(0, 300)}"` : '')
    });

    await request.save();
    res.json({ success: true, request });
  } catch (err) {
    fail(res, 500, 'Server error');
  }
});

// PATCH /api/requests/:id/billing - admin sends the invoice, then marks it paid (in that order)
router.patch('/:id/billing', requireRole('admin'), async (req, res) => {
  try {
    const { billingStatus } = req.body;
    if (!['Invoice Sent', 'Paid'].includes(billingStatus)) {
      return fail(res, 400, 'billingStatus must be "Invoice Sent" or "Paid"');
    }

    const request = await Request.findOne({ id: req.params.id });
    if (!request) return fail(res, 404, 'Request not found');

    const current = request.billing.billingStatus;
    const timestamp = now();

    if (billingStatus === 'Invoice Sent') {
      if (current !== 'Unbilled') return fail(res, 409, `This invoice is already "${current}".`);
      if (request.status !== 'Completed') {
        return fail(res, 409, 'An invoice can only be sent after the engineer has completed the job.');
      }
      if (!(request.billing.grandTotal > 0)) return fail(res, 409, 'There is nothing to invoice yet.');

      request.billing.billingStatus = 'Invoice Sent';
      request.billing.invoiceDate = timestamp;
      request.status = 'Billed';
      request.workLog.push({
        timestamp,
        author: req.user.name,
        role: 'Admin',
        text: `Invoice ${request.billing.invoiceNumber} for $${request.billing.grandTotal.toFixed(2)} sent to customer.`
      });
    } else {
      if (current === 'Paid') return fail(res, 409, 'This invoice is already paid.');
      if (current !== 'Invoice Sent') {
        return fail(res, 409, 'The invoice must be sent to the customer before it can be marked as paid.');
      }

      request.billing.billingStatus = 'Paid';
      request.status = 'Paid';
      request.workLog.push({
        timestamp,
        author: req.user.name,
        role: 'Admin',
        text: `Payment confirmed for ${request.billing.invoiceNumber}.`
      });
    }

    await request.save();
    res.json({ success: true, request });
  } catch (err) {
    fail(res, 500, 'Server error');
  }
});

export default router;
