// src/config/site.js
// Cấu hình chung cho website công khai (SEO, email, đường dẫn build frontend).
const path = require('path');

const SITE_URL = (process.env.SITE_URL || 'https://icards.com.vn').replace(/\/+$/, '');

module.exports = {
    SITE_URL,
    SITE_NAME: 'iCards.com.vn',
    BRAND_NAME: 'iCards',
    BRAND_COLOR: '#27548A',
    // Thư mục build React của web công khai (có thể đổi bằng biến môi trường khi chạy ở máy khác)
    FRONTEND_BUILD_DIR: path.resolve(process.env.FRONTEND_BUILD_DIR || '/home/icards/icards/build'),
    DEFAULT_SHARE_IMAGE: 'https://imagedelivery.net/mYCNH6-2h27PJijuhYd-fw/32c7501a-ed3b-4466-876b-48bcfb13d600/public',
    LOGO_URL: `${SITE_URL}/logo192.png`,
    DEFAULT_AVATAR_URL: `${SITE_URL}/default-avatar.svg`,
    // Bài viết có ít chữ hơn mức này (vd: bài trống) không cho Google lập chỉ mục và không đưa vào sitemap
    MIN_INDEXABLE_TEXT_LENGTH: 300,
    // Bài viết có slug này là nội dung của trang /faq
    FAQ_PAGE_SLUG: 'faq',
};
