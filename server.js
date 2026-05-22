require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5001;

(async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(
      `Slim Announce+Payroll API running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`
    );
  });
})();

process.on('unhandledRejection', (err) => {
  console.error(`Unhandled Rejection: ${err.message}`);
  process.exit(1);
});
