const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  key: { type: String },            // <--- store your key here
  value: { type: String },          // optional (for configs)
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Settings', settingsSchema);
