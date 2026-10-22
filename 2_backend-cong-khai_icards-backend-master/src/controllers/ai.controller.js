// src/controllers/ai.controller.js
const aiService = require('../services/ai.service');

const generateTetCard = async (req, res, next) => {
    try {
        const { faceImageUrl, prompt } = req.body;

        // Validate cơ bản
        if (!faceImageUrl) {
            return res.status(400).json({ message: 'Vui lòng cung cấp URL ảnh khuôn mặt (faceImageUrl).' });
        }
        if (!prompt) {
            return res.status(400).json({ message: 'Vui lòng nhập mô tả (prompt).' });
        }

        // Gọi Service
        const result = await aiService.generateHybridTetCard(faceImageUrl, prompt);

        res.status(200).json({
            status: 'success',
            message: 'Tạo thiệp Tết thành công!',
            data: result
        });

    } catch (error) {
        if (error.message === "EXHAUSTED_BALANCE") {
            return res.status(402).json({ 
                message: 'Hệ thống AI đang bảo trì tài nguyên (Hết credit). Vui lòng thử lại sau hoặc liên hệ Admin.' 
            });
        }
        next(error);
    }
};

// Giới hạn lượt tạo ảnh AI mỗi tài khoản (mỗi lượt tốn phí fal.ai)
const AI_LIMIT_PER_DAY = Number(process.env.AI_CARD_LIMIT_PER_DAY || 20);
const AI_MIN_INTERVAL_MS = 8000;
const aiUsage = new Map(); // userId -> { day, count, last }

const takeAiQuota = (userId) => {
    const day = new Date().toISOString().slice(0, 10);
    const now = Date.now();
    const u = aiUsage.get(userId) || { day, count: 0, last: 0 };
    if (u.day !== day) { u.day = day; u.count = 0; }
    if (now - u.last < AI_MIN_INTERVAL_MS) return { ok: false, message: 'Vui lòng đợi vài giây giữa hai lần tạo ảnh.' };
    if (u.count >= AI_LIMIT_PER_DAY) return { ok: false, message: `Mỗi ngày tạo tối đa ${AI_LIMIT_PER_DAY} lượt ảnh AI. Vui lòng quay lại ngày mai.` };
    u.count += 1;
    u.last = now;
    aiUsage.set(userId, u);
    return { ok: true, remaining: AI_LIMIT_PER_DAY - u.count };
};

/** POST /ai/card-art { prompt, style, aspect } -> { images: [url, url] } */
const generateCardArt = async (req, res, next) => {
    try {
        const { prompt = '', style = 'watercolor-floral', aspect = 'portrait' } = req.body || {};
        if (typeof prompt !== 'string' || prompt.length > 300) {
            return res.status(400).json({ message: 'Mô tả tối đa 300 ký tự.' });
        }
        if (!aiService.CARD_STYLES[style]) return res.status(400).json({ message: 'Phong cách không hợp lệ.' });
        if (!['portrait', 'tall', 'square', 'landscape'].includes(aspect)) return res.status(400).json({ message: 'Khổ ảnh không hợp lệ.' });
        if (!process.env.FAL_KEY) return res.status(503).json({ message: 'Tính năng tạo ảnh AI chưa được cấu hình.' });
        const quota = takeAiQuota(String(req.user._id));
        if (!quota.ok) return res.status(429).json({ message: quota.message });
        const images = await aiService.generateCardArt({ prompt, style, aspect });
        return res.status(200).json({ status: 'success', data: { images, remaining: quota.remaining } });
    } catch (error) {
        if (error.message === 'EXHAUSTED_BALANCE') {
            return res.status(402).json({ message: 'Hệ thống AI tạm hết tài nguyên. Vui lòng thử lại sau hoặc liên hệ iCards.' });
        }
        return next(error);
    }
};

module.exports = {
    generateTetCard,
    generateCardArt,
};