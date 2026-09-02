import express from 'express';
import { Request } from '../models/Request.js';
import { Engineer } from '../models/Engineer.js';

const router = express.Router();

// GET /api/requests - Get all dispatches from MongoDB
router.get('/', async (req, res) => {
  try {
    const requests = await Request.find({}).sort({ createdAt: -1 });
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/requests - Submit new customer service request
router.post('/', async (req, res) => {
  try {
    const { title, category, priority, customerName, contactPerson, phone, email, location, description } = req.body;
    
    const count = await Request.countDocuments();
    const newId = `REQ-2026-${String(count + 1).padStart(3, '0')}`;
    const timestamp = new Date().toLocaleString('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    const newReq = new Request({
      id: newId,
      title,
      category: category || 'Electrical',
      priority: priority || 'High',
      customerName: customerName || 'Acme Semiconductor Manufacturing',
      contactPerson: contactPerson || 'Customer Contact',
      phone: phone || '+1 (555) 000-0000',
      email: email || 'customer@company.com',
      location: location || 'Main Facility',
      description,
      dateSubmitted: timestamp,
      status: 'Pending',
      assignedEngineerId: '',
      assignedEngineerName: 'Unassigned',
      workLog: [{
        timestamp,
        author: contactPerson || customerName || 'Customer',
        role: 'Customer',
        text: `Service request submitted. Urgent issue in category [${category}].`
      }],
      fieldReport: {
        hoursSpent: 0,
        diagnosis: '',
        partsUsed: [],
        completedAt: null
      },
      billing: {
        baseCalloutFee: 150,
        hourlyRate: 100,
        totalHours: 0,
        laborTotal: 0,
        partsTotal: 0,
        subtotal: 150,
        tax: 12,
        grandTotal: 162,
        billingStatus: 'Unbilled',
        invoiceNumber: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        invoiceDate: null
      }
    });

    await newReq.save();
    res.json({ success: true, request: newReq });
  } catch (err) {
    console.error('Create request error:', err);
    res.status(500).json({ success: false, error: 'Database save error' });
  }
});

// PATCH /api/requests/:id/assign - Assign staff engineer
router.patch('/:id/assign', async (req, res) => {
  try {
    const { engineerId, adminName } = req.body;
    const reqId = req.params.id;

    const request = await Request.findOne({ id: reqId });
    const engineer = await Engineer.findOne({ id: engineerId });

    if (!request || !engineer) {
      return res.status(404).json({ success: false, error: 'Request or Engineer not found' });
    }

    const timestamp = new Date().toLocaleString('en-US');
    request.assignedEngineerId = engineer.id;
    request.assignedEngineerName = engineer.name;
    if (request.status === 'Pending') request.status = 'Assigned';
    request.billing.hourlyRate = engineer.hourlyRate;

    request.workLog.push({
      timestamp,
      author: adminName || 'Operations Admin',
      role: 'Admin',
      text: `Assigned Staff Engineer ${engineer.name} (${engineer.specialty}) to this dispatch.`
    });

    await request.save();
    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/requests/:id/status - Update dispatch status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, remark, authorName, role } = req.body;
    const request = await Request.findOne({ id: req.params.id });

    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    const timestamp = new Date().toLocaleString('en-US');
    request.status = status;
    
    if (status === 'Completed' && !request.fieldReport.completedAt) {
      request.fieldReport.completedAt = timestamp;
    }

    const logText = `Status updated to [${status}].` + (remark ? ` Remark: "${remark}"` : '');
    request.workLog.push({
      timestamp,
      author: authorName || 'Staff Engineer',
      role: role || 'Staff Engineer',
      text: logText
    });

    await request.save();
    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/requests/:id/report - Engineer saves field report & parts billing
router.patch('/:id/report', async (req, res) => {
  try {
    const { hoursSpent, diagnosis, partsUsed, isCompleted, authorName } = req.body;
    const request = await Request.findOne({ id: req.params.id });

    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    const timestamp = new Date().toLocaleString('en-US');
    const hourlyRate = request.billing.hourlyRate || 110;
    const laborTotal = (hoursSpent || 0) * hourlyRate;
    const partsTotal = (partsUsed || []).reduce((sum, p) => sum + (p.qty * p.unitPrice), 0);
    const subtotal = request.billing.baseCalloutFee + laborTotal + partsTotal;
    const tax = Math.round(subtotal * 0.08 * 100) / 100;
    const grandTotal = Math.round((subtotal + tax) * 100) / 100;

    request.fieldReport = {
      hoursSpent,
      diagnosis,
      partsUsed: partsUsed || [],
      completedAt: isCompleted ? timestamp : request.fieldReport.completedAt
    };

    if (isCompleted) {
      request.status = 'Completed';
    }

    request.billing.totalHours = hoursSpent;
    request.billing.laborTotal = laborTotal;
    request.billing.partsTotal = partsTotal;
    request.billing.subtotal = subtotal;
    request.billing.tax = tax;
    request.billing.grandTotal = grandTotal;

    request.workLog.push({
      timestamp,
      author: authorName || 'Staff Engineer',
      role: 'Staff Engineer',
      text: `Updated field work log: ${hoursSpent} hrs logged. ${(partsUsed || []).length} replacement parts recorded in MongoDB.`
    });

    await request.save();
    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/requests/:id/remark - Add custom remark log
router.post('/:id/remark', async (req, res) => {
  try {
    const { author, role, text } = req.body;
    const request = await Request.findOne({ id: req.params.id });

    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    const timestamp = new Date().toLocaleString('en-US');
    request.workLog.push({
      timestamp,
      author: author || 'User',
      role: role || 'User',
      text
    });

    await request.save();
    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/requests/:id/billing - Admin updates billing status (Invoice Sent / Paid)
router.patch('/:id/billing', async (req, res) => {
  try {
    const { billingStatus, authorName } = req.body;
    const request = await Request.findOne({ id: req.params.id });

    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    const timestamp = new Date().toLocaleString('en-US');
    request.billing.billingStatus = billingStatus;
    
    if (billingStatus === 'Invoice Sent') {
      if (request.status === 'Completed') request.status = 'Billed';
      request.billing.invoiceDate = timestamp;
      request.workLog.push({
        timestamp,
        author: authorName || 'Billing Dept',
        role: 'Admin',
        text: `Generated itemized invoice ${request.billing.invoiceNumber} for $${request.billing.grandTotal.toFixed(2)}. Saved to MongoDB & sent to customer.`
      });
    } else if (billingStatus === 'Paid') {
      request.status = 'Paid';
      request.workLog.push({
        timestamp,
        author: authorName || 'Billing Dept',
        role: 'Admin',
        text: `Payment confirmed for ${request.billing.invoiceNumber}. Marked as Paid in MongoDB.`
      });
    }

    await request.save();
    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
