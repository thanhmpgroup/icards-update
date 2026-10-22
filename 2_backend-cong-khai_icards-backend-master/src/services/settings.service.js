// src/services/settings.service.js
// Đọc cấu hình chung (do trang admin lưu) và giữ trong bộ nhớ 60 giây,
// tránh truy vấn MongoDB ở mỗi lượt tải trang / mỗi request redirect.
const Setting = require('../models/settings.model');

const CACHE_TTL_MS = 60 * 1000;
let cached = null;
let cachedAt = 0;

const getMainSettings = async () => {
    if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;
    try {
        cached = await Setting.findOne({ singletonKey: 'main_settings' }).lean() || {};
        cachedAt = Date.now();
    } catch (err) {
        console.error('[Settings] Không đọc được cấu hình:', err.message);
        if (!cached) return {};
    }
    return cached;
};

module.exports = { getMainSettings };
