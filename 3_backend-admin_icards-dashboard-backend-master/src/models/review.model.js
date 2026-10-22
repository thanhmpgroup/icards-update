// src/models/review.model.js
// Đánh giá iCards của khách (hiện ở trang chủ). Mỗi tài khoản một đánh giá, sửa được.
// Đánh giá mới / vừa sửa ở trạng thái 'pending' cho tới khi admin duyệt ('approved') hoặc ẩn ('hidden').
// Dùng chung collection với backend công khai (icards-backend-master/src/models/review.model.js): giữ cùng cấu trúc.
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.ObjectId, ref: 'User', required: true, unique: true },
    displayName: { type: String, required: true, trim: true, maxlength: 60 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 80, default: '' },
    content: { type: String, required: true, trim: true, maxlength: 500 },
    // Khách đã từng tạo thiệp trên iCards (ghi lúc gửi đánh giá) -> hiện nhãn "Đã tạo thiệp"
    hasCreatedCard: { type: Boolean, default: false },
    status: { type: String, enum: ['pending', 'approved', 'hidden'], default: 'pending', index: true },
}, { timestamps: true });

reviewSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.models.Review || mongoose.model('Review', reviewSchema);
