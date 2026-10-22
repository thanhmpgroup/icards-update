const express = require('express');
const router = express.Router();
const { getInvitationTemplates, seedTemplates, getTemplateById, fixExistingTemplateShapes, incrementTemplateView } = require('../controllers/invitationTemplate.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.get('/', getInvitationTemplates);
// Các route ghi đè/xóa toàn bộ dữ liệu: chỉ admin
router.post('/seed', protect, authorize('admin'), seedTemplates);
router.get('/migrate/fix-shapes', protect, authorize('admin'), fixExistingTemplateShapes);
router.post('/:id/view', incrementTemplateView);
router.get('/:id', getTemplateById);
module.exports = router;
