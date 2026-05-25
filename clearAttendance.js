// clearAttendance.js — Delete ALL attendance logs from DB
// Usage: node clearAttendance.js

if (process.env.NODE_ENV !== 'production') require('dotenv').config();
const mongoose   = require('mongoose');
const Attendance = require('./models/Attendance');

async function clear() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const count = await Attendance.countDocuments();
  console.log(`Found ${count} attendance logs`);

  const result = await Attendance.deleteMany({});
  console.log(`✅ Deleted ${result.deletedCount} attendance logs`);

  await mongoose.disconnect();
  console.log('Done.');
}

clear().catch(err => { console.error(err); process.exit(1); });
