const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Skill = require('../models/Skill');
const Recommendation = require('../models/Recommendation');
const router = express.Router();
const Connection = require('../models/Connection');
const axios = require('axios');
const FlexWall = require('../models/FlexWall');
const Settings = require('../models/Settings');
// @route   GET /api/users/me
// @desc    Get current user's full profile
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('skills');
    res.json(user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/users/me
// @desc    Update profile (bio, avatar, social profiles, etc.)
// @access  Private
router.put('/me', auth, async (req, res) => {
  try {
    const allowedUpdates = [
      'bio', 
      'avatar', 
      'interests', 
      'availability', 
      'linkedinProfile',    // NEW FIELD
      'twitterProfile'      // NEW FIELD
    ];
    
    const updates = {};
    
    // Only include allowed fields that are present in request
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id, 
      updates, 
      {
        new: true,
        runValidators: true // This will run the validation for LinkedIn/Twitter URLs
      }
    ).populate('skills');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user
    });

  } catch (error) {
    console.error('Profile update error:', error);
    
    // Handle validation errors specifically
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationErrors 
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/users/search
// @desc    Find users by skill or name (simple fuzzy search)
// @access  Private
router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    let users;

    if (!q) {
      users = await User.find().limit(10).select('-password');
    } else {
      users = await User.find({
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { department: { $regex: q, $options: 'i' } },
          { role: { $regex: q, $options: 'i' } }
        ]
      }).select('-password');
    }

    res.json(users);
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ error: error.message });
  }
});





// Add this new route to your existing users.js file

// @route   POST /api/users/analyze-linkedin
// @desc    Analyze user's LinkedIn profile using AI
// @access  Private
// const Recommendation = require('../models/Recommendation');

// @route   POST /api/users/analyze-linkedin
// @desc    Analyze user's LinkedIn profile with CrewAI and store results
// @access  Private
router.post('/analyze-linkedin', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('skills');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!user.linkedinProfile) {
      return res.status(400).json({
        success: false,
        error: 'No LinkedIn profile found. Please add your LinkedIn profile first.'
      });
    }

    // Create pending analysis record
    let analysisRecord = new Recommendation({
      user_id: req.user._id,
      recommendation_type: 'linkedin_analysis',
      status: 'pending',
      analysis_text: 'LinkedIn analysis in progress...',
      metadata: {
        profile_url: user.linkedinProfile,
        analysis_date: new Date(),
        user_role: user.role,
        user_department: user.department
      }
    });

    await analysisRecord.save();
    console.log('Created pending analysis record:', analysisRecord._id);
    const crewai_servicesetting = await Settings.findOne({ name: 'crewai_service' });
    const crewaiurl = crewai_servicesetting?.key;

    try {
      // Call CrewAI service for LinkedIn analysis
      const CREWAI_URL = crewaiurl

      
      console.log('Calling CrewAI service for LinkedIn analysis...');
      const analysisResponse = await axios.post(`${CREWAI_URL}/analyze-linkedin-profile`, {
        user_id: req.user._id.toString(),
        linkedin_profile: user.linkedinProfile,
        current_user: {
          name: user.name,
          role: user.role,
          department: user.department,
          bio: user.bio,
          skills: user.skills.map(skill => skill.name || skill), // Handle populated skills
          experience_level: user.experience_level
        }
      }, {
        headers: {
          'Authorization': req.header('Authorization'),
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 seconds timeout
      });

      console.log('CrewAI analysis completed successfully');
      const crewAIResult = analysisResponse.data;

      // Map CrewAI response to our Recommendation format
      const recommendations = {
        profile_optimization: Array.isArray(crewAIResult.profile_optimization) 
          ? crewAIResult.profile_optimization 
          : (crewAIResult.profile_optimization ? [crewAIResult.profile_optimization] : []),
        
        networking: Array.isArray(crewAIResult.networking) 
          ? crewAIResult.networking 
          : (crewAIResult.networking ? [crewAIResult.networking] : []),
        
        content_strategy: Array.isArray(crewAIResult.content_strategy) 
          ? crewAIResult.content_strategy 
          : (crewAIResult.content_strategy ? [crewAIResult.content_strategy] : []),
        
        skill_development: Array.isArray(crewAIResult.skill_development) 
          ? crewAIResult.skill_development 
          : (crewAIResult.skill_development ? [crewAIResult.skill_development] : []),
        
        // Add career_roadmap as empty array since CrewAI doesn't provide it
        career_roadmap: []
      };

      // Calculate metrics
      const totalRecommendations = Object.values(recommendations)
        .flat()
        .filter(rec => rec && rec.trim().length > 0)
        .length;
      
      const profileScore = totalRecommendations > 0 
        ? Math.min(100, Math.max(20, 100 - (totalRecommendations * 5)))
        : 50;

      // Update the analysis record with CrewAI results
      analysisRecord.recommendations = recommendations;
      analysisRecord.analysis_text = crewAIResult.analysis_result || 'LinkedIn profile analysis completed successfully.';
      analysisRecord.status = 'completed';
      analysisRecord.ai_provider = 'CrewAI';
      analysisRecord.metadata = {
        ...analysisRecord.metadata,
        profile_url: crewAIResult.profile_analyzed || user.linkedinProfile,
        profile_score: profileScore,
        total_recommendations: totalRecommendations,
        completed_at: crewAIResult.completed_at,
        crew_ai_user_id: crewAIResult.user_id
      };

      await analysisRecord.save();
      console.log('Analysis results saved to database:', analysisRecord._id);

      // Return structured response for frontend
      res.json({
        success: true,
        message: 'LinkedIn profile analysis completed successfully',
        analysis: {
          id: analysisRecord._id,
          recommendations: recommendations,
          analysis_text: analysisRecord.analysis_text,
          profile_score: profileScore,
          total_recommendations: totalRecommendations,
          ai_provider: 'CrewAI',
          createdAt: analysisRecord.createdAt,
          meta: analysisRecord.metadata
        },
        linkedin_analysis: crewAIResult, // Include original CrewAI response
        analyzed_profile: crewAIResult.profile_analyzed,
        timestamp: new Date().toISOString()
      });

    } catch (crewAIError) {
      console.error('CrewAI service error:', crewAIError);
      
      // Update analysis record as failed
      analysisRecord.status = 'failed';
      analysisRecord.analysis_text = `Analysis failed: ${crewAIError.message}`;
      await analysisRecord.save();

      // Handle specific CrewAI errors
      if (crewAIError.response?.status === 400) {
        return res.status(400).json({
          success: false,
          error: crewAIError.response.data.detail || 'Invalid LinkedIn profile format',
          analysis_id: analysisRecord._id
        });
      }

      // Return fallback response with suggestions
      res.status(500).json({
        success: false,
        error: 'AI analysis service temporarily unavailable',
        analysis_id: analysisRecord._id,
        fallback_suggestions: [
          'Consider updating your profile summary to highlight key achievements',
          'Add more specific skills to your LinkedIn profile',
          'Connect with colleagues in your industry',
          'Share content related to your expertise',
          'Request recommendations from previous colleagues'
        ]
      });
    }

  } catch (error) {
    console.error('LinkedIn analysis endpoint error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to initiate LinkedIn profile analysis',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/users/linkedin-analysis-status/:analysisId
// @desc    Check analysis status by ID
// @access  Private
router.get('/linkedin-analysis-status/:analysisId', auth, async (req, res) => {
  try {
    const analysis = await Recommendation.findOne({
      _id: req.params.analysisId,
      user_id: req.user._id,
      recommendation_type: 'linkedin_analysis'
    });

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'Analysis not found'
      });
    }

    res.json({
      success: true,
      status: analysis.status,
      analysis: analysis.status === 'completed' ? analysis : null,
      created_at: analysis.createdAt,
      updated_at: analysis.updatedAt
    });

  } catch (error) {
    console.error('Get analysis status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analysis status'
    });
  }
});





// @route   POST /api/users/analyze-linkedin
// @desc    Analyze user's LinkedIn profile and store results
// @access  Private
// NOTE: This route is a duplicate and should be removed if another /analyze-linkedin route exists above.
// Remove this block if you already have a working /analyze-linkedin route.

// @route   POST /api/users/:userId/get-inspiration
// @desc    Get career inspiration from another user's profile
// @access  Private
router.post('/:userId/get-inspiration', auth, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId).populate('skills');
    const currentUser = await User.findById(req.user._id).populate('skills');
        const crewai_servicesetting = await Settings.findOne({ name: 'crewai_service' });
    const crewaiurl = crewai_servicesetting?.key;
    
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Call CrewAI service for inspiration analysis
    const CREWAI_URL = crewaiurl

    let payload = {
      current_user: {
        id: currentUser._id.toString(),
        name: currentUser.name,
        role: currentUser.role,
        department: currentUser.department,
        skills: currentUser.skills,
        experience_level: currentUser.experience_level
      },
      inspiration_user: {
        id: targetUser._id.toString(),
        name: targetUser.name,
        role: targetUser.role,
        department: targetUser.department,
        skills: targetUser.skills,
        experience_level: targetUser.experience_level,
        linkedinProfile: targetUser.linkedinProfile,
        twitterProfile: targetUser.twitterProfile
      }
    }

    console.log('Payload for CrewAI:', payload);
    
    const inspirationResponse = await axios.post(`${CREWAI_URL}/generate-career-inspiration`, {
      current_user: {
        id: currentUser._id.toString(),
        name: currentUser.name,
        role: currentUser.role,
        department: currentUser.department,
        skills: currentUser.skills,
        experience_level: currentUser.experience_level
      },
      inspiration_user: {
        id: targetUser._id.toString(),
        name: targetUser.name,
        role: targetUser.role,
        department: targetUser.department,
        skills: targetUser.skills,
        experience_level: targetUser.experience_level,
        linkedinProfile: targetUser.linkedinProfile,
        twitterProfile: targetUser.twitterProfile
      }
    }, {
      headers: {
        'Authorization': req.header('Authorization'),
        'Content-Type': 'application/json'
      },
      timeout: 45000
    });

    // Store the inspiration recommendation
    // If the recommendations field is too large (>2000 chars), truncate or summarize
    let recommendationsData = inspirationResponse.data.recommendations;
    let analysisText = inspirationResponse.data.analysis_result?.analysis_text || `Career inspiration from ${targetUser.name}`;

    // Convert recommendations to string if it's an object/array
    let recommendationsString = typeof recommendationsData === 'string'
      ? recommendationsData
      : JSON.stringify(recommendationsData);

    if (recommendationsString.length > 2000) {
      // Truncate and add a note
      recommendationsString = recommendationsString.slice(0, 2000) + '... [truncated]';
      analysisText += ' (Note: Recommendations truncated due to length)';
    }

    const recommendation = new Recommendation({
      user_id: req.user._id,
      source_user_id: targetUser._id,
      recommendation_type: 'career_inspiration',
      recommendations: recommendationsString,
      analysis_text: analysisText,
      ai_provider: 'Open AI'
    });

    await recommendation.save();

    res.json({
      success: true,
      inspiration_analysis: inspirationResponse.data,
      inspiration_source: {
        name: targetUser.name,
        role: targetUser.role,
        department: targetUser.department
      },
      recommendation_id: recommendation._id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Career inspiration error:', error);
    res.status(500).json({
      success: false,
      error: 'Career inspiration service temporarily unavailable'
    });
  }
});

// @route   GET /api/users/dashboard-data
// @desc    Get dashboard data including latest recommendations and all users
// @access  Private
// router.get('/dashboard-data', auth, async (req, res) => {
//   try {
//     // Get latest LinkedIn recommendation
//     const latestLinkedInRec = await Recommendation.findOne({
//       user_id: req.user._id,
//       recommendation_type: 'linkedin_analysis'
//     }).sort({ createdAt: -1 });

//     // Get latest career inspiration
//     const latestInspiration = await Recommendation.findOne({
//       user_id: req.user._id,
//       recommendation_type: 'career_inspiration'
//     }).sort({ createdAt: -1 }).populate('source_user_id', 'name role department');

//     // Get all users for sidebar (excluding current user)
//     const allUsers = await User.find({ 
//       _id: { $ne: req.user._id },
//       isActive: true 
//     }).select('name role department linkedinProfile twitterProfile avatar').limit(20);

//     res.json({
//       success: true,
//       latest_linkedin_recommendation: latestLinkedInRec,
//       latest_inspiration: latestInspiration,
//       all_users: allUsers,
//       total_users: allUsers.length
//     });

//   } catch (error) {
//     console.error('Dashboard data error:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to fetch dashboard data'
//     });
//   }
// });







// @route   POST /api/users/:userId/connect
// @desc    Send connection request to another user
// @access  Private
router.post('/:userId/connect', auth, async (req, res) => {
  try {
    const recipientId = req.params.userId;
    const requesterId = req.user._id;

    // Check if trying to connect to self
    if (recipientId === requesterId.toString()) {
      return res.status(400).json({
        success: false,
        error: 'Cannot connect to yourself'
      });
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if connection already exists
    const existingConnection = await Connection.findOne({
      $or: [
        { requester: requesterId, recipient: recipientId },
        { requester: recipientId, recipient: requesterId }
      ]
    });

    if (existingConnection) {
      return res.status(400).json({
        success: false,
        error: 'Connection request already exists',
        status: existingConnection.status
      });
    }

    // Create new connection request
    const connection = new Connection({
      requester: requesterId,
      recipient: recipientId,
      message: req.body.message || '',
      connection_type: req.body.connection_type || 'general'
    });

    await connection.save();

    // Populate the connection with user details
    await connection.populate([
      { path: 'requester', select: 'name role department avatar' },
      { path: 'recipient', select: 'name role department avatar' }
    ]);

    res.status(201).json({
      success: true,
      message: `Connection request sent to ${recipient.name}`,
      connection
    });

  } catch (error) {
    console.error('Connection request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send connection request'
    });
  }
});

// @route   GET /api/users/connections
// @desc    Get user's connections and pending requests
// @access  Private
router.get('/connections', auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get sent requests
    const sentRequests = await Connection.find({ requester: userId })
      .populate('recipient', 'name role department avatar')
      .sort({ createdAt: -1 });

    // Get received requests
    const receivedRequests = await Connection.find({ recipient: userId })
      .populate('requester', 'name role department avatar')
      .sort({ createdAt: -1 });

    // Get accepted connections
    const connections = await Connection.find({
      $or: [
        { requester: userId, status: 'accepted' },
        { recipient: userId, status: 'accepted' }
      ]
    })
    .populate('requester', 'name role department avatar')
    .populate('recipient', 'name role department avatar')
    .sort({ updatedAt: -1 });

    res.json({
      success: true,
      sent_requests: sentRequests,
      received_requests: receivedRequests,
      connections: connections,
      stats: {
        total_connections: connections.length,
        pending_sent: sentRequests.filter(r => r.status === 'pending').length,
        pending_received: receivedRequests.filter(r => r.status === 'pending').length
      }
    });

  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch connections'
    });
  }
});

// @route   PATCH /api/users/connections/:connectionId
// @desc    Accept or reject connection request
// @access  Private
router.patch('/connections/:connectionId', auth, async (req, res) => {
  try {
    const { status } = req.body; // 'accepted' or 'rejected'
    const connectionId = req.params.connectionId;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Use "accepted" or "rejected"'
      });
    }

    const connection = await Connection.findById(connectionId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Connection request not found'
      });
    }

    // Check if user is the recipient
    if (connection.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You can only respond to requests sent to you'
      });
    }

    connection.status = status;
    await connection.save();

    await connection.populate([
      { path: 'requester', select: 'name role department avatar' },
      { path: 'recipient', select: 'name role department avatar' }
    ]);

    res.json({
      success: true,
      message: `Connection request ${status}`,
      connection
    });

  } catch (error) {
    console.error('Update connection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update connection request'
    });
  }
});

// Update the existing dashboard-data route to include connection status
// router.get('/dashboard-data', auth, async (req, res) => {
//   try {
//     // Get latest LinkedIn recommendation
//     const latestLinkedInRec = await Recommendation.findOne({
//       user_id: req.user._id,
//       recommendation_type: 'linkedin_analysis'
//     }).sort({ createdAt: -1 });

//     // Get latest career inspiration
//     const latestInspiration = await Recommendation.findOne({
//       user_id: req.user._id,
//       recommendation_type: 'career_inspiration'
//     }).sort({ createdAt: -1 }).populate('source_user_id', 'name role department');

//     // Get all users for sidebar (excluding current user)
//     const allUsers = await User.find({ 
//       _id: { $ne: req.user._id },
//       isActive: true 
//     }).select('name role department linkedinProfile twitterProfile avatar').limit(20);

//     // Get connection statuses for these users
//     const userIds = allUsers.map(user => user._id);
//     const connections = await Connection.find({
//       $or: [
//         { requester: req.user._id, recipient: { $in: userIds } },
//         { recipient: req.user._id, requester: { $in: userIds } }
//       ]
//     });

//     // Create connection status map
//     const connectionMap = {};
//     connections.forEach(conn => {
//       const otherUserId = conn.requester.toString() === req.user._id.toString() 
//         ? conn.recipient.toString() 
//         : conn.requester.toString();
//       connectionMap[otherUserId] = {
//         status: conn.status,
//         type: conn.connection_type,
//         isRequester: conn.requester.toString() === req.user._id.toString()
//       };
//     });

//     // Add connection status to users
//     const usersWithConnectionStatus = allUsers.map(user => ({
//       ...user.toObject(),
//       connectionStatus: connectionMap[user._id.toString()] || null
//     }));

//     res.json({
//       success: true,
//       latest_linkedin_recommendation: latestLinkedInRec,
//       latest_inspiration: latestInspiration,
//       all_users: usersWithConnectionStatus,
//       total_users: allUsers.length
//     });

//   } catch (error) {
//     console.error('Dashboard data error:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to fetch dashboard data'
//     });
//   }
// });





// Update the existing dashboard-data route
router.get('/dashboard-data', auth, async (req, res) => {
  try {



    // const users = await User.find().select('name role department linkedinProfile twitterProfile avatar');
    // const connections2 = await Connection.find();

    // const connectionStatusMap = {};
    // connections2.forEach(conn => {
    //   connectionStatusMap[conn.requester.toString()] = conn.status;
    // });

    // const usersWithStatus = users.map(user => ({
    //   ...user.toObject(),
    //   status: connectionStatusMap[user._id.toString()] || null
    // }));



    // ... existing code for recommendations ...
        // Get latest LinkedIn recommendation
    const latestLinkedInRec = await Recommendation.findOne({
      user_id: req.user._id,
      recommendation_type: 'linkedin_analysis'
    }).sort({ createdAt: -1 });

    // Get latest career inspiration
    const latestInspiration = await Recommendation.findOne({
      user_id: req.user._id,
      recommendation_type: 'career_inspiration'
    }).sort({ createdAt: -1 }).populate('source_user_id', 'name role department');


    // Get all users for sidebar (excluding current user)
    const allUsers = await User.find({ 
      _id: { $ne: req.user._id },
      isActive: true 
    }).select('name role department linkedinProfile twitterProfile avatar').limit(20);

    // Get connection statuses for these users - UPDATED TO INCLUDE CONNECTION ID
    const userIds = allUsers.map(user => user._id);
    const connections = await Connection.find({
      $or: [
        { requester: req.user._id, recipient: { $in: userIds } },
        { recipient: req.user._id, requester: { $in: userIds } }
      ]
    });

    // Create connection status map with connection ID
    const connectionMap = {};
    connections.forEach(conn => {
      const otherUserId = conn.requester.toString() === req.user._id.toString() 
        ? conn.recipient.toString() 
        : conn.requester.toString();
      connectionMap[otherUserId] = {
        connectionId: conn._id.toString(), // ADD THIS LINE
        status: conn.status,
        type: conn.connection_type,
        isRequester: conn.requester.toString() === req.user._id.toString(),
        message: conn.message,
        createdAt: conn.createdAt
      };
    });

    // Add connection status to users
    const usersWithConnectionStatus = allUsers.map(user => ({
      ...user.toObject(),
      
      connectionStatus: connectionMap[user._id.toString()] || null
    }));

    console.log('User with connection status:', usersWithConnectionStatus);

    res.json({
      success: true,
      latest_linkedin_recommendation: latestLinkedInRec,
      latest_inspiration: latestInspiration,
      all_users: usersWithConnectionStatus,
      // usersWithStatus: usersWithStatus || [],
      total_users: allUsers.length
    });

  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
});



// routes/users.js
// const axios = require('axios');


router.post('/compare-skills', auth, async (req, res) => {
  try {
    const { compareTo } = req.body;
      const perplexitySetting = await Settings.findOne({ name: 'perplexity_api' });
    const perplexityKey = perplexitySetting?.key;

    if (!compareTo) {
      return res.status(400).json({ error: 'Missing compareTo user ID.' });
    }

    const [userData, targetData] = await Promise.all([
      User.findById(req.user._id).select('name'),
      User.findById(compareTo).select('name')
    ]);

    if (!userData || !targetData) {
      return res.status(404).json({ error: 'User(s) not found.' });
    }

    const [userSkills, targetSkills] = await Promise.all([
      Skill.find({ user: req.user._id }),
      Skill.find({ user: compareTo })
    ]);

    const mapSkills = (skills) =>
      skills?.length > 0
        ? skills.map((s) => ({
            name: s.name,
            level: s.level || 'Intermediate',
            progress: s.progress || 0,
            years_of_experience: s.years_of_experience || 0
          }))
        : [];

    const formattedUserSkills = mapSkills(userSkills);
    const formattedTargetSkills = mapSkills(targetSkills);

    const userSkillBlock =
      formattedUserSkills.length > 0
        ? JSON.stringify(formattedUserSkills, null, 2)
        : '[] // No skills recorded';

    const targetSkillBlock =
      formattedTargetSkills.length > 0
        ? JSON.stringify(formattedTargetSkills, null, 2)
        : '[] // No skills recorded';

    const prompt = `
Compare the professional capabilities of two users based on their skill records.

User A:
Name: ${userData.name}
Skills: ${userSkillBlock}

User B:
Name: ${targetData.name}
Skills: ${targetSkillBlock}

Instructions:
- You may say "User has not recorded any skills" if applicable.
- If only one has skills, suggest how the other may start.
- If both have no skills, suggest general learning plans.

Return only valid JSON:
{
  "strongerIn": [ { "skill": "React", "advantage": "22%", "comment": "..." } ],
  "weakerIn": [ { "skill": "Python", "delta": "-30%", "suggestion": "..." } ],
  "flexWorthy": [ { "skill": "JavaScript", "level": "Expert", "reason": "..." } ],
  "summary": "..."
}
`;

    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: 'You are a career coach. Respond only with JSON; no extra text.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      },
      {
        headers: {
          Authorization: `Bearer ${perplexityKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiText = response.data?.choices?.[0]?.message?.content || '{}';
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : aiText);

    return res.json({
      user: { id: userData._id, name: userData.name },
      target: { id: targetData._id, name: targetData.name },
      ...parsed
    });
  } catch (error) {
    console.error('Compare skills error:', error.message);
    if (error.response?.data) {
      console.error('AI error:', error.response.data);
    }
    res.status(500).json({ error: 'Failed to compare skills using Perplexity AI.' });
  }
});




// routes/flexwall.js

router.post('/flex', auth, async (req, res) => {
  try {
    const { skill, progress } = req.body;
    const today = new Date(); today.setHours(0,0,0,0);
    let flex = await FlexWall.findOneAndUpdate(
      { user: req.user._id, skill, date: today },
      { progress }, { upsert: true, new: true }
    );
    res.json({ success: true, flex });
  } catch (e) {
    res.status(500).json({ error: 'Failed to record flex' });
  }
});

// Route (get today flexes): /api/flexwall/today
router.get('/today', auth, async (req, res) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const flexes = await FlexWall.find({ date: today }).populate('user', 'name avatar');
  res.json(flexes);
});



module.exports = router;
