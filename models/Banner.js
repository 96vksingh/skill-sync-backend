const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true // One banner per day
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  hot_topic: {
    type: String,
    required: true
  },
  image_url: {
    type: String,
    required: true
  },
  image_binary: {
    type: Buffer, // Store image as binary data
    required: true
  },
  image_content_type: {
    type: String,
    required: true,
    default: 'image/jpeg'
  },
  meta :{
    source: {
      type: String,
      default: 'Perplexity AI'
    },
    generated_at: {
      type: Date,
      default: Date.now
    },
    topic_category: String,
    engagement_score: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'draft'],
    default: 'active'
  },
  expires_at: {
    type: Date,
    default: () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow;
    }
  }
}, {
  timestamps: true
});

// Index for faster queries
bannerSchema.index({ date: 1 });
bannerSchema.index({ status: 1, expires_at: 1 });

// Virtual for image URL serving
bannerSchema.virtual('image_serve_url').get(function() {
  return `/api/banners/${this._id}/image`;
});

module.exports = mongoose.model('Banner', bannerSchema);
