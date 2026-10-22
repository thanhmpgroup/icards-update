const express = require('express');
const router = express.Router();
const { getInvitationTemplates, getTemplateById } = require('../controllers/invitationTemplate.controller');
const invitationTemplateController = require('../controllers/invitationTemplate.controller');

// Chỉ đọc + đếm lượt xem là công khai.
// Đã bỏ /seed (hàm rỗng, request treo), /reorder và /bulk-import (ai cũng sắp xếp / nhập mẫu thiệp được, không cần đăng nhập).
// Admin dùng /api/v1/admin/templates/reorder và /api/v1/admin/templates/bulk-import (có kiểm tra quyền).
router.get('/', getInvitationTemplates);
router.get('/:id', getTemplateById);
router.post('/:id/view', invitationTemplateController.incrementView);

module.exports = router;