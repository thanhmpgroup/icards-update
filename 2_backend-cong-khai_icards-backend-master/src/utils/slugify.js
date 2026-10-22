// src/utils/slugify.js
// Tạo slug chuẩn tiếng Việt: "Thiệp chúc mừng Mẹ 20/10" -> "thiep-chuc-mung-me-20-10"
const slugify = (input = '') => String(input)
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // bỏ dấu thanh, dấu mũ...
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Tạo slug không trùng trong một collection: thêm hậu tố -2, -3... nếu đã tồn tại.
 * @param {Model} Model - Mongoose model cần kiểm tra.
 * @param {string} source - Chuỗi gốc (tiêu đề, tên...).
 * @param {string} [excludeId] - Bỏ qua chính bản ghi đang sửa.
 */
const uniqueSlug = async (Model, source, excludeId = null) => {
    const base = slugify(source) || 'muc';
    let candidate = base;
    let suffix = 2;
    while (await Model.exists({ slug: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
    }
    return candidate;
};

module.exports = { slugify, uniqueSlug };
