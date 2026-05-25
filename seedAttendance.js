// seedAttendance.js — Add 1 month of attendance for one employee
// Usage: node seedAttendance.js
// Edit the config below before running

if (process.env.NODE_ENV !== 'production') require('dotenv').config();
const mongoose   = require('mongoose');
const Attendance = require('./models/Attendance');

// ─── EDIT THESE ───────────────────────────────────────────────
const EMPLOYEE_ID   = 'EMP-1001';          // employeeId from your DB
const EMPLOYEE_NAME = 'Suganya T';         // exact name as shown in employee list
const AVATAR        = 'ST';               // initials
const COLOR         = '#4CAA17';          // any hex color
const MONTH         = '2026-05';          // YYYY-MM  ← change to the month you want
// ─────────────────────────────────────────────────────────────

const STATUSES = ['On Time', 'On Time', 'On Time', 'Late', 'On Time', 'On Time', 'Absent'];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const [year, month] = MONTH.split('-').map(Number);
  const daysInMonth   = new Date(year, month, 0).getDate();

  const docs = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${MONTH}-${String(d).padStart(2, '0')}`;
    const day  = new Date(date).getDay(); // 0=Sun, 6=Sat
    if (day === 0 || day === 6) continue; // skip weekends

    // Rotate through statuses realistically
    const status = STATUSES[d % STATUSES.length];

    let checkIn  = '09:00';
    let checkOut = '18:00';
    let workHours = 9;

    if (status === 'Late')    { checkIn = '10:15'; workHours = 7.75; }
    if (status === 'Absent')  { checkIn = '';  checkOut = '';  workHours = 0; }
    if (status === 'Half Day'){ checkOut = '13:00'; workHours = 4; }

    // Skip if already exists for this employee+date
    docs.push({
      employeeId:   EMPLOYEE_ID,
      employeeName: EMPLOYEE_NAME,
      avatar:       AVATAR,
      color:        COLOR,
      date,
      checkIn,
      checkOut,
      workHours,
      status,
      isActive: true,
    });
  }

  // Remove existing logs for this employee in this month (clean re-seed)
  const startDate = `${MONTH}-01`;
  const endDate   = `${MONTH}-${String(daysInMonth).padStart(2, '0')}`;
  const del = await Attendance.deleteMany({
    employeeId: EMPLOYEE_ID,
    date: { $gte: startDate, $lte: endDate }
  });
  console.log(`Removed ${del.deletedCount} existing logs for ${EMPLOYEE_ID} in ${MONTH}`);

  const inserted = await Attendance.insertMany(docs);
  console.log(`✅ Inserted ${inserted.length} attendance records for ${EMPLOYEE_NAME} (${EMPLOYEE_ID}) — ${MONTH}`);
  console.log('\nBreakdown:');
  const counts = {};
  docs.forEach(d => { counts[d.status] = (counts[d.status] || 0) + 1; });
  Object.entries(counts).forEach(([s, c]) => console.log(`  ${s}: ${c} days`));

  await mongoose.disconnect();
  console.log('\nDone. Now open Reports → set date range to', startDate, 'to', endDate);
}

seed().catch(err => { console.error(err); process.exit(1); });
