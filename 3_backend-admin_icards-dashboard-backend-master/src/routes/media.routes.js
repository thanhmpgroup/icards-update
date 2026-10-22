// src/routes/media.routes.js
const express = require('express');
const mediaController = require('../controllers/media.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');

const router = express.Router();

// Chỉ cần khai báo middleware ở đây một lần cho toàn bộ file
router.use(protect);
router.use(authorize('admin', 'designer', 'marketing'));

router.get('/', mediaController.getAllMedia);
router.post('/upload', upload.single('file'), mediaController.uploadMedia);
router.delete('/:id', mediaController.deleteMedia);

module.exports = router;