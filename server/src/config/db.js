const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/notifyx';
  await mongoose.connect(uri);
  console.log('[MongoDB] Connected');
};

module.exports = { connectDB };
