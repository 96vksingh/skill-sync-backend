const mongoose = require('mongoose');

const connectionSchema = new mongoose.Schema({
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  message: {
    type: String,
    maxlength: 500
  },
  connection_type: {
    type: String,
    enum: ['mentorship', 'collaboration', 'networking', 'general'],
    default: 'general'
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate connection requests
connectionSchema.index({ requester: 1, recipient: 1 }, { unique: true });

// Index for faster queries
connectionSchema.index({ recipient: 1, status: 1 });
connectionSchema.index({ requester: 1, status: 1 });

module.exports = mongoose.model('Connection', connectionSchema);
