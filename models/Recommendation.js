const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
source_user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Only required for career_inspiration type
  },
  recommendation_type: {
    type: String,
    enum: ['linkedin_analysis', 'career_inspiration', 'skill_development'],
    required: true
  },
  recommendations: {
    profile_optimization: [String],
    networking: [String],
    content_strategy: [String],
    skill_development: [String],
    career_roadmap: [String]
  },
  analysis_text: {
    type: String,
    maxlength: 2000
  },
  ai_provider: {
    type: String,
    default: 'CrewAI'
  },
  metadata: {
    profile_url: String,
    analysis_date: Date,
    user_role: String,
    user_department: String,
    profile_score: Number,
    total_recommendations: Number,
    completed_at: String,
    crew_ai_user_id: String
  },
  recommendation_status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  }
}, {
  timestamps: true
});

// Index for faster queries
recommendationSchema.index({ user_id: 1, recommendation_type: 1, createdAt: -1 });

module.exports = mongoose.model('Recommendation', recommendationSchema);
