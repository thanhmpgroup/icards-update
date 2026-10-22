// src/middleware/seoRedirects.js
// Áp dụng bảng chuyển hướng 301/302 mà admin nhập trong trang "Quản lý SEO" (settings.seo.redirects).
// Dùng để chuyển các URL cũ/hỏng sang URL mới, tránh 404 trên Google.
const { getMainSettings } = require('../services/settings.service');
const { SITE_URL } = require('../config/site');

const SKIP_PREFIXES = ['/api/', '/static/', '/og-image/'];

// "https://icards.com.vn/page/a%20b/" -> "/page/a b"
const normalizePath = (value) => {
    if (!value) return '';
    let pathname = String(value).trim();
    try {
        pathname = new URL(pathname, SITE_URL).pathname;
    } catch (e) {
        return '';
    }
    try {
        pathname = decodeURIComponent(pathname);
    } catch (e) { /* giữ nguyên nếu chuỗi mã hóa lỗi */ }
    return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
};

const applySeoRedirects = async (req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method) || SKIP_PREFIXES.some(prefix => req.path.startsWith(prefix))) {
        return next();
    }

    try {
        const settings = await getMainSettings();
        const redirects = settings?.seo?.redirects;
        if (!Array.isArray(redirects) || redirects.length === 0) return next();

        const currentPath = normalizePath(req.path);
        const rule = redirects.find(r => r?.source && r?.destination && normalizePath(r.source) === currentPath);
        if (!rule || normalizePath(rule.destination) === currentPath) return next();

        return res.redirect(rule.type === '302' ? 302 : 301, rule.destination);
    } catch (err) {
        console.error('[SEO Redirect] Lỗi:', err.message);
        return next();
    }
};

module.exports = { applySeoRedirects };
