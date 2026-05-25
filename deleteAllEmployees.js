require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('./models/Employee');
const Department = require('./models/Department');
const Designation = require('./models/Designation');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const result = await Employee.deleteMany({});
  console.log('Deleted employees:', result.deletedCount);

  // Reset all department and designation counts to 0
  await Department.updateMany({}, { count: 0 });
  await Designation.updateMany({}, { count: 0 });
  console.log('Reset all department and designation counts to 0');

  mongoose.disconnect();
  console.log('Done');
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
