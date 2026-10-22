// src/utils/slugify.js
// Tạo slug chuẩn tiếng Việt: "Thiệp chúc mừng Mẹ 20/10" -> "thiep-chuc-mung-me-20-10"
// Giữ đúng thuật toán với backend công khai (icards-backend/src/utils/slugify.js) để URL khớp nhau.
const slugify = (input = '') => String(input)
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // bỏ dấu thanh, dấu mũ...
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Trang quản lý danh mục cũ gắn thêm UUID vào cuối slug ("thiep-moi-cuoi-1908fd58-d356-...").
// Bỏ phần đuôi này để slug ngắn và ổn định.
const UUID_SUFFIX = /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const stripUuidSuffix = (slug = '') => String(slug).replace(UUID_SUFFIX, '');

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

// Dùng khi đưa chuỗi người dùng nhập vào $regex (tránh lỗi 500 với các ký tự như "(" hoặc "*").
const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { slugify, stripUuidSuffix, uniqueSlug, escapeRegex };
