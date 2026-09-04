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

// PATCH /api/engineers/:engineerId/toggle-active - Admin toggles engineer active/inactive
router.patch('/:engineerId/toggle-active', async (req, res) => {
  try {
    const { engineerId } = req.params;
    const engineer = await Engineer.findOne({ id: engineerId });

    if (!engineer) {
      return res.status(404).json({ success: false, error: 'Engineer not found' });
    }

    engineer.isActive = !engineer.isActive;
    engineer.status = engineer.isActive ? 'Available' : 'Inactive';
    await engineer.save();

    res.json({
      success: true,
      engineer,
      message: `${engineer.name} is now ${engineer.isActive ? 'Active' : 'Inactive'}`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
