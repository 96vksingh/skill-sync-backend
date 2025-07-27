const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const FlexWall = require('../models/FlexWall');
const User = require('../models/User');

// 🧠 Utility: Get today's date (start of day)
const getToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * @route   POST /api/flexwall/flex
 * @desc    Flex a skill today (or update if already exists)
 * @access  Private
 */
router.post('/flex', auth, async (req, res) => {
  try {
    const { skill, progress, reason } = req.body;

    if (!skill) {
      return res.status(400).json({ error: 'Skill name is required.' });
    }

    const today = getToday();

    // Upsert (create or update today's flex for this user/skill)
    const flex = await FlexWall.findOneAndUpdate(
      { user: req.user._id, skill, date: today },
      { progress,reason },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, flex });
  } catch (error) {
    console.error('Error recording flex:', error);
    res.status(500).json({ error: 'Failed to flex skill.' });
  }
});

/**
 * @route   GET /api/flexwall/today
 * @desc    Get today's flex wall
 * @access  Private
 */
router.get('/today', auth, async (req, res) => {
  try {
    const today = getToday();

    const flexes = await FlexWall.find({ date: today })
      .populate('user', 'name avatar role') // Only necessary fields
      .sort({ progress: -1 });

    res.json(flexes);
  } catch (error) {
    console.error('Error fetching flex wall:', error);
    res.status(500).json({ error: 'Failed to load flex wall.' });
  }
});

module.exports = router;
