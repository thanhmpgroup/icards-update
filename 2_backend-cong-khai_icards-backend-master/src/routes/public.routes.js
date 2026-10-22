// BE/routes/public.routes.js (Tệp mới)
const express = require('express');
const router = express.Router();
const Invitation = require('../models/invitation.model');

// Import các tệp route dành cho người dùng công khai
const pageRoutes = require('./page.routes');
const pageCategoryRoutes = require('./pageCategory.routes');
const fontRoutes = require('./font.routes');
const invitationTemplateRoutes = require('./invitationTemplate.routes');
const topicRoutes = require('./topic.routes');
const templateBlockService = require('../services/templateBlock.service');
const { renderHtmlWithMeta } = require('../services/seoRenderer.service');
const catchAsync = require('../utils/catchAsync');
const templateBlockController = require('../controllers/templateBlock.controller');

router.get('/template-blocks', catchAsync(async (req, res, next) => {
    // Tái sử dụng lại service đã viết
    const blocks = await templateBlockService.getAllBlocks();

    // Chỉ trả về các khối đang được bật (isActive: true) và các mẫu thiệp đang hiển thị bên trong
    const activeBlocks = blocks
        .filter(block => block.isActive)
        .map((block) => {
            const data = block.toObject();
            data.templates = (data.templates || []).filter(template => template && template.isActive);
            return data;
        });

    res.status(200).json({
        success: true,
        data: activeBlocks
    });
}));

// Route phục vụ trang xem chi tiết toàn bộ thiệp của bộ sưu tập đó khi click vào
router.get('/template-blocks/slug/:slug', templateBlockController.getBlockBySlug);
// Gắn các route cụ thể vào router công khai này
// - Yêu cầu đến /public/pages sẽ được xử lý bởi pageRoutes
// - Yêu cầu đến /public/page-categories sẽ được xử lý bởi pageCategoryRoutes
// v.v.
router.use('/pages', pageRoutes);
router.use('/page-categories', pageCategoryRoutes);
router.use('/fonts', fontRoutes);
router.use('/invitation-templates', invitationTemplateRoutes);
router.use('/topics', topicRoutes);

// HTML có thẻ meta cho bot chia sẻ (Zalo/Facebook): dùng chung bộ render SEO với trang /events/:id
router.get('/events/:eventId', (req, res) => renderHtmlWithMeta(req, res, `/events/${encodeURIComponent(req.params.eventId)}`));

router.get('/seo-invitation/:slug', catchAsync(async (req, res, next) => {
    const invitation = await Invitation.findOne({ slug: req.params.slug }).select('_id').lean();
    return renderHtmlWithMeta(req, res, invitation ? `/events/${invitation._id}` : '/khong-tim-thay');
}));

module.exports = router;
