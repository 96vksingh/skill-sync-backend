const express = require('express');
const axios = require('axios');
const Banner = require('../models/Banner');
const Settings = require('../models/Settings');
const auth = require('../middleware/auth');
const router = express.Router();

// Helper function to get current hot topics using Perplexity
async function getCurrentHotTopics() {
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const perplexitySetting = await Settings.findOne({ name: 'perplexity_api' });
    const perplexityKey = perplexitySetting?.key;
  
  const hotTopicsPrompt = `What are the top 3 trending topics in technology, AI, and professional development for ${currentMonth}? Focus on topics that would be relevant for professionals and career development. Please provide a brief description of each trend and why it's significant.`;

  try {
    const response = await axios.post('https://api.perplexity.ai/chat/completions', {
      model: 'sonar-pro',
      messages: [
        {
          role: 'system',
          content: 'You are a professional trends analyst. Provide concise, accurate information about current technology and professional development trends.'
        },
        {
          role: 'user',
          content: hotTopicsPrompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error fetching hot topics:', error);
    // Fallback topics
    return `Current trending topics in tech: 
    1. AI Integration in Workplace - Companies are rapidly adopting AI tools for productivity
    2. Remote Work Technologies - New collaboration tools and virtual office solutions
    3. Cybersecurity Awareness - Growing focus on data protection and privacy`;
  }
}

// Helper function to generate banner content using Perplexity
async function generateBannerContent(hotTopic) {
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const perplexitySetting = await Settings.findOne({ name: 'perplexity_api' });
const perplexityKey = perplexitySetting?.key;

  const bannerPrompt = `Create engaging banner content for a professional skills development platform for ${today}. 

  Hot Topic Context: ${hotTopic}

  Please provide:
  1. A catchy title (max 50 characters) that relates to the hot topic and professional growth
  2. A compelling description (max 150 characters) that motivates professionals
  3. Main content (max 300 words) that provides valuable insights about the hot topic and how professionals can leverage it for career growth
  4. Suggest a relevant professional stock image search term for the banner background

  Format your response as JSON:
  {
    "title": "...",
    "description": "...", 
    "content": "...",
    "image_search_term": "..."
  }`;

  try {
    const response = await axios.post('https://api.perplexity.ai/chat/completions', {
      model: 'sonar-pro',
      messages: [
        {
          role: 'system',
          content: 'You are a content creator specializing in professional development content. Always respond with valid JSON format.'
        },
        {
          role: 'user',
          content: bannerPrompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.8
    }, {
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json'
      }
    });

    const content = response.data.choices[0].message.content;
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error('Invalid JSON response from Perplexity');
  } catch (error) {
    console.error('Error generating banner content:', error);
    
    // Fallback content
    return {
      title: "🚀 Boost Your Career Today!",
      description: "Discover trending skills and opportunities in today's dynamic professional landscape",
      content: `Welcome to another day of professional growth! Today's focus: ${hotTopic}. Stay ahead of the curve by developing relevant skills and connecting with industry peers. Your career journey continues with every new challenge and opportunity.`,
      image_search_term: "professional development technology workspace"
    };
  }
}

// Helper function to fetch and store image as binary
async function fetchAndStoreImage(imageUrl) {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'SkillSync-Banner-Bot/1.0'
      }
    });

    return {
      binary: Buffer.from(response.data),
      contentType: response.headers['content-type'] || 'image/jpeg'
    };
  } catch (error) {
    console.error('Error fetching image:', error);
    
    // Create a simple colored banner as fallback
    const fallbackSvg = `
      <svg width="1200" height="300" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad1)"/>
        <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="48" font-weight="bold" 
              text-anchor="middle" dy=".3em" fill="white">SkillSync AI</text>
        <text x="50%" y="70%" font-family="Arial, sans-serif" font-size="24" 
              text-anchor="middle" dy=".3em" fill="rgba(255,255,255,0.9)">Professional Development Platform</text>
      </svg>
    `;
    
    return {
      binary: Buffer.from(fallbackSvg),
      contentType: 'image/svg+xml'
    };
  }
}

// Helper function to get free professional images
async function getProfessionalImageUrl(searchTerm) {
  console.log('Searching for professional image with term:', searchTerm);
  // Using Unsplash API for free professional images
  const unsplashSetting = await Settings.findOne({ name: 'unsplash_api' });
  const unsplashAccessKey = unsplashSetting?.key;

  if (unsplashAccessKey) {
    try {
      const response = await axios.get(`https://api.unsplash.com/search/photos`, {
        params: {
          query: searchTerm,
          per_page: 1,
          orientation: 'landscape',
          category: 'business',
          content_filter: 'high'
        },
        headers: {
          'Authorization': `Client-ID ${unsplashAccessKey}`
        }
      });

      if (response.data.results && response.data.results.length > 0) {
        console.log('Unsplash image found:', response.data.results[0].urls.regular);
        return response.data.results[0].urls.regular;
      }
    } catch (error) {
      console.error('Error fetching from Unsplash:', error);
    }
  }

  // Fallback to a professional placeholder service
  const width = 1200;
  const height = 300;
  const backgroundColor = '667eea';
  const textColor = 'ffffff';
  const text = encodeURIComponent('Professional Development');
  
  return `https://via.placeholder.com/${width}x${height}/${backgroundColor}/${textColor}?text=${text}`;
}

// @route   GET /api/banners/today
// @desc    Get today's banner or generate if doesn't exist
// @access  Private
router.get('/today', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day

    // Check if banner exists for today
    let todayBanner = await Banner.findOne({
      date: today,
      status: 'active'
    });

    // If banner doesn't exist, generate one
    if (!todayBanner) {
      console.log('No banner found for today, generating new one...');
      
      // Get current hot topics
      const hotTopics = await getCurrentHotTopics();
      
      // Generate banner content
      const bannerContent = await generateBannerContent(hotTopics);
      
      // Get professional image URL
      const imageUrl = await getProfessionalImageUrl(bannerContent.image_search_term);
      
      // Fetch and store image as binary
      const imageData = await fetchAndStoreImage(imageUrl);
      
      // Create new banner
      todayBanner = new Banner({
        date: today,
        title: bannerContent.title,
        description: bannerContent.description,
        content: bannerContent.content,
        hot_topic: hotTopics.substring(0, 200), // Truncate if too long
        image_url: imageUrl,
        image_binary: imageData.binary,
        image_content_type: imageData.contentType,
        meta: {
          source: 'Perplexity AI + Unsplash',
          topic_category: 'Professional Development',
          generated_at: new Date()
        }
      });

      await todayBanner.save();
      console.log('New banner generated and saved for today');
    }

    // Return banner without binary data (for security)
    const bannerResponse = {
      id: todayBanner._id,
      title: todayBanner.title,
      description: todayBanner.description,
      image_url: todayBanner.image_url,
      content: todayBanner.content,
      hot_topic: todayBanner.hot_topic,
      image_serve_url: `/api/banners/${todayBanner._id}/image`,
      metadata: todayBanner.metadata,
      created_at: todayBanner.createdAt
    };

    res.json({
      success: true,
      banner: bannerResponse
    });

  } catch (error) {
    console.error('Get today banner error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get today\'s banner'
    });
  }
});

// @route   GET /api/banners/:id/image
// @desc    Serve banner image from binary data
// @access  Public (images should be accessible)
router.get('/:id/image', async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner || !banner.image_binary) {
      return res.status(404).json({
        success: false,
        error: 'Banner image not found'
      });
    }

    // Set appropriate headers
    res.set({
      'Content-Type': banner.image_content_type,
      'Content-Length': banner.image_binary.length,
      'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
    });

    res.send(banner.image_binary);

  } catch (error) {
    console.error('Serve banner image error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve banner image'
    });
  }
});

// @route   POST /api/banners/generate
// @desc    Manually generate a new banner for today (admin only)
// @access  Private
router.post('/generate', auth, async (req, res) => {
  try {
    // You can add admin check here
    // if (req.user.role !== 'admin') return res.status(403).json({...});

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Delete existing banner for today
    await Banner.deleteOne({ date: today });

    // Generate new banner (same logic as /today route)
    const hotTopics = await getCurrentHotTopics();
    const bannerContent = await generateBannerContent(hotTopics);
    const imageUrl = await getProfessionalImageUrl(bannerContent.image_search_term);
    const imageData = await fetchAndStoreImage(imageUrl);
    
    const newBanner = new Banner({
      date: today,
      title: bannerContent.title,
      description: bannerContent.description,
      content: bannerContent.content,
      hot_topic: hotTopics.substring(0, 200),
      image_url: imageUrl,
      image_binary: imageData.binary,
      image_content_type: imageData.contentType,
      meta: {
        source: 'Perplexity AI + Unsplash',
        topic_category: 'Professional Development',
        generated_at: new Date()
      }
    });

    await newBanner.save();

    res.json({
      success: true,
      message: 'New banner generated successfully',
      banner: {
        id: newBanner._id,
        title: newBanner.title,
        description: newBanner.description,
        image_serve_url: `/api/banners/${newBanner._id}/image`
      }
    });

  } catch (error) {
    console.error('Generate banner error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate new banner'
    });
  }
});

// @route   GET /api/banners/history
// @desc    Get banner history (last 7 days)
// @access  Private
router.get('/history', auth, async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const banners = await Banner.find({
      date: { $gte: sevenDaysAgo }
    })
    .select('title description hot_topic metadata createdAt')
    .sort({ date: -1 })
    .limit(7);

    res.json({
      success: true,
      banners: banners
    });

  } catch (error) {
    console.error('Get banner history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get banner history'
    });
  }
});

module.exports = router;
