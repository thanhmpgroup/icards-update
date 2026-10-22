// Backend-1/services/page.service.js
const Page = require('../models/page.model');
const blogService = require('./blog.service');
require('../models/topic.model');
require('../models/pageCategory.model');
require('../models/user.model');

// ==========================================
// ĐỒNG BỘ MỚI: Require Product model để populate
// ==========================================
require('../models/product.model'); 

// Chỉ lấy trang đã được xuất bản
const getPageBySlug = (slug) => {
    return Page.findOne({ slug, isPublished: true })
        .populate('author', 'firstName lastName username')
        .populate('category', 'title name slug _id') // Bổ sung name đề phòng model dùng name
        .populate('topics', 'name slug')
        .populate('relatedTemplate', 'name thumbnail slug code price')
        // ==========================================
        // ĐỒNG BỘ MỚI: Kéo thông tin Sản phẩm nội tuyến
        // ==========================================
        .populate({
            path: 'injectedBlocks.productId',
            select: 'title price imgSrc images slug'
        });
};

// Danh sách bài đã xuất bản, RÚT GỌN (không kèm nội dung đầy đủ, có excerpt + số phút đọc).
// Trước đây trả cả nội dung mọi bài (~2MB mỗi lần mở trang Tin tức).
// ?isBlog=true chỉ lấy bài blog, ?isBlog=false chỉ lấy trang tĩnh (chính sách, giới thiệu...).
const getPublicPages = (query = {}) => blogService.listPosts({ isBlog: query.isBlog });

module.exports = {
    getPageBySlug,
    getPublicPages,
};