// src/controllers/review.controller.js
// Duyệt đánh giá của khách (hiện ở trang chủ icards.com.vn): xem theo trạng thái, duyệt / ẩn, xoá.
const mongoose = require('mongoose');
const Review = require('../models/review.model');

const STATUSES = ['pending', 'approved', 'hidden'];

// GET /api/v1/admin/reviews?status=pending&page=1&limit=20&q=
exports.getReviews = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const filter = {};
        if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
        const q = String(req.query.q || '').trim().slice(0, 100);
        if (q) {
            const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [{ displayName: re }, { title: re }, { content: re }];
        }
        const [items, total, counts] = await Promise.all([
            Review.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
                .populate('user', 'username email').lean(),
            Review.countDocuments(filter),
            Review.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        ]);
        res.status(200).json({
            status: 'success',
            data: items,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            counts: Object.fromEntries(counts.map(c => [c._id, c.count])),
        });
    } catch (error) {
        next(error);
    }
};

// PUT /api/v1/admin/reviews/:id  { status }
exports.updateReviewStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ message: 'Không tìm thấy đánh giá.' });
        const { status } = req.body || {};
        if (!STATUSES.includes(status)) return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
        const review = await Review.findByIdAndUpdate(id, { status }, { new: true }).populate('user', 'username email');
        if (!review) return res.status(404).json({ message: 'Không tìm thấy đánh giá.' });
        res.status(200).json({ status: 'success', data: review });
    } catch (error) {
        next(error);
    }
};

// DELETE /api/v1/admin/reviews/:id
exports.deleteReview = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ message: 'Không tìm thấy đánh giá.' });
        const review = await Review.findByIdAndDelete(id);
        if (!review) return res.status(404).json({ message: 'Không tìm thấy đánh giá.' });
        res.status(200).json({ status: 'success', message: 'Đã xoá đánh giá.' });
    } catch (error) {
        next(error);
    }
};
