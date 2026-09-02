import mongoose from 'mongoose';
import { Account } from './models/Account.js';
import { Engineer } from './models/Engineer.js';
import { Request } from './models/Request.js';
import { ENGINEERS, INITIAL_ACCOUNTS, INITIAL_REQUESTS } from '../src/data/initialData.js';

export const seedDatabase = async () => {
  try {
    // Seed Accounts
    const accountCount = await Account.countDocuments();
    if (accountCount === 0) {
      await Account.insertMany(INITIAL_ACCOUNTS);
      console.log('✅ MongoDB: Populated Initial User Accounts (Admin, Staff, Customers)');
    }

    // Seed Engineers
    const engCount = await Engineer.countDocuments();
    if (engCount === 0) {
      await Engineer.insertMany(ENGINEERS);
      console.log('✅ MongoDB: Populated Staff Engineers Roster');
    }

    // Seed Requests
    const reqCount = await Request.countDocuments();
    if (reqCount === 0) {
      await Request.insertMany(INITIAL_REQUESTS);
      console.log('✅ MongoDB: Populated Initial Service Dispatches & Billing Records');
    }
  } catch (err) {
    console.error('Error seeding MongoDB:', err);
  }
};
