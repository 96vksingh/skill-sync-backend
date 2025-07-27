// Make sure you have a DB connection module
const mongoose = require('mongoose');
require('dotenv').config(); // for MONGODB_URI

const connectDB = require('../config/database'); // your Mongoose connection logic
const Settings = require('../models/Settings');  // your model

async function insertSetting() {
  await connectDB();

  const settingData = {
    name: 'perplexity_api',
    key: 'xxxxxx-xxxx-xxxx-xxxxxxxxxxxx', // replace with your actual key
    value: 'Optional description or metadata',
  };
  const settingData2 = {
    name: 'unsplash_api',
    key: 'xxxxxx-xxxx-xxxx-xxxxxxxxxxxx', // replace with your actual key
    value: 'Optional description or metadata',
  };

  try {
    const newSetting = await Settings.create(settingData);
    const newSettingw = await Settings.create(settingData2);
    console.log('✅ Setting inserted:', newSetting);
    console.log('✅ Setting inserted:', newSettingw);
  } catch (err) {
    console.error('❌ Error inserting setting:', err.message);
  } finally {
    mongoose.disconnect();
  }
}

insertSetting();
