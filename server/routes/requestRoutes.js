import express from 'express';
import { Request, TAX_RATE } from '../models/Request.js';
import { Engineer } from '../models/Engineer.js';
import { nextSeq } from '../models/Counter.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

const now = () => new Date().toLocaleString('en-US');
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

// GET /api/requests - scoped to the caller's role
router.get('/', async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'customer') filter = { email: req.user.email };
    else if (req.user.role === 'engineer') filter = { assignedEngineerId: req.user.engineerId };

    const requests = await Request.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/requests - customer (or admin) submits a service request
router.post('/', requireRole('customer', 'admin'), async (req, res) => {
  try {
    const { title, category, priority, customerName, contactPerson, phone, email, location, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, error: 'Title and description are required' });
    }

    const seq = await nextSeq('request');
    const newId = `REQ-2026-${String(seq).padStart(3, '0')}`;
    const timestamp = now();

    const newReq = new Request({
      id: newId,
      title,
      category: category || 'Electrical',
      priority: priority || 'High',
      customerName: customerName || req.user.customerName || 'Unknown Customer',
      contactPerson: contactPerson || req.user.name || 'Customer Contact',
      phone: phone || '+1 (555) 000-0000',
      email: (email || req.user.email || '').toLowerCase(),
      location: location || 'Main Facility',
      description,
      dateSubmitted: timestamp,
      status: 'Pending',
      assignedEngineerId: '',
      assignedEngineerName: 'Unassigned',
      workLog: [{
        timestamp,
        author: contactPerson || req.user.name || 'Customer',
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
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PATCH /api/requests/:id/assign - admin assigns a staff engineer
router.patch('/:id/assign', requireRole('admin'), async (req, res) => {
  try {
    const { engineerId } = req.body;
    const request = await Request.findOne({ id: req.params.id });
    const engineer = await Engineer.findOne({ id: engineerId });
    if (!request || !engineer) {
      return res.status(404).json({ success: false, error: 'Request or Engineer not found' });
    }
    if (engineer.isActive === false) {
      return res.status(400).json({ success: false, error: 'Cannot assign an inactive engineer' });
    }

    request.assignedEngineerId = engineer.id;
    request.assignedEngineerName = engineer.name;
    if (request.status === 'Pending') request.status = 'Assigned';
    request.billing.hourlyRate = engineer.hourlyRate;
    recalcBilling(request);

    request.workLog.push({
      timestamp: now(),
      author: req.user.name,
      role: 'Admin',
      text: `Assigned Staff Engineer ${engineer.name} (${engineer.specialty}) to this dispatch.`
    });

    await request.save();
    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PATCH /api/requests/:id/status - engineer or admin updates dispatch status
router.patch('/:id/status', requireRole('engineer', 'admin'), async (req, res) => {
  try {
    const { status, remark } = req.body;
    const request = await Request.findOne({ id: req.params.id });
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });

    if (req.user.role === 'engineer' && request.assignedEngineerId !== req.user.engineerId) {
      return res.status(403).json({ success: false, error: 'This dispatch is not assigned to you' });
    }

    const timestamp = now();
    request.status = status;
    if (status === 'Completed' && !request.fieldReport.completedAt) {
      request.fieldReport.completedAt = timestamp;
    }

    const { name, role } = actor(req);
    request.workLog.push({
      timestamp,
      author: name,
      role,
      text: `Status updated to [${status}].` + (remark ? ` Remark: "${remark}"` : '')
    });

    await request.save();
    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PATCH /api/requests/:id/report - engineer saves field report & parts
router.patch('/:id/report', requireRole('engineer', 'admin'), async (req, res) => {
  try {
    const { hoursSpent, diagnosis, partsUsed, isCompleted } = req.body;
    const request = await Request.findOne({ id: req.params.id });
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });

    if (req.user.role === 'engineer' && request.assignedEngineerId !== req.user.engineerId) {
      return res.status(403).json({ success: false, error: 'This dispatch is not assigned to you' });
    }

    const timestamp = now();
    request.fieldReport = {
      hoursSpent: hoursSpent || 0,
      diagnosis: diagnosis || '',
      partsUsed: Array.isArray(partsUsed) ? partsUsed : [],
      completedAt: isCompleted ? timestamp : request.fieldReport.completedAt
    };
    request.billing.totalHours = hoursSpent || 0;
    recalcBilling(request);
    if (isCompleted) request.status = 'Completed';

    request.workLog.push({
      timestamp,
      author: req.user.name,
      role: 'Staff Engineer',
      text: `Updated field work log: ${hoursSpent || 0} hrs logged, ${(partsUsed || []).length} parts recorded.`
    });

    await request.save();
    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/requests/:id/remark - any authenticated participant adds a note
router.post('/:id/remark', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ success: false, error: 'Message text required' });

    const request = await Request.findOne({ id: req.params.id });
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });

    if (req.user.role === 'customer' && request.email !== req.user.email) {
      return res.status(403).json({ success: false, error: 'Not your request' });
    }
    if (req.user.role === 'engineer' && request.assignedEngineerId !== req.user.engineerId) {
      return res.status(403).json({ success: false, error: 'Not assigned to you' });
    }

    const { name, role } = actor(req);
    request.workLog.push({ timestamp: now(), author: name, role, text });
    await request.save();
    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/requests/:id/rating - customer rates a completed job
router.post('/:id/rating', requireRole('customer'), async (req, res) => {
  try {
    const { stars, review } = req.body;
    const n = Number(stars);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be an integer from 1 to 5' });
    }

    const request = await Request.findOne({ id: req.params.id });
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });
    if (request.email !== req.user.email) {
      return res.status(403).json({ success: false, error: 'Not your request' });
    }
    if (!['Completed', 'Billed', 'Paid'].includes(request.status)) {
      return res.status(400).json({ success: false, error: 'You can only rate a completed job' });
    }

    const timestamp = now();
    request.rating = { stars: n, review: review || '', ratedBy: req.user.name, ratedAt: timestamp };
    request.workLog.push({
      timestamp,
      author: req.user.name,
      role: 'Customer',
      text: `Customer rated the service ${n}/5.` + (review ? ` "${review}"` : '')
    });

    await request.save();
    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PATCH /api/requests/:id/billing - admin sends invoice / marks paid
router.patch('/:id/billing', requireRole('admin'), async (req, res) => {
  try {
    const { billingStatus } = req.body;
    if (!['Invoice Sent', 'Paid'].includes(billingStatus)) {
      return res.status(400).json({ success: false, error: 'billingStatus must be "Invoice Sent" or "Paid"' });
    }

    const request = await Request.findOne({ id: req.params.id });
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });

    const timestamp = now();
    request.billing.billingStatus = billingStatus;

    if (billingStatus === 'Invoice Sent') {
      if (request.status === 'Completed') request.status = 'Billed';
      request.billing.invoiceDate = timestamp;
      request.workLog.push({
        timestamp,
        author: req.user.name,
        role: 'Admin',
        text: `Invoice ${request.billing.invoiceNumber} for $${request.billing.grandTotal.toFixed(2)} sent to customer.`
      });
    } else {
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
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;
