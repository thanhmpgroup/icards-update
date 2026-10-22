const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const { protect } = require('../middleware/auth.middleware');

// Trang chủ: đánh giá đã duyệt + điểm trung bình
router.get('/public', reviewController.getPublicReviews);
// Khách đăng nhập: xem / viết / sửa đánh giá của mình (sửa xong chờ duyệt lại)
router.get('/me', protect, reviewController.getMyReview);
router.post('/', protect, reviewController.upsertMyReview);

module.exports = router;
