// fixIndexes.js — Run once to drop stale unique indexes
// Usage: node fixIndexes.js

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const mongoose = require('mongoose');

async function fix() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const col = db.collection('employees');

    // List all indexes
    const indexes = await col.indexes();
    console.log('\nCurrent indexes on employees collection:');
    indexes.forEach(idx => {
      console.log(' -', idx.name, '| keys:', JSON.stringify(idx.key), '| unique:', !!idx.unique);
    });

    // Drop unique indexes on username and email
    let dropped = 0;
    for (const idx of indexes) {
      const keys = Object.keys(idx.key || {});
      const isUniqueUsername = idx.unique && keys.includes('username');
      const isUniqueEmail    = idx.unique && keys.includes('email');

      if (isUniqueUsername || isUniqueEmail) {
        try {
          await col.dropIndex(idx.name);
          console.log('\n✅ DROPPED index:', idx.name, '(', JSON.stringify(idx.key), ')');
          dropped++;
        } catch (e) {
          console.log('\n⚠️  Could not drop', idx.name, ':', e.message);
        }
      }
    }

    if (dropped === 0) {
      console.log('\n✅ No stale unique indexes found — already clean.');
    } else {
      console.log(`\n✅ Done. Dropped ${dropped} index(es).`);
    }

    // Verify
    const after = await col.indexes();
    console.log('\nIndexes after fix:');
    after.forEach(idx => {
      console.log(' -', idx.name, '| unique:', !!idx.unique);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected.');
  }
}

fix();
