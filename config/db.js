const mongoose = require('mongoose');

/**
 * Connects to MongoDB using MONGO_URI from environment.
 * Exits the process on failure so the server doesn't run in a broken state.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
