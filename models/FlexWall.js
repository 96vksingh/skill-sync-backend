const mongoose = require('mongoose');

const flexWallSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  skill: { type: String, required: true },
  reason: { type: String, default: '' }, // Optional reason for flexing
  progress: { type: Number }, // The user's score/percent
  date: { type: Date, required: true, default: () => {
    const today = new Date(); today.setHours(0,0,0,0); return today;
  }},
}, { timestamps: true });

flexWallSchema.index({ user: 1, skill: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('FlexWall', flexWallSchema);
