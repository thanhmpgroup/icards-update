// BE/routes/user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { upload, resizeImage, uploadImageToCloudflare } = require('../middleware/upload.middleware');
const {
    validatePasswordChange 
} = require('../utils/validators');

router.get('/', protect, authorize('admin'), userController.getUsers);
router.get('/me', protect, userController.getMe);
router.get('/me/personal-images', protect, userController.getMyPersonalImages);

router.put('/me', protect, userController.updateMe);
router.put('/me/change-password', protect, validatePasswordChange, userController.changePassword);
router.put('/me/avatar', protect, upload.single('avatar'), resizeImage, uploadImageToCloudflare, userController.updateAvatar);

router.post('/me/upload-images', protect, upload.array('images', 10), userController.uploadUserImages);

// Nhạc nền và font khách tự tải lên (kiểm tra nội dung tệp trong controller, không tin đuôi tên)
const multer = require('multer');
const mediaUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } });
router.post('/me/upload-audio', protect, mediaUpload.single('file'), userController.uploadUserAudio);
router.post('/me/upload-font', protect, mediaUpload.single('file'), userController.uploadUserFont);
router.get('/me/fonts', protect, userController.getMyFonts);

router.get('/:id', protect, authorize('admin'), userController.getUser);

module.exports = router;