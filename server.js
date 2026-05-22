// =============================================================
// HRMS Assets Page — Backend Entry Point
// =============================================================
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const connectDB = require('./config/db');
const employeeRoutes = require('./routes/employeeRoutes');
const assetRoutes = require('./routes/assetRoutes');
const statsRoutes = require('./routes/statsRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();
const PORT = process.env.PORT || 5000;

// ---- Connect to MongoDB ----
connectDB();

// ---- Global middleware ----
app.use(
  cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true,
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ---- Health check ----
app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'HRMS Assets API is running',
    version: '1.0.0',
  });
});

// ---- API routes ----
app.use('/api/employees', employeeRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/stats', statsRoutes);

// ---- Error handling ----
app.use(notFound);
app.use(errorHandler);

// ---- Start server ----
app.listen(PORT, () => {
  console.log(
    `\nHRMS Assets API running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`
  );
  console.log(`   http://localhost:${PORT}`);
});
