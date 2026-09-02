import express from 'express';
import { Account } from '../models/Account.js';
import { Engineer } from '../models/Engineer.js';

const router = express.Router();

// GET /api/accounts - List all registered user accounts
router.get('/', async (req, res) => {
  try {
    const accounts = await Account.find({}).sort({ createdAt: -1 });
    res.json({ success: true, accounts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/accounts/customer - Admin registers new customer account in MongoDB
router.post('/customer', async (req, res) => {
  try {
    const { name, email, phone, customerName, password } = req.body;
    if (!name || !email || !customerName) {
      return res.status(400).json({ success: false, error: 'Name, Email, and Customer Company Name required' });
    }

    const existing = await Account.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, error: `Account with email ${email} already exists in MongoDB` });
    }

    const totalAccounts = await Account.countDocuments();
    const newAcc = new Account({
      id: `ACC-CUST-${String(totalAccounts + 1).padStart(2, '0')}`,
      name: name,
      email: email.trim().toLowerCase(),
      phone: phone || '+1 (555) 000-0000',
      password: password || 'cust123',
      role: 'customer', // Database role row
      customerName: customerName,
      createdByAdmin: true,
      createdAt: new Date().toLocaleDateString('en-US')
    });

    await newAcc.save();
    res.json({ success: true, account: newAcc, message: `Created Customer Account in MongoDB for ${customerName}` });
  } catch (err) {
    console.error('Create customer account error:', err);
    res.status(500).json({ success: false, error: 'Database creation error' });
  }
});

// POST /api/accounts/engineer - Admin registers new staff engineer account in MongoDB
router.post('/engineer', async (req, res) => {
  try {
    const { name, email, phone, specialty, hourlyRate, password } = req.body;
    if (!name || !email || !specialty) {
      return res.status(400).json({ success: false, error: 'Engineer Name, Email, and Specialty required' });
    }

    const existing = await Account.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, error: `Account with email ${email} already exists in MongoDB` });
    }

    const totalEngineers = await Engineer.countDocuments();
    const engineerId = `ENG-${String(totalEngineers + 101)}`;

    const newEng = new Engineer({
      id: engineerId,
      name: name,
      role: 'Staff Engineer',
      specialty: specialty,
      phone: phone || '+1 (555) 000-0000',
      email: email.trim().toLowerCase(),
      status: 'Available',
      activeJobs: 0,
      hourlyRate: parseFloat(hourlyRate) || 110
    });

    await newEng.save();

    const totalAccounts = await Account.countDocuments();
    const newAcc = new Account({
      id: `ACC-STAFF-${String(totalAccounts + 101)}`,
      name: name,
      email: email.trim().toLowerCase(),
      phone: phone || '+1 (555) 000-0000',
      password: password || 'staff123',
      role: 'staff',
      engineerId: engineerId,
      createdByAdmin: true,
      createdAt: new Date().toLocaleDateString('en-US')
    });

    await newAcc.save();

    res.json({ 
      success: true, 
      account: newAcc, 
      engineer: newEng, 
      message: `Created Engineer Account for ${name} (${engineerId}) in MongoDB!` 
    });
  } catch (err) {
    console.error('Create engineer account error:', err);
    res.status(500).json({ success: false, error: err.message || 'Database creation error' });
  }
});

export default router;
