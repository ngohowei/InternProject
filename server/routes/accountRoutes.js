import express from 'express';
import { Account } from '../models/Account.js';
import { Engineer } from '../models/Engineer.js';
import { nextSeq } from '../models/Counter.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Everything here is admin-only.
router.use(requireAuth, requireRole('admin'));

// GET /api/accounts - list accounts (passwords stripped by Account.toJSON)
router.get('/', async (req, res) => {
  try {
    const accounts = await Account.find({}).sort({ createdAt: -1 });
    res.json({ success: true, accounts });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/accounts/customer - admin registers a customer account
router.post('/customer', async (req, res) => {
  try {
    const { name, email, phone, customerName, password } = req.body;
    if (!name || !email || !customerName) {
      return res.status(400).json({ success: false, error: 'Name, Email, and Customer Company Name required' });
    }

    const normEmail = String(email).trim().toLowerCase();
    if (await Account.findOne({ email: normEmail })) {
      return res.status(409).json({ success: false, error: `An account with email ${normEmail} already exists` });
    }

    const seq = await nextSeq('customerAccount');
    const newAcc = new Account({
      id: `ACC-CUST-${String(seq).padStart(2, '0')}`,
      name,
      email: normEmail,
      phone: phone || '+1 (555) 000-0000',
      password: password || 'cust123',
      role: 'customer',
      customerName,
      createdByAdmin: true
    });

    await newAcc.save();
    res.status(201).json({ success: true, account: newAcc, message: `Created customer account for ${customerName}` });
  } catch (err) {
    console.error('Create customer account error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/accounts/engineer - admin registers a staff engineer (engineer + login account)
router.post('/engineer', async (req, res) => {
  try {
    const { name, email, phone, specialty, hourlyRate, password } = req.body;
    if (!name || !email || !specialty) {
      return res.status(400).json({ success: false, error: 'Engineer Name, Email, and Specialty required' });
    }

    const normEmail = String(email).trim().toLowerCase();
    if (await Account.findOne({ email: normEmail })) {
      return res.status(409).json({ success: false, error: `An account with email ${normEmail} already exists` });
    }

    const engSeq = await nextSeq('engineer');
    const engineerId = `ENG-${100 + engSeq}`;

    const newEng = new Engineer({
      id: engineerId,
      name,
      role: 'Staff Engineer',
      specialty,
      phone: phone || '+1 (555) 000-0000',
      email: normEmail,
      status: 'Available',
      isActive: true,
      activeJobs: 0,
      hourlyRate: parseFloat(hourlyRate) || 110
    });
    await newEng.save();

    const acctSeq = await nextSeq('staffAccount');
    const newAcc = new Account({
      id: `ACC-STAFF-${100 + acctSeq}`,
      name,
      email: normEmail,
      phone: phone || '+1 (555) 000-0000',
      password: password || 'staff123',
      role: 'staff',
      engineerId,
      createdByAdmin: true
    });
    await newAcc.save();

    res.status(201).json({
      success: true,
      account: newAcc,
      engineer: newEng,
      message: `Created engineer account for ${name} (${engineerId})`
    });
  } catch (err) {
    console.error('Create engineer account error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;
