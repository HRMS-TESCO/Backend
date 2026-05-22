// =============================================================
// Stats Routes
// =============================================================
const express = require('express');
const router = express.Router();
const {
  getAssetStats,
  getConditionStats,
} = require('../controllers/statsController');

router.get('/', getAssetStats);
router.get('/conditions', getConditionStats);

module.exports = router;
