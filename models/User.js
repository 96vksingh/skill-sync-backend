const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
    trim: true
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  avatar: {
    type: String,
    default: ''
  },
  // NEW FIELDS ADDED
  linkedinProfile: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        // Allow empty string or valid LinkedIn URL
        if (!v) return true;
        return /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?$/.test(v);
      },
      message: 'Please enter a valid LinkedIn profile URL (e.g., https://linkedin.com/in/username)'
    }
  },
  twitterProfile: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        // Allow empty string or valid Twitter URL/username
        if (!v) return true;
        return /^(https?:\/\/)?(www\.)?(twitter\.com\/|x\.com\/)?@?[a-zA-Z0-9_]+\/?$/.test(v);
      },
      message: 'Please enter a valid Twitter profile (e.g., @username or https://twitter.com/username)'
    }
  },
  skills: [String], // Array of skill names
  // skills: [{
  //   // type: mongoose.Schema.Types.ObjectId,
  //   // ref: 'Skill'
  // }],
  interests: [String],
  experience_level: {
    type: String,
    enum: ['Junior', 'Mid', 'Senior', 'Lead', 'Executive'],
    default: 'Mid'
  },
  availability: {
    type: String,
    enum: ['Available', 'Busy', 'Not Available'],
    default: 'Available'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model('User', userSchema);
