// Load .env only in development - on Render, env vars are injected by the platform
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express        = require('express');
const cors           = require('cors');
const morgan         = require('morgan');
const connectDB      = require('./config/db');
const { startKeepAlive } = require('./keepAlive');
const { importMobileUsers } = require('./migrations/importFromMobile');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'HRM Backend API is running',
    modules: ['dashboard', 'departments', 'designations', 'employees', 'attendance', 'reports', 'access-management', 'announcements', 'assets'],
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth',              require('./routes/authRoutes'));
app.use('/api/dashboard',         require('./routes/dashboardRoutes'));
app.use('/api/departments',       require('./routes/departmentRoutes'));
app.use('/api/designations',      require('./routes/designationRoutes'));
app.use('/api/employees',         require('./routes/employeeRoutes'));
app.use('/api/attendance',        require('./routes/attendanceRoutes'));
app.use('/api/reports',           require('./routes/reportRoutes'));
app.use('/api/access-management', require('./routes/accessManagementRoutes'));
app.use('/api/announcements',     require('./routes/announcementRoutes'));
app.use('/api/assets',            require('./routes/assetRoutes'));
app.use('/api/complaints',        require('./routes/complaintRoutes'));
app.use('/api/leave-requests',    require('./routes/leaveRequestRoutes'));
app.use('/api/allowances',        require('./routes/allowanceRoutes'));
app.use('/api/payroll',           require('./routes/payrollRoutes'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 8000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\nHRM Backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    console.log(`  API base: http://localhost:${PORT}/api\n`);

    // Self-ping every 10 minutes so the service doesn't sleep on free
    // hosting tiers. Disable with KEEP_ALIVE=false.
    startKeepAlive(PORT);

    // ─── Mobile sync self-check ────────────────────────────────────
    // Verify the HRMS backend can actually talk to the mobile backend's
    // admin API. If this fails, employees created in HRMS won't be able
    // to log into the mobile app — surface that as a loud warning in
    // the startup logs so the admin notices.
    setTimeout(async () => {
      const mobileApi = (process.env.MOBILE_API_URL || 'https://backend-emqy.onrender.com').replace(/\/+$/, '');
      const secret    =  process.env.MOBILE_ADMIN_SECRET || '';
      if (!secret) {
        console.warn('');
        console.warn('╔════════════════════════════════════════════════════════════════════╗');
        console.warn('║  ⚠  MOBILE_ADMIN_SECRET is NOT SET in HRMS .env                    ║');
        console.warn('║                                                                    ║');
        console.warn('║  Employees you create in HRMS will be saved here, but they will    ║');
        console.warn('║  NOT be able to log into the mobile ERM app because the mobile     ║');
        console.warn('║  User record was never created.                                    ║');
        console.warn('║                                                                    ║');
        console.warn('║  Fix:                                                              ║');
        console.warn('║    1. Open F:\\HRMS\\TescoHRMS\\Backend\\.env                          ║');
        console.warn('║    2. Add:    MOBILE_API_URL=https://backend-emqy.onrender.com     ║');
        console.warn('║    3. Add:    MOBILE_ADMIN_SECRET=<same value as Render ADMIN_SECRET>');
        console.warn('║    4. Restart this server.                                         ║');
        console.warn('╚════════════════════════════════════════════════════════════════════╝');
        console.warn('');
        return;
      }
      if (typeof fetch !== 'function') {
        console.warn('[mobile-sync] global fetch unavailable — need Node 18+');
        return;
      }
      try {
        const r = await fetch(`${mobileApi}/api/auth/admin/users?limit=1`, {
          headers: { 'x-admin-secret': secret },
        });
        if (r.status === 401) {
          console.warn('');
          console.warn('╔════════════════════════════════════════════════════════════════════╗');
          console.warn('║  ⚠  MOBILE_ADMIN_SECRET is WRONG — mobile backend rejected it.     ║');
          console.warn('║     Value in HRMS .env doesn\'t match ADMIN_SECRET on Render.       ║');
          console.warn('║     Employees created in HRMS won\'t be able to log into mobile.    ║');
          console.warn('╚════════════════════════════════════════════════════════════════════╝');
          console.warn('');
        } else if (!r.ok) {
          console.warn(`[mobile-sync] Mobile backend returned ${r.status} during self-check`);
        } else {
          const j = await r.json().catch(() => ({}));
          console.log(`[mobile-sync] ✓ Mobile backend reachable; ${j.total ?? '?'} users in mobile DB`);
        }
      } catch (err) {
        console.warn(`[mobile-sync] Cannot reach ${mobileApi}: ${err.message}`);
      }
    }, 6_000);  // a beat after startup so the keepAlive line lands first

    // Auto-migrate mobile users into the HRMS Employee collection so any
    // employee created via the old admin.html (or any direct mobile-DB
    // tool) shows up in the Employee List immediately. Idempotent —
    // already-imported users are skipped. Runs 5s after startup so the
    // listen log lands first. Disable with IMPORT_MOBILE_ON_STARTUP=false.
    if (process.env.IMPORT_MOBILE_ON_STARTUP !== 'false') {
      setTimeout(async () => {
        try {
          console.log('[IMPORT] Auto-running mobile→HRMS employee migration…');
          const result = await importMobileUsers();
          if (result.success) {
            console.log(`[IMPORT] ✓ ${result.message} (${result.errors.length} errors)`);
            if (result.errors.length > 0) {
              console.warn('[IMPORT] errors:', JSON.stringify(result.errors.slice(0, 5), null, 2));
            }
          } else {
            console.warn(`[IMPORT] ✗ ${result.message}`);
          }
        } catch (err) {
          console.warn(`[IMPORT] startup migration failed: ${err.message}`);
        }
      }, 5_000);
    }
  });
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err.message);
  process.exit(1);
});
