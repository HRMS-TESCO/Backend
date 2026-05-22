// =============================================================
// Asset Routes
// =============================================================
const express = require('express');
const router = express.Router();
const {
  getAssets,
  getAssetsGroupedByEmployee,
  getAsset,
  createAsset,
  updateAsset,
  deleteAsset,
  assignAsset,
  unassignAsset,
  getAssetEnums,
} = require('../controllers/assetController');

// Collection
router.route('/').get(getAssets).post(createAsset);

// Grouped view (this is the one the UI primarily uses)
router.get('/grouped', getAssetsGroupedByEmployee);

// Enums (dropdown data)
router.get('/meta/enums', getAssetEnums);

// Single asset
router.route('/:id').get(getAsset).put(updateAsset).delete(deleteAsset);

// Assign / Unassign
router.patch('/:id/assign', assignAsset);
router.patch('/:id/unassign', unassignAsset);

module.exports = router;
