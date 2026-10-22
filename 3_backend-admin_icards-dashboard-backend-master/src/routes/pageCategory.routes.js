// AdminBE/routes/pageCategory.routes.js
const express = require('express');
const router = express.Router();
const pageCategoryController = require('../controllers/pageCategory.controller');

// --- 1. Các Route tĩnh (BẮT BUỘC ĐẶT TRÊN CÙNG) ---

// Kéo thả sắp xếp
router.route('/update-order')
    .put(pageCategoryController.updateCategoryOrder);

// Nút Seed / Clone dữ liệu mẫu
router.route('/seed')
    .post(pageCategoryController.seedCategories);

// --- 2. Route Gốc ---
router.route('/')
    .get(pageCategoryController.getAllCategories)
    .post(pageCategoryController.createCategory);

// --- 3. Route có Params động (/:id) ---
router.route('/:id')
    .put(pageCategoryController.updateCategory)
    .delete(pageCategoryController.deleteCategory);

module.exports = router;