// src/middleware/securityHeaders.js
// Header bảo mật cơ bản cho cả web công khai và API.
const FRAME_ANCESTORS = [
    "'self'",
    'https://icards.com.vn',
    'https://*.icards.com.vn',
    'https://icards.vercel.app',
    'https://icards-dashboard.vercel.app',
].join(' ');

const securityHeaders = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Chỉ cho phép nhúng trang vào iframe từ các tên miền của iCards (vd: xem trước trong trang admin), chống clickjacking
    res.setHeader('Content-Security-Policy', `frame-ancestors ${FRAME_ANCESTORS}`);
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    }
    next();
};

module.exports = { securityHeaders };
