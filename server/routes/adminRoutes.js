import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { isDemoMode } from '../config/demo.js';
import { resetDatabase } from '../seed.js';

const router = express.Router();

// POST /api/admin/reset-demo - wipe ALL data and restore the sample data (admin only).
// Only available in demo mode, and the caller must send { confirm: "RESET" } so it can never
// happen by accident (a stray click, a script, a repeated request).
router.post('/reset-demo', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    if (!isDemoMode()) {
      return res.status(403).json({ success: false, error: 'Demo reset is turned off on this server.' });
    }
    if (req.body?.confirm !== 'RESET') {
      return res.status(400).json({ success: false, error: 'Type RESET to confirm that you want to erase all data.' });
    }

    console.warn(`⚠️  Demo reset requested by ${req.user.email} - erasing all data and re-seeding`);
    await resetDatabase();
    res.json({ success: true, message: 'Demo data reset to initial state' });
  } catch (err) {
    console.error('Reset demo error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;
