import express from 'express';
import { Engineer } from '../models/Engineer.js';

const router = express.Router();

// GET /api/engineers - List all staff engineers
router.get('/', async (req, res) => {
  try {
    const engineers = await Engineer.find({});
    res.json({ success: true, engineers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
