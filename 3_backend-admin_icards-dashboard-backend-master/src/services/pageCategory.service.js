// AdminBE/services/pageCategory.service.js
const PageCategory = require('../models/pageCategory.model');
const { slugify, stripUuidSuffix, uniqueSlug } = require('../utils/slugify');

// Trang quản trị gửi slug kèm UUID ("thiep-moi-cuoi-1908fd58-d356-...") hoặc còn dấu cách.
// Chuẩn hoá về "thiep-moi-cuoi"; nếu trùng thì thêm -2, -3.
const normalizeCategorySlug = async (data, excludeId = null) => {
    if (!data || (data.slug === undefined && data.name === undefined)) return data;
    const source = slugify(stripUuidSuffix(data.slug || '')) || slugify(data.name || '');
    if (!source) return data;
    return { ...data, slug: await uniqueSlug(PageCategory, source, excludeId) };
};

// ==========================================
// HELPER: Hàm đệ quy chuyển mảng phẳng thành Cây (Tree)
// ==========================================
const buildTree = (categories, parentId = null) => {
    return categories
        .filter(cat => {
            // Chuyển ObjectID sang String để so sánh an toàn
            const catParentId = cat.parent ? cat.parent.toString() : null;
            const targetParentId = parentId ? parentId.toString() : null;
            return catParentId === targetParentId;
        })
        .map(cat => {
            // Gọi đệ quy để tìm các con của danh mục hiện tại
            const children = buildTree(categories, cat._id);
            return {
                ...cat,
                children: children.length > 0 ? children : []
            };
        });
};

// ==========================================
// CÁC HÀM XỬ LÝ CHÍNH
// ==========================================

const getAllCategories = async () => {
    // Dùng .lean() để Mongoose trả về plain Javascript object thay vì Document, 
    // giúp thêm trường `children` dễ dàng và hiệu năng cao hơn.
    const flatCategories = await PageCategory.find().sort('order').lean();
    
    // Bắt đầu build từ các danh mục cấp 1 (parent = null)
    return buildTree(flatCategories, null);
};

const getCategoryById = (id) => PageCategory.findById(id).populate('parent', 'name');

const createCategory = async (data) => {
    return PageCategory.create(await normalizeCategorySlug(data));
};

const updateCategory = async (id, data) => {
    return PageCategory.findByIdAndUpdate(id, await normalizeCategorySlug(data, id), { new: true, runValidators: true });
};

const deleteCategory = async (id) => {
    // Ngăn lỗi orphan data: Set parent = null cho các danh mục con của danh mục bị xóa
    await PageCategory.updateMany({ parent: id }, { parent: null });
    return PageCategory.findByIdAndDelete(id);
};

const updateCategoryOrder = (categories) => {
    const promises = categories.map((cat, index) => {
        const updateData = { order: index };
        
        // Cập nhật luôn parent nếu Frontend có gửi lên (chuẩn bị cho tính năng kéo thả đổi cha con)
        if (cat.parent !== undefined) {
            updateData.parent = cat.parent === '' ? null : cat.parent;
        }
        
        return PageCategory.findByIdAndUpdate(cat.id || cat._id, updateData);
    });
    return Promise.all(promises);
};

// Hàm mới: Dùng để seed dữ liệu mẫu hoặc đồng bộ (Giống Topic)
const seedCategories = async () => {
    // Kiểm tra xem DB đã có data chưa
    const count = await PageCategory.countDocuments();
    if (count > 0) {
        return 0; // Đã có dữ liệu, bỏ qua không seed nữa
    }

    // Danh sách mẫu để clone
    const defaultCategories = [
        { name: 'Kiến thức chung', slug: 'kien-thuc-chung', order: 1 },
        { name: 'Hướng dẫn sử dụng', slug: 'huong-dan-su-dung', order: 2 },
        { name: 'Tin tức & Cập nhật', slug: 'tin-tuc-cap-nhat', order: 3 },
    ];
    
    const inserted = await PageCategory.insertMany(defaultCategories);
    return inserted.length;
};

module.exports = {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
    updateCategoryOrder,
    seedCategories
};