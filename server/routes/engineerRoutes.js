import express from 'express';
import { Engineer } from '../models/Engineer.js';
import { Request } from '../models/Request.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/engineers - any authenticated user (needed for assignment dropdowns / portal)
router.get('/', async (req, res) => {
  try {
    const engineers = await Engineer.find({});
    res.json({ success: true, engineers });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PATCH /api/engineers/:engineerId/toggle-active - admin only
// A deactivated engineer can no longer sign in, and any session they already have stops working
// (see requireAuth). Jobs they hold stay assigned until an admin reassigns them.
router.patch('/:engineerId/toggle-active', requireRole('admin'), async (req, res) => {
  try {
    const engineer = await Engineer.findOne({ id: req.params.engineerId });
    if (!engineer) return res.status(404).json({ success: false, error: 'Engineer not found' });

    engineer.isActive = !engineer.isActive;
    engineer.status = engineer.isActive ? 'Available' : 'Inactive';
    await engineer.save();

    let message = `${engineer.name} is now ${engineer.isActive ? 'Active' : 'Inactive'}`;
    if (!engineer.isActive) {
      message += ' and can no longer sign in.';
      const openJobs = await Request.countDocuments({
        assignedEngineerId: engineer.id,
        status: { $in: ['Assigned', 'En Route', 'In Progress'] }
      });
      if (openJobs > 0) {
        message += ` ${openJobs} unfinished job(s) are still assigned to them - please reassign.`;
      }
    }

    res.json({ success: true, engineer, message });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;
