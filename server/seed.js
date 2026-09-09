import { Account, hashPasswordValue } from './models/Account.js';
import { Engineer } from './models/Engineer.js';
import { Request } from './models/Request.js';
import Counter, { ensureSeqAtLeast } from './models/Counter.js';
import { ENGINEERS, INITIAL_ACCOUNTS, INITIAL_REQUESTS } from '../src/data/initialData.js';

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

    if (await Request.countDocuments() === 0) {
      await Request.insertMany(INITIAL_REQUESTS);
      console.log('✅ Seeded service dispatches');
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
