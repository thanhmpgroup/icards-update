const express = require('express');
const router = express.Router();
const { getDesignAssets, seedInitialAssets } = require('../controllers/designAsset.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Route chính để lấy tài nguyên. vd: GET /api/design-assets?type=icon
router.get('/', getDesignAssets);

// Route seed xóa toàn bộ tài nguyên hiện có: chỉ admin
router.post('/seed', protect, authorize('admin'), seedInitialAssets);

module.exports = router;
