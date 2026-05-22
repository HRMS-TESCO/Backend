// =============================================================
// Stats Controller — powers the 8 cards at the top of the UI:
// Total Assets | Employees with Assets | Laptops | Monitors |
// PCs | Mouses | Keyboards | ID Cards
// =============================================================
const asyncHandler = require('express-async-handler');
const Asset = require('../models/Asset');
const Employee = require('../models/Employee');

// @desc    Get stats for the dashboard cards
// @route   GET /api/stats
// @access  Public
const getAssetStats = asyncHandler(async (_req, res) => {
  const [
    totalAssets,
    typeAgg,
    employeesWithAssets,
    totalEmployees,
  ] = await Promise.all([
    Asset.countDocuments({}),
    Asset.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
    Asset.distinct('employee', { employee: { $ne: null } }),
    Employee.countDocuments({}),
  ]);

  // Convert aggregate result to a quick lookup
  const byType = typeAgg.reduce((acc, t) => {
    acc[t._id] = t.count;
    return acc;
  }, {});

  res.json({
    success: true,
    data: {
      totalAssets,
      employeesWithAssets: employeesWithAssets.length,
      totalEmployees,
      laptops: byType['Laptop'] || 0,
      monitors: byType['Monitor'] || 0,
      pcs: byType['PC'] || 0,
      mouses: byType['Mouse'] || 0,
      keyboards: byType['Keyboard'] || 0,
      idCards: byType['ID Card'] || 0,
    },
  });
});

// @desc    Breakdown by condition (extra: useful for charts later)
// @route   GET /api/stats/conditions
// @access  Public
const getConditionStats = asyncHandler(async (_req, res) => {
  const agg = await Asset.aggregate([
    { $group: { _id: '$condition', count: { $sum: 1 } } },
  ]);
  const data = agg.reduce((acc, c) => {
    acc[c._id || 'Unknown'] = c.count;
    return acc;
  }, {});
  res.json({ success: true, data });
});

module.exports = { getAssetStats, getConditionStats };
