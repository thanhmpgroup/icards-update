// src/middleware/rateLimit.js
// Giới hạn số lần thử đơn giản, lưu trong bộ nhớ (đủ cho 1 tiến trình Node).
// Dùng cho đăng nhập / quên mật khẩu để chống dò mật khẩu.

const createRateLimiter = ({ windowMs, max, keyFn, message }) => {
    const hits = new Map();

    // Dọn các khóa đã hết hạn để Map không phình mãi
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits) {
            if (entry.resetAt <= now) hits.delete(key);
        }
    }, windowMs).unref();

    return (req, res, next) => {
        const key = keyFn(req);
        const now = Date.now();
        let entry = hits.get(key);
        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + windowMs };
            hits.set(key, entry);
        }
        entry.count += 1;
        if (entry.count > max) {
            res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
            return res.status(429).json({ message });
        }
        next();
    };
};

// 10 lần thử / 15 phút cho mỗi IP + tên đăng nhập; 50 lần / 15 phút cho mỗi IP.
const loginLimiterByAccount = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyFn: (req) => `${req.ip}|${String((req.body && req.body.login) || '').trim().toLowerCase()}`,
    message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.',
});

const loginLimiterByIp = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 50,
    keyFn: (req) => req.ip,
    message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.',
});

const passwordResetLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 5,
    keyFn: (req) => req.ip,
    message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 1 giờ.',
});

module.exports = { createRateLimiter, loginLimiterByAccount, loginLimiterByIp, passwordResetLimiter };
