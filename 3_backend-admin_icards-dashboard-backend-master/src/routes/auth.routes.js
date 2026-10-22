// AdminTrainData/AdminBE/routes/auth.routes.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { loginLimiterByIp, loginLimiterByAccount, passwordResetLimiter } = require('../middleware/rateLimit');

// Các route này sẽ được gắn vào `/api/v1/admin/auth`
router.post('/login', loginLimiterByIp, loginLimiterByAccount, authController.login);
// Tài khoản quản trị do admin tạo trong "Quản lý Người dùng"; không mở đăng ký công khai.
router.post('/register', authController.register);
router.post('/forgot-password', passwordResetLimiter, authController.forgotPassword);
router.patch('/reset-password/:token', passwordResetLimiter, authController.resetPassword);

// Logout chỉ xóa cookie, không cần token còn hạn (token hết hạn vẫn phải đăng xuất được)
router.post('/logout', authController.logout);

module.exports = router;
