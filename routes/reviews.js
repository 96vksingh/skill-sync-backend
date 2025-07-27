const express = require('express');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

const router = express.Router();

// Review Schema
const reviewSchema = new mongoose.Schema({
  review_id: { type: String, required: true, unique: true },
  task_name: { type: String, required: true },
  task_result: { type: String, required: true },
  task_result_preview: { type: String },
  user_id: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'TIMEOUT'], 
    default: 'PENDING' 
  },
  coherence_score: { type: Number, min: 0, max: 1 },
  corrected_output: { type: String },
  feedback: { type: String },
  reviewed_by: { type: String },
  reviewed_at: { type: Date },
  submitted_at: { type: Date, default: Date.now }
}, {
  timestamps: true
});

const Review = mongoose.model('Review', reviewSchema);

// @route   POST /api/reviews
// @desc    Create a new review request
// @access  Public (called by CrewAI service)
router.post('/', async (req, res) => {
  try {
    const {
      review_id,
      task_name,
      task_result,
      task_result_preview,
      user_id,
      status,
      submitted_at,
      coherence_score
    } = req.body;

    const review = new Review({
      review_id,
      task_name,
      task_result,
      task_result_preview,
      user_id,
      status: status || 'PENDING',
      submitted_at: submitted_at || new Date(),
      coherence_score
    });

    await review.save();

    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      review_id
    });

  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create review'
    });
  }
});

// @route   GET /api/reviews/:review_id
// @desc    Get specific review
// @access  Private
router.get('/:review_id', auth, async (req, res) => {
  try {
    const review = await Review.findOne({ review_id: req.params.review_id });
    
    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found'
      });
    }

    res.json(review);

  } catch (error) {
    console.error('Error fetching review:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch review'
    });
  }
});

// @route   GET /api/reviews/user/:user_id
// @desc    Get all reviews for a specific user
// @access  Private
router.get('/user/:user_id', auth, async (req, res) => {
  try {
    const reviews = await Review.find({ user_id: req.params.user_id })
      .sort({ submitted_at: -1 });

    res.json({
      success: true,
      count: reviews.length,
      reviews
    });

  } catch (error) {
    console.error('Error fetching user reviews:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user reviews'
    });
  }
});

// @route   GET /api/reviews/pending
// @desc    Get all pending reviews
// @access  Private (Admin only ideally)
router.get('/pending', auth, async (req, res) => {
  try {
    const reviews = await Review.find({ status: 'PENDING' })
      .sort({ submitted_at: -1 });

    res.json({
      success: true,
      count: reviews.length,
      reviews
    });

  } catch (error) {
    console.error('Error fetching pending reviews:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending reviews'
    });
  }
});

// @route   POST /api/reviews/:review_id/approve
// @desc    Approve or reject a review
// @access  Private
router.post('/:review_id/approve', auth, async (req, res) => {
  try {
    const { approved, corrected_output, feedback } = req.body;
    
    const review = await Review.findOneAndUpdate(
      { review_id: req.params.review_id },
      {
        status: approved ? 'APPROVED' : 'REJECTED',
        corrected_output,
        feedback,
        reviewed_by: req.user.name || req.user.email,
        reviewed_at: new Date()
      },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found'
      });
    }

    res.json({
      success: true,
      message: `Review ${approved ? 'approved' : 'rejected'} successfully`,
      review
    });

  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update review'
    });
  }
});

// @route   PATCH /api/reviews/:review_id/status
// @desc    Update review status
// @access  Public (for timeout updates from CrewAI)
router.patch('/:review_id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    const review = await Review.findOneAndUpdate(
      { review_id: req.params.review_id },
      { status },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found'
      });
    }

    res.json({
      success: true,
      message: 'Status updated successfully',
      review
    });

  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update status'
    });
  }
});

module.exports = router;
