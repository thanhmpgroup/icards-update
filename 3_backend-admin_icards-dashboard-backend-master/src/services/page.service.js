// AdminBE/services/page.service.js
const Page = require('../models/page.model'); // Import trực tiếp, KHÔNG dùng { Page }
const PageCategory = require('../models/pageCategory.model');
const { escapeRegex } = require('../utils/slugify');

// QUAN TRỌNG: Load các model phụ để tránh lỗi khi populate
require('../models/topic.model');
require('../models/pageCategory.model');
require('../models/user.model');
require('../models/product.model'); // THÊM DÒNG NÀY ĐỂ POPULATE SẢN PHẨM KHÔNG BỊ LỖI

// 1. Hàm Query nâng cao (Filter, Search, Pagination) - Thay thế cho getAllPages cũ
const queryPages = async (query) => {
  const filter = {};

  // Tìm kiếm (Search)
  if (query.search) {
      // Escape để từ khóa như "(" hay "c++" không làm lỗi 500
      const search = escapeRegex(String(query.search).trim());
      filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { slug: { $regex: search, $options: 'i' } }
      ];
  }

  // Lọc theo trạng thái (Status)
  if (query.status && query.status !== 'all') {
      filter.isPublished = query.status === 'true';
  }

  // Lọc theo loại (Blog/Page)
  if (query.type && query.type !== 'all') {
      filter.isBlog = query.type === 'blog'; 
  } else if (query.isBlog === 'true' || query.isBlog === 'false') {
      filter.isBlog = query.isBlog === 'true';
  }

  // Lọc theo danh mục (Category)
  if (query.category && query.category !== 'all') {
      filter.category = query.category;
  }

  // Phân trang & Sắp xếp
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 200);
  const skip = (page - 1) * limit;
  const sortBy = typeof query.sort === 'string' && /^-?[a-zA-Z.]+$/.test(query.sort) ? query.sort : '-createdAt';

  // Thực thi query
  const pages = await Page.find(filter)
      .populate('author', 'name email')
      .populate('category', 'name')
      .sort(sortBy)
      .skip(skip)
      .limit(limit);

  const total = await Page.countDocuments(filter);
  const totalPages = Math.ceil(total / limit);

  return {
      data: pages,
      page,
      limit,
      totalPages,
      totalResults: total
  };
};

// CẬP NHẬT: Thêm populate cho injectedBlocks.productId
const getPageById = (id) => {
    return Page.findById(id)
        .populate('category')
        .populate('topics')
        .populate({
            path: 'injectedBlocks.productId',
            select: 'title price imgSrc images slug status' // Phục vụ Admin Edit Form
        });
};

// CẬP NHẬT: Thêm populate cho injectedBlocks.productId
const getPageBySlug = (slug) => {
    return Page.findOne({ slug, isPublished: true })
        .populate('author', 'name')
        .populate('category', 'name slug')
        .populate('topics', 'name slug')
        .populate('relatedTemplate', 'name thumbnail slug code price')
        .populate({
            path: 'injectedBlocks.productId',
            select: 'title price imgSrc images slug' // Phục vụ Frontend render
        });
};

const createPage = (pageData) => Page.create(pageData);

const updatePage = (id, pageData) => Page.findByIdAndUpdate(id, pageData, { new: true, runValidators: true });

const deletePage = (id) => Page.findByIdAndDelete(id);

// Hàm cập nhật thứ tự
const updatePageOrder = (pages) => {
    const promises = pages.map((page, index) => {
        return Page.findByIdAndUpdate(page.id || page._id, { order: index });
    });
    return Promise.all(promises);
};

// --- GIỮ LẠI CÁC HÀM CATEGORY ---
const getAllPageCategories = () => PageCategory.find().sort({ order: 1, createdAt: -1 }).populate('parent', 'name');
const getPageCategoryById = (id) => PageCategory.findById(id);
const createPageCategory = (data) => PageCategory.create(data);
const updatePageCategory = (id, data) => PageCategory.findByIdAndUpdate(id, data, { new: true });
const deletePageCategory = async (id) => {
    await PageCategory.updateMany({ parent: id }, { parent: null });
    return PageCategory.findByIdAndDelete(id);
};

// EXPORT ĐẦY ĐỦ
module.exports = {
    queryPages, 
    getPageById,
    getPageBySlug,
    createPage,
    updatePage,
    deletePage,
    updatePageOrder,
    // Export category functions
    getAllPageCategories,
    getPageCategoryById,
    createPageCategory,
    updatePageCategory,
    deletePageCategory
};