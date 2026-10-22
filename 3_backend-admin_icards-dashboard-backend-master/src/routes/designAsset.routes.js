// AdminTrainData/AdminBE/routes/designAsset.routes.js

const express = require('express');
const router = express.Router();
const { getDesignAssets, createDesignAsset, deleteDesignAsset, seedInitialAssets, bulkCreateAssets, bulkDeleteAssets } = require('../controllers/designAsset.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { upload, resizeImage, uploadImageToCloudflare } = require('../middleware/upload.middleware');

router.get('/', getDesignAssets);

router.post(
    '/', 
    protect, 
    authorize('admin'), 
    upload.single('image'), 
    resizeImage, 
    uploadImageToCloudflare,
    createDesignAsset 
);

// Route để xử lý upload hàng loạt
router.post(
    '/bulk-import',
    protect,
    authorize('admin'),
    upload.any(), // Chấp nhận mọi field name (file_0, file_1, images...)
    bulkCreateAssets
);

router.delete(
    '/bulk-delete',
    protect,
    authorize('admin'),
    bulkDeleteAssets
);

router.delete('/:id', protect, authorize('admin'), deleteDesignAsset);
// Trước đây không cần đăng nhập và XÓA TOÀN BỘ tài sản thiết kế rồi thay bằng 14 ảnh mẫu.
router.post('/seed', protect, authorize('admin'), seedInitialAssets);

module.exports = router;