// TrainData/AdminBE/controllers/page.controller.js
const pageService = require('../services/page.service');
const { uploadFileToCloudflare } = require('../services/cloudflare.service');
const sharp = require('sharp');
const Page = require('../models/page.model');
const { slugify } = require('../utils/slugify');
const AppError = require('../utils/AppError');

// --- Helper: Xử lý Thumbnail riêng biệt ---
const processThumbnail = async (files) => {
    if (!files || files.length === 0) return null;

    // Tìm file có fieldname là 'thumbnail'
    const thumbFile = files.find(f => f.fieldname === 'thumbnail');
    if (!thumbFile) return null;

    try {
        const buffer = await sharp(thumbFile.buffer)
            .resize({ width: 800, height: 500, fit: 'cover' }) // Resize chuẩn Card
            .webp({ quality: 80 })
            .toBuffer();

        const { url } = await uploadFileToCloudflare(buffer);
        return url;
    } catch (error) {
        console.error("Lỗi xử lý Thumbnail:", error);
        return null;
    }
};

// --- Helper: Xử lý ảnh trong nội dung bài viết (giữ nguyên của bạn) ---
const processContentFiles = async (contentBlocks, files) => {
    if (!Array.isArray(contentBlocks) || !Array.isArray(files) || files.length === 0) {
        return contentBlocks;
    }

    const fileMap = new Map(files.map(f => [f.originalname, f]));

    const processedBlocks = await Promise.all(contentBlocks.map(async (block) => {
        if (block.type === 'image' && block.content && typeof block.content === 'string' && block.content.startsWith('[[file:')) {
            try {
                const match = block.content.match(/\[\[file:(.*?)\]\]/);
                if (!match) return block;

                const fileName = match[1];
                const file = fileMap.get(fileName);

                if (file) {
                    const processedBuffer = await sharp(file.buffer)
                        .resize({ width: 1200, fit: 'inside', withoutEnlargement: true })
                        .webp({ quality: 80 })
                        .toBuffer();

                    const { url } = await uploadFileToCloudflare(processedBuffer);
                    return { ...block, content: url };
                }
            } catch (error) {
                console.error("Lỗi xử lý ảnh nội dung:", error);
                return block;
            }
        }
        return block;
    }));

    return processedBlocks;
};

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const toBool = (value) => value === true || value === 'true';

// Làm sạch slug người dùng nhập (bỏ dấu, dấu cách, ký tự lạ). Trả về '' nếu không còn gì.
const cleanSlug = (value) => slugify(value || '');

const safeJsonParse = (data, fallback = []) => {
    if (!data) return fallback;
    if (typeof data === 'object') return data; // Nếu đã là object/array thì trả về luôn
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error("JSON Parse Error:", e.message);
        return fallback;
    }
};

// --- Controllers ---

exports.getPublicPages = async (req, res, next) => {
    try {
        const { category } = req.query;
        let pages;
        if (category) {
            pages = await pageService.getBlogsByCategory(category);
        } else {
            pages = await pageService.getPublicPages();
        }
        res.status(200).json({ status: 'success', data: pages });
    } catch (error) {
        next(error);
    }
};

// Dùng cho /api/v1/pages (không đăng nhập): luôn chỉ trả bài đã xuất bản
exports.getPublishedPages = async (req, res, next) => {
    try {
        const result = await pageService.queryPages({ ...req.query, status: 'true' });
        res.status(200).json({ status: 'success', ...result });
    } catch (error) {
        next(error);
    }
};

exports.getPublishedPageById = async (req, res, next) => {
    try {
        const page = await Page.findOne({ _id: req.params.id, isPublished: true });
        if (!page) return res.status(404).json({ message: 'Trang không tồn tại hoặc chưa được xuất bản.' });
        res.status(200).json({ status: 'success', data: page });
    } catch (error) { next(error); }
};

exports.getPages = async (req, res, next) => {
    try {
        // Đã khớp với tên hàm trong Service mới
        const result = await pageService.queryPages(req.query);
        res.status(200).json({ status: 'success', ...result });
    } catch (error) {
        next(error);
    }
};

exports.getPage = async (req, res, next) => {
    try {
        // Cập nhật query trực tiếp để đảm bảo populate injectedBlocks cho Admin Form
        const page = await Page.findById(req.params.id)
            .populate('category')
            .populate('topics')
            .populate('injectedBlocks.productId'); // Quan trọng để hiển thị tên SP trong edit form

        if (!page) return res.status(404).json({ message: 'Không tìm thấy trang' });
        res.status(200).json({ status: 'success', data: page });
    } catch (error) { next(error); }
};

exports.createPage = async (req, res, next) => {
    try {
        const pageData = { ...req.body };
        delete pageData._id;
        delete pageData.author;

        // Slug chuẩn tiếng Việt (trước đây "Thiệp mừng" có thể lưu thành "thiệp mừng" và bị 404)
        pageData.slug = cleanSlug(pageData.slug) || cleanSlug(pageData.title);
        if (!pageData.slug) return next(new AppError('Vui lòng nhập tiêu đề hoặc đường dẫn (slug) hợp lệ.', 400));
        if (has(pageData, 'isPublished')) pageData.isPublished = toBool(pageData.isPublished);

        // 1. Xử lý Thumbnail
        const thumbnailUrl = await processThumbnail(req.files);
        if (thumbnailUrl) {
            pageData.thumbnail = thumbnailUrl;
        }

        if (pageData.relatedTemplate === '' || pageData.relatedTemplate === 'null') {
            pageData.relatedTemplate = null;
        }

        // Chuẩn hoá Category & isBlog
        pageData.isBlog = pageData.isBlog === 'true' || pageData.isBlog === true;
        if (!pageData.isBlog) {
            pageData.category = null;
        } else if (pageData.category === '' || pageData.category === 'null' || !pageData.category) {
            pageData.category = null;
        }

        // --- CẬP NHẬT: Parse relatedProducts ---
        if (pageData.relatedProducts && typeof pageData.relatedProducts === 'string') {
            try { pageData.relatedProducts = JSON.parse(pageData.relatedProducts); } catch (e) { pageData.relatedProducts = []; }
        }

        // --- THÊM MỚI: Parse injectedBlocks ---
        if (pageData.injectedBlocks && typeof pageData.injectedBlocks === 'string') {
            try {
                let parsedBlocks = JSON.parse(pageData.injectedBlocks);

                // --- FIX LỖI CAST TO OBJECTID Ở ĐÂY ---
                // Lọc qua các block, nếu productId rỗng thì chuyển thành null
                pageData.injectedBlocks = parsedBlocks.map(block => {
                    if (!block.productId || block.productId === "") block.productId = null;
                    return block;
                }).filter(block => {
                    if (block.type === 'product' && !block.productId) return false;
                    if (block.type === 'banner' && (!block.bannerImg || block.bannerImg.trim() === "")) return false;

                    // --- THÊM DÒNG NÀY: Kiểm tra chặn rác cho gmall-product ---
                    if (block.type === 'gmall-product' && (!block.gmallData || !block.gmallData.id)) return false;

                    return true;
                });

            } catch (e) {
                pageData.injectedBlocks = [];
            }
        }

        // Parse Topics & SEO
        if (typeof safeJsonParse === 'function') {
            pageData.topics = safeJsonParse(pageData.topics, []);
            pageData.seo = safeJsonParse(pageData.seo, {});
        } else {
            if (typeof pageData.topics === 'string') try { pageData.topics = JSON.parse(pageData.topics) } catch (e) { pageData.topics = [] }
            if (typeof pageData.seo === 'string') try { pageData.seo = JSON.parse(pageData.seo) } catch (e) { pageData.seo = {} }
        }

        // Xử lý content
        let contentRaw = pageData.content;
        if (typeof contentRaw === 'string' && (contentRaw.trim().startsWith('{') || contentRaw.trim().startsWith('['))) {
            let parsed = null;
            if (typeof safeJsonParse === 'function') {
                parsed = safeJsonParse(contentRaw, null);
            } else {
                try { parsed = JSON.parse(contentRaw); } catch (e) { }
            }
            if (parsed) contentRaw = parsed;
        }
        pageData.content = contentRaw;

        // Lưu DB
        const newPage = await pageService.createPage({ ...pageData, author: req.user.id });
        res.status(201).json({ status: 'success', data: newPage });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'Lỗi: Đường dẫn (slug) này đã tồn tại.' });
        next(error);
    }
};

exports.updatePage = async (req, res, next) => {
    try {
        const pageData = { ...req.body };
        delete pageData._id;
        delete pageData.author;

        // 1. Xử lý Thumbnail
        const newThumbnailUrl = await processThumbnail(req.files);
        if (newThumbnailUrl) {
            pageData.thumbnail = newThumbnailUrl;
        } else if (pageData.thumbnailUrl) {
            pageData.thumbnail = pageData.thumbnailUrl;
        }
        delete pageData.thumbnailUrl;

        if (has(pageData, 'slug')) {
            pageData.slug = cleanSlug(pageData.slug);
            if (!pageData.slug) return next(new AppError('Đường dẫn (slug) không hợp lệ.', 400));
        }

        if (has(pageData, 'isPublished')) pageData.isPublished = toBool(pageData.isPublished);

        if (pageData.relatedTemplate === '' || pageData.relatedTemplate === 'null') pageData.relatedTemplate = null;

        // --- CẬP NHẬT: Parse relatedProducts ---
        if (pageData.relatedProducts && typeof pageData.relatedProducts === 'string') {
            try { pageData.relatedProducts = JSON.parse(pageData.relatedProducts); } catch (e) { pageData.relatedProducts = []; }
        }

        // --- THÊM MỚI: Parse injectedBlocks ---
        if (pageData.injectedBlocks && typeof pageData.injectedBlocks === 'string') {
            try {
                let parsedBlocks = JSON.parse(pageData.injectedBlocks);

                pageData.injectedBlocks = parsedBlocks.map(block => {
                    if (!block.productId || block.productId === "") block.productId = null;
                    return block;
                }).filter(block => {
                    if (block.type === 'product' && !block.productId) return false;
                    if (block.type === 'banner' && (!block.bannerImg || block.bannerImg.trim() === "")) return false;

                    // --- THÊM DÒNG NÀY: Kiểm tra chặn rác cho gmall-product ---
                    if (block.type === 'gmall-product' && (!block.gmallData || !block.gmallData.id)) return false;

                    return true;
                });

            } catch (e) {
                pageData.injectedBlocks = [];
            }
        }

        // Logic dọn dẹp Category.
        // CHỈ xử lý khi request có gửi isBlog/category. Trước đây nút "Published/Draft" trong danh sách
        // chỉ gửi { isPublished } nhưng code vẫn đặt isBlog = false, category = null, topics = [], seo = {}
        // => bài viết bị đổi thành Page, mất danh mục, chủ đề và SEO.
        if (has(pageData, 'isBlog')) {
            pageData.isBlog = toBool(pageData.isBlog);
            if (!pageData.isBlog) pageData.category = null;
        }
        if (has(pageData, 'category') && (pageData.category === '' || pageData.category === 'null' || pageData.category === 'undefined')) {
            pageData.category = null;
        }

        // Parse json fields (chỉ khi có gửi lên)
        if (has(pageData, 'topics')) pageData.topics = safeJsonParse(pageData.topics, []);
        if (has(pageData, 'seo')) pageData.seo = safeJsonParse(pageData.seo, {});

        // Parse content
        if (has(pageData, 'content')) {
            let contentRaw = pageData.content;
            if (typeof contentRaw === 'string' && (contentRaw.trim().startsWith('{') || contentRaw.trim().startsWith('['))) {
                const parsed = safeJsonParse(contentRaw, null);
                if (parsed) contentRaw = parsed;
            }
            pageData.content = contentRaw;
        }

        const updatedPage = await pageService.updatePage(req.params.id, pageData);
        if (!updatedPage) return res.status(404).json({ message: 'Không tìm thấy trang' });
        res.status(200).json({ status: 'success', data: updatedPage });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'Lỗi: Đường dẫn (slug) này đã tồn tại.' });
        next(error);
    }
};

exports.deletePage = async (req, res, next) => {
    try {
        const page = await pageService.deletePage(req.params.id);
        if (!page) return res.status(404).json({ message: 'Không tìm thấy trang' });
        res.status(204).send();
    } catch (error) { next(error); }
};

exports.getPublicPageBySlug = async (req, res, next) => {
    try {
        const page = await Page.findOne({ slug: req.params.slug, isPublished: true })
            .populate('category', 'name slug')
            .populate('author', 'name avatar')
            // Populate relatedProducts (dự phòng nếu FE vẫn cần)
            .populate({
                path: 'relatedProducts',
                select: 'title price images imgSrc slug'
            })
            // --- THÊM MỚI: Populate sản phẩm trong injectedBlocks ---
            .populate({
                path: 'injectedBlocks.productId',
                select: 'title price images imgSrc slug'
            })
            .lean();

        if (!page) {
            return res.status(404).json({ message: 'Trang không tồn tại hoặc chưa được xuất bản.' });
        }
        if (page.injectedBlocks && page.injectedBlocks.length > 0) {
            page.injectedBlocks = page.injectedBlocks.filter(block => {
                if (block.type === 'product' && block.productId === null) {
                    return false; // Bỏ qua vì sản phẩm này đã bị xóa khỏi Database
                }
                return true;
            });
        }
        const latestPosts = await Page.find({
            isBlog: true,
            isPublished: true,
            _id: { $ne: page._id }
        })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('title slug createdAt thumbnail category')
            .populate('category', 'name')
            .lean();

        res.status(200).json({
            status: 'success',
            data: page,
            related: {
                latestPosts: latestPosts
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getAllPageCategories = async (req, res, next) => {
    try {
        const categories = await pageService.getAllPageCategories();
        res.status(200).json({ status: 'success', data: categories });
    } catch (error) { next(error); }
};

exports.createPageCategory = async (req, res, next) => {
    try {
        const newCategory = await pageService.createPageCategory(req.body);
        res.status(201).json({ status: 'success', data: newCategory });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'Lỗi: Tên hoặc slug danh mục đã tồn tại.' });
        next(error);
    }
};

exports.updatePageCategory = async (req, res, next) => {
    try {
        const updatedCategory = await pageService.updatePageCategory(req.params.id, req.body);
        if (!updatedCategory) return res.status(404).json({ message: 'Không tìm thấy danh mục' });
        res.status(200).json({ status: 'success', data: updatedCategory });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'Lỗi: Tên hoặc slug danh mục đã tồn tại.' });
        next(error);
    }
};

exports.deletePageCategory = async (req, res, next) => {
    try {
        const category = await pageService.deletePageCategory(req.params.id);
        if (!category) return res.status(404).json({ message: 'Không tìm thấy danh mục' });
        res.status(204).send();
    } catch (error) { next(error); }
};

exports.updatePageOrder = async (req, res, next) => {
    try {
        if (!Array.isArray(req.body.pages)) return res.status(400).json({ status: 'fail', message: 'Dữ liệu pages phải là một mảng.' });
        await pageService.updatePageOrder(req.body.pages);
        res.status(200).json({ status: 'success', message: 'Thứ tự trang được cập nhật thành công.' });
    } catch (error) { next(error); }
};