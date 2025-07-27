const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Skill name is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Skill category is required'],
    enum: ['Technical', 'Design', 'Management', 'Marketing', 'Sales', 'Operations', 'HR', 'Finance', 'Other']
  },
  proficiency: {
    type: String,
    required: [true, 'Proficiency level is required'],
    enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert']
  },
  yearsOfExperience: {
    type: Number,
    min: 0,
    max: 50
  },
  verified: {
    type: Boolean,
    default: false
  },
  endorsements: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    comment: String,
    date: {
      type: Date,
      default: Date.now
    }
  }],
  projects: [String] // Project names where this skill was used
}, {
  timestamps: true
});

// Index for efficient searching
skillSchema.index({ name: 'text', category: 1 });
skillSchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Skill', skillSchema);
