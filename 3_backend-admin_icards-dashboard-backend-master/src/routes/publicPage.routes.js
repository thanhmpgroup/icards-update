// src/routes/publicPage.routes.js
// /api/v1/pages: chỉ ĐỌC bài viết đã xuất bản, không cần đăng nhập.
// Thêm/sửa/xóa bài viết nằm ở /api/v1/admin/pages (cần đăng nhập, vai trò admin hoặc marketing).
const express = require('express');
const router = express.Router();
const pageController = require('../controllers/page.controller');

router.get('/', pageController.getPublishedPages);
router.get('/categories', pageController.getAllPageCategories);
router.get('/slug/:slug', pageController.getPublicPageBySlug);
router.get('/:id', pageController.getPublishedPageById);

module.exports = router;
