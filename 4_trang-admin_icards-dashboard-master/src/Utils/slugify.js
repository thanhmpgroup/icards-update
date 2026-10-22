// src/Utils/slugify.js
// Tạo slug chuẩn tiếng Việt, dùng chung cho mọi form trong admin (bài viết, danh mục, chủ đề, khối trang chủ).
// "Thiệp chúc mừng Mẹ 20/10" -> "thiep-chuc-mung-me-20-10"
// Giữ đúng thuật toán với backend (src/utils/slugify.js) để URL khớp nhau.
export const slugify = (input = '') => String(input)
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Địa chỉ web công khai (dùng cho nút "Xem thử" và gợi ý link)
export const PUBLIC_SITE_URL = (process.env.REACT_APP_PUBLIC_SITE_URL || 'https://icards.com.vn').replace(/\/+$/, '');

export default slugify;
