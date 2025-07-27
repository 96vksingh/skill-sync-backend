const mongoose = require('mongoose');

/**
 * Represents a single match recommendation (user-to-user or user-to-opportunity).
 */
const matchSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  matchedWith: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // for mentorship, teamups etc.
  opportunity: { type: String }, // Can store project/event name or id
  type: { type: String, enum: ['Mentorship', 'Project', 'Gig', 'Other'], required: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  message: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Match', matchSchema);
