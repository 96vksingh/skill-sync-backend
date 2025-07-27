const express = require('express');
const axios = require('axios');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Match = require('../models/Match');
const Skill = require('../models/Skill');
const Settings = require('../models/Settings');

const router = express.Router();
const CREWAI_SERVICE_URL = process.env.CREWAI_SERVICE_URL || 'http://localhost:8000';

// @route   GET /api/matches
// @desc    Get all matches for current user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const matches = await Match.find({ user: req.user._id }).populate('matchedWith', 'name department role');
    res.json(matches);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// @route   POST /api/matches/ai-enhanced
// @desc    Get AI-enhanced recommendations using CrewAI + Gemini
// @access  Private
router.post('/ai-enhanced', auth, async (req, res) => {
  try {
    console.log('Calling CrewAI service with Gemini for user:', req.user._id);
    
    // Get user's current skills for context
    const userSkills = await Skill.find({ user: req.user._id });
        const crewai_servicesetting = await Settings.findOne({ name: 'crewai_service' });
        const crewaiurl = crewai_servicesetting?.key;
    
    
    const crewaiResponse = await axios.post(`${crewaiurl}/analyze-skills`, {
      user_id: req.user._id.toString(),
      preferences: req.body.preferences || {},
      current_skills: userSkills.map(skill => ({
        name: skill.name,
        category: skill.category,
        proficiency: skill.proficiency
      }))
    }, {
      timeout: 45000, // 45 second timeout for AI processing
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.header('Authorization') // Forward user auth
      }
    });

    // Save AI recommendations as matches for future reference
    if (crewaiResponse.data.success && crewaiResponse.data.recommendations) {
      const aiRecommendations = crewaiResponse.data.recommendations;
      
      // Create match records for mentorship recommendations
      if (aiRecommendations.mentorship) {
        for (const mentor of aiRecommendations.mentorship.slice(0, 3)) {
          await Match.findOneAndUpdate(
            { 
              user: req.user._id, 
              type: 'Mentorship',
              opportunity: mentor.title 
            },
            {
              user: req.user._id,
              type: 'Mentorship',
              opportunity: mentor.title,
              score: mentor.match_score || 85,
              message: mentor.description
            },
            { upsert: true }
          );
        }
      }
    }

    res.json({
      success: true,
      ai_recommendations: crewaiResponse.data.recommendations,
      analysis_result: crewaiResponse.data.analysis_result,
      llm_provider: "Google Gemini",
      user_id: req.user._id,
      processing_time: crewaiResponse.data.processing_time
    });

  } catch (error) {
    console.error('CrewAI + Gemini service error:', error.message);
    
    // Provide fallback recommendations
    res.json({
      success: false,
      error: 'AI service temporarily unavailable',
      fallback_mode: true,
      llm_provider: "Fallback System",
      fallback_recommendations: {
        mentorship: [
          {
            type: "mentorship",
            title: "Connect with Senior Team Members",
            description: "Reach out to experienced colleagues in your department for guidance",
            match_score: 75
          }
        ],
        collaboration: [
          {
            type: "collaboration", 
            title: "Join Cross-Department Projects",
            description: "Look for opportunities to work with other teams and expand your network",
            match_score: 70
          }
        ],
        skill_development: [
          {
            type: "learning",
            title: "Skill Enhancement Program",
            description: "Consider joining internal training programs or workshops",
            priority: "Medium"
          }
        ]
      }
    });
  }
});

// @route   GET /api/matches/ai-status
// @desc    Check CrewAI service health and capabilities
// @access  Private
router.get('/ai-status', auth, async (req, res) => {
  try {
            const crewai_servicesetting = await Settings.findOne({ name: 'crewai_service' });
        const crewaiurl = crewai_servicesetting?.key;

    const healthResponse = await axios.get(`${crewaiurl}/health`, {
      timeout: 5000
    });
    
    res.json({
      ai_service_status: 'online',
      llm_provider: healthResponse.data.llm_provider || 'Google Gemini',
      version: healthResponse.data.version,
      last_check: new Date().toISOString()
    });
  } catch (error) {
    res.json({
      ai_service_status: 'offline',
      error: error.message,
      last_check: new Date().toISOString()
    });
  }
});

// @route   POST /api/matches/recommend
// @desc    Get traditional recommendations (fallback)
// @access  Private
router.post('/recommend', auth, async (req, res) => {
  try {
    // Traditional matching logic as fallback
    const mySkills = await Skill.find({ user: req.user._id });
    const skillNames = mySkills.map(s => s.name);

    const potentialMentors = await User.find({
      _id: { $ne: req.user._id },
      isActive: true
    }).limit(5);

    const recommendations = [
      {
        title: 'Skill-Based Mentorship',
        description: `Connect with colleagues who have expertise in ${skillNames.slice(0, 2).join(', ')}`,
        match: 88,
        type: 'mentorship'
      },
      {
        title: 'Department Collaboration',
        description: 'Join upcoming cross-department initiatives in your area',
        match: 82,
        type: 'collaboration'
      },
      {
        title: 'Learning Circle',
        description: 'Form a study group with peers interested in similar technologies',
        match: 79,
        type: 'learning'
      }
    ];

    res.json(recommendations);
  } catch (error) {
    console.error('Traditional recommendations error:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

module.exports = router;
