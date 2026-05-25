const mongoose = require('mongoose');

// Set IST timezone (UTC + 5:30)
process.env.TZ = 'Asia/Kolkata';

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not defined in environment variables');
  }
  const conn = await mongoose.connect(process.env.MONGO_URI);
  console.log(`MongoDB Connected: ${conn.connection.host}`);
  console.log(`Database name   : ${conn.connection.name}`);

  // Drop old unique indexes on email and username that block duplicate employees
  try {
    const db = conn.connection.db;
    const empCol = db.collection('employees');
    const indexes = await empCol.indexes();
    for (const idx of indexes) {
      const keys = Object.keys(idx.key || {});
      // Drop unique index on email (employees can share/omit email)
      if (keys.includes('email') && idx.unique) {
        await empCol.dropIndex(idx.name);
        console.log('[DB] Dropped old unique index:', idx.name, '(email)');
      }
      // Drop unique index on username (route generates unique usernames now)
      if (keys.includes('username') && idx.unique) {
        await empCol.dropIndex(idx.name);
        console.log('[DB] Dropped old unique index:', idx.name, '(username)');
      }
    }
  } catch (e) {
    // Non-fatal — if already dropped, ignore
    console.warn('[DB] Index cleanup warning (non-fatal):', e.message);
  }

  mongoose.connection.on('error', (err) =>
    console.error('Mongo connection error:', err.message)
  );
  mongoose.connection.on('disconnected', () =>
    console.warn('Mongo disconnected')
  );
};

module.exports = connectDB;
