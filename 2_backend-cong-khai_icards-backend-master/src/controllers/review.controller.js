// src/controllers/review.controller.js
// Đánh giá iCards: trang chủ lấy các đánh giá đã duyệt + điểm trung bình; khách đăng nhập viết/sửa đánh giá của mình.
const Review = require('../models/review.model');
const Invitation = require('../models/invitation.model');

// Bỏ thẻ HTML / ký tự điều khiển, gộp khoảng trắng thừa
const clean = (v, max) => String(v ?? '')
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);

const PUBLIC_FIELDS = 'displayName rating title content hasCreatedCard createdAt';

// GET /api/reviews/public?limit=12
const getPublicReviews = async (req, res, next) => {
    try {
        const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 12));
        const [reviews, stats] = await Promise.all([
            Review.find({ status: 'approved' }).sort({ createdAt: -1 }).limit(limit).select(PUBLIC_FIELDS).lean(),
            Review.aggregate([
                { $match: { status: 'approved' } },
                { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
            ]),
        ]);
        const s = stats[0] || { average: 0, count: 0 };
        res.set('Cache-Control', 'public, max-age=60'); // duyệt xong khoảng 1 phút là hiện
        res.status(200).json({
            status: 'success',
            data: reviews,
            stats: { average: Math.round((s.average || 0) * 10) / 10, count: s.count || 0 },
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/reviews/me
const getMyReview = async (req, res, next) => {
    try {
        const review = await Review.findOne({ user: req.user._id }).select(`${PUBLIC_FIELDS} status updatedAt`).lean();
        res.status(200).json({ status: 'success', data: review || null });
    } catch (error) {
        next(error);
    }
};

// Chống gửi liên tục: tối đa 5 lần / giờ / tài khoản
const submitHits = new Map(); // userId -> { hour, count }

// POST /api/reviews  { rating, title, content, displayName }
const upsertMyReview = async (req, res, next) => {
    try {
        const userId = String(req.user._id);
        const hour = Math.floor(Date.now() / 3600000);
        const hit = submitHits.get(userId);
        if (hit && hit.hour === hour && hit.count >= 5) {
            return res.status(429).json({ status: 'fail', message: 'Bạn gửi đánh giá quá nhiều lần, vui lòng thử lại sau.' });
        }
        submitHits.set(userId, hit && hit.hour === hour ? { hour, count: hit.count + 1 } : { hour, count: 1 });
        if (submitHits.size > 5000) submitHits.clear();

        const rating = Number(req.body?.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ status: 'fail', message: 'Vui lòng chọn số sao từ 1 đến 5.' });
        }
        const content = clean(req.body?.content, 500);
        if (content.length < 10) {
            return res.status(400).json({ status: 'fail', message: 'Nội dung đánh giá cần ít nhất 10 ký tự.' });
        }
        const title = clean(req.body?.title, 80).replace(/\n/g, ' ');
        const fallbackName = [req.user.lastName, req.user.firstName].filter(Boolean).join(' ').trim() || req.user.username;
        const displayName = clean(req.body?.displayName, 60).replace(/\n/g, ' ') || fallbackName;

        const hasCreatedCard = Boolean(await Invitation.exists({ user: req.user._id }));
        const review = await Review.findOneAndUpdate(
            { user: req.user._id },
            { $set: { rating, title, content, displayName, hasCreatedCard, status: 'pending' } },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
        ).select(`${PUBLIC_FIELDS} status updatedAt`);
        res.status(200).json({
            status: 'success',
            message: 'Cảm ơn bạn! Đánh giá sẽ hiển thị sau khi được duyệt.',
            data: review,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { getPublicReviews, getMyReview, upsertMyReview };
