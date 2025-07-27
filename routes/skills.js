const express = require('express');
const auth = require('../middleware/auth');
const Skill = require('../models/Skill');

const router = express.Router();

// @route   GET /api/skills
// @desc    Get current user's skills
// @access  Private
router.get('/', auth, async (req, res) => {
  const skills = await Skill.find({ user: req.user._id });
  res.json(skills);
});

// @route   POST /api/skills
// @desc    Add a skill
// @access  Private
router.post('/', auth, async (req, res) => {
  const { name, category, proficiency, yearsOfExperience } = req.body;
  const skill = new Skill({
    user: req.user._id,
    name,
    category,
    proficiency,
    yearsOfExperience
  });
  await skill.save();
  res.status(201).json(skill);
});

// @route   PUT /api/skills/:id
// @desc    Update a skill
// @access  Private
router.put('/:id', auth, async (req, res) => {
  const updated = await Skill.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    req.body,
    { new: true }
  );
  res.json(updated);
});

// @route   DELETE /api/skills/:id
// @desc    Delete a skill
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  await Skill.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  res.json({ success: true });
});

module.exports = router;
