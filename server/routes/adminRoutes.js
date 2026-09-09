import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { resetDatabase } from '../seed.js';

const router = express.Router();

// POST /api/admin/reset-demo - wipe all data and re-seed (admin only)
router.post('/reset-demo', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    await resetDatabase();
    res.json({ success: true, message: 'Demo data reset to initial state' });
  } catch (err) {
    console.error('Reset demo error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;
