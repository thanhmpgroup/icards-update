// src/middleware/originCheck.js
// Chống CSRF: trình duyệt luôn gửi header Origin với POST/PUT/PATCH/DELETE từ trang khác.
// Nếu Origin không thuộc danh sách được phép thì từ chối, kể cả khi trình duyệt có gửi kèm cookie đăng nhập.
// Yêu cầu không có Origin (curl, máy chủ gọi máy chủ) vẫn phải qua bước kiểm tra đăng nhập như bình thường.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const blockCrossSiteWrites = (allowedOrigins = []) => (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.get('origin');
    if (!origin || allowedOrigins.includes(origin)) return next();
    return res.status(403).json({ message: 'Yêu cầu bị từ chối: nguồn gửi không hợp lệ.' });
};

module.exports = { blockCrossSiteWrites };
