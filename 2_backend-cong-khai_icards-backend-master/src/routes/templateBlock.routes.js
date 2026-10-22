// File: src/routes/templateBlock.routes.js
const express = require('express');
const router = express.Router();
const templateBlockController = require('../controllers/templateBlock.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Thêm/sửa/xóa/sắp xếp khối trang chủ: chỉ tài khoản quản trị
const requireContentManager = [protect, authorize('admin', 'marketing')];

router.get('/template-blocks', templateBlockController.getPublicBlocks);
router.get('/slug/:slug', templateBlockController.getBlockBySlug);
router.route('/')
    .get(templateBlockController.getBlocks)
    .post(requireContentManager, templateBlockController.createBlock);

router.put('/reorder', requireContentManager, templateBlockController.reorderBlocks);

router.route('/:id')
    .get(templateBlockController.getBlockById)
    .put(requireContentManager, templateBlockController.updateBlock)
    .delete(requireContentManager, templateBlockController.deleteBlock);

// XUẤT RA ROUTER ĐỂ EXPRESS ĐỌC ĐƯỢC
module.exports = router;
