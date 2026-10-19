import { Account, hashPasswordValue } from './models/Account.js';
import { Engineer } from './models/Engineer.js';
import { Request } from './models/Request.js';
import { Part } from './models/Part.js';
import Counter, { ensureSeqAtLeast } from './models/Counter.js';
import { isDemoMode } from './config/demo.js';
import { ENGINEERS, INITIAL_ACCOUNTS, INITIAL_REQUESTS, INITIAL_PARTS } from '../src/data/initialData.js';

const trailingNumber = (str) => {
  const m = String(str).match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : 0;
};

export const seedDatabase = async () => {
  try {
    if (await Account.countDocuments() === 0) {
      const hashed = await Promise.all(
        INITIAL_ACCOUNTS.map(async (a) => ({ ...a, password: await hashPasswordValue(a.password) }))
      );
      await Account.insertMany(hashed);
      console.log('✅ Seeded user accounts (admin, staff, customers)');
    }

    if (await Engineer.countDocuments() === 0) {
      await Engineer.insertMany(ENGINEERS.map((e) => ({ isActive: true, ...e })));
      console.log('✅ Seeded staff engineer roster');
    }

    // Demo databases created before every sample engineer had a login: add the missing engineer logins
    // (matched by email; existing accounts are never touched). Only in demo mode, so a live database
    // never gets accounts with a well-known password.
    if (isDemoMode()) {
      const haveEmails = new Set((await Account.find({}, 'email')).map((a) => a.email));
      const haveEngineers = new Set((await Engineer.find({}, 'id')).map((e) => e.id));
      const missing = INITIAL_ACCOUNTS.filter(
        (a) => a.role === 'staff' && !haveEmails.has(a.email) && haveEngineers.has(a.engineerId)
      );
      if (missing.length > 0) {
        const hashed = await Promise.all(missing.map(async (a) => ({ ...a, password: await hashPasswordValue(a.password) })));
        await Account.insertMany(hashed);
        console.log(`✅ Added login(s) for sample engineer(s): ${missing.map((a) => a.email).join(', ')}`);
      }
    }

    if (await Request.countDocuments() === 0) {
      await Request.insertMany(INITIAL_REQUESTS);
      console.log('✅ Seeded service dispatches');
    }

    if (await Part.countDocuments() === 0) {
      await Part.insertMany(INITIAL_PARTS);
      console.log('✅ Seeded parts catalog');
    }

    // Catalog items saved before categories existed: give the starter items their category and
    // everything else "General" (the raw update is needed because queries can't match a missing field).
    const noCategory = await Part.find({ category: { $exists: false } }, 'code');
    if (noCategory.length > 0) {
      const starter = new Map(INITIAL_PARTS.map((p) => [p.code, p.category]));
      await Part.bulkWrite(
        noCategory.map((p) => ({
          updateOne: { filter: { _id: p._id }, update: { $set: { category: starter.get(p.code) || 'General' } } }
        }))
      );
      console.log(`✅ Added categories to ${noCategory.length} catalog item(s)`);
    }

    // Older databases have report lines without an item code. Where a line exactly matches a
    // catalog item (same name and price), attach that item's code. Safe to run repeatedly.
    const catalog = await Part.find({});
    const byKey = new Map(catalog.map((p) => [`${p.name}|${p.unitPrice}`, p.code]));
    const needCodes = await Request.find({ 'fieldReport.partsUsed': { $elemMatch: { code: { $in: ['', null] } } } });
    for (const r of needCodes) {
      let changed = false;
      for (const line of r.fieldReport.partsUsed) {
        const code = !line.code && byKey.get(`${line.description}|${line.unitPrice}`);
        if (code) { line.code = code; changed = true; }
      }
      if (changed) { r.markModified('fieldReport.partsUsed'); await r.save(); }
    }

    // Advance ID counters past the highest seeded fixed IDs so generated IDs never collide.
    const engs = await Engineer.find({});
    const custAccts = await Account.find({ role: 'customer' });
    const staffAccts = await Account.find({ role: 'staff' });
    const reqs = await Request.find({});

    await ensureSeqAtLeast('engineer', Math.max(0, ...engs.map((e) => trailingNumber(e.id) - 100)));
    await ensureSeqAtLeast('customerAccount', Math.max(0, ...custAccts.map((a) => trailingNumber(a.id))));
    await ensureSeqAtLeast('staffAccount', Math.max(0, ...staffAccts.map((a) => trailingNumber(a.id) - 100)));
    await ensureSeqAtLeast('request', Math.max(0, ...reqs.map((r) => trailingNumber(r.id))));
  } catch (err) {
    console.error('Error seeding database:', err);
  }
};

/** Wipe all app collections and re-seed. Used by the admin "reset demo" action. */
export const resetDatabase = async () => {
  await Promise.all([
    Account.deleteMany({}),
    Engineer.deleteMany({}),
    Request.deleteMany({}),
    Part.deleteMany({}),
    Counter.deleteMany({})
  ]);
  await seedDatabase();
};

// Allow `npm run seed` to run this file directly.
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const dotenv = (await import('dotenv')).default;
  dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env') });
  const { connectDB, disconnectDB } = await import('./config/db.js');
  await connectDB();
  await seedDatabase();
  console.log('Seed complete.');
  await disconnectDB();
  process.exit(0);
}
