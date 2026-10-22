// Backend/controllers/wish.controller.js
const mongoose = require('mongoose');
const Wish = require('../models/wish.model');
const Invitation = require('../models/invitation.model');

// Chỉ chủ thiệp (hoặc admin) mới được xem/duyệt/xóa lời chúc của thiệp đó
const canManageInvitation = async (invitationId, user) => {
    if (!mongoose.Types.ObjectId.isValid(invitationId)) return false;
    if (user.role === 'admin') return Invitation.exists({ _id: invitationId });
    return Invitation.exists({ _id: invitationId, user: user._id });
};

// ==========================================
// API DÀNH CHO KHÁCH (PUBLIC)
// ==========================================

// 1. Khách gửi lời chúc mới
const createWish = async (req, res, next) => {
    try {
        const { id: invitationId } = req.params;
        const senderName = String(req.body.senderName || '').trim();
        const content = String(req.body.content || '').trim();

        if (!senderName || senderName.length > 50) {
            return res.status(400).json({ success: false, message: 'Tên người gửi là bắt buộc và tối đa 50 ký tự.' });
        }
        if (!content || content.length > 1000) {
            return res.status(400).json({ success: false, message: 'Nội dung lời chúc là bắt buộc và tối đa 1000 ký tự.' });
        }
        if (!mongoose.Types.ObjectId.isValid(invitationId)) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thiệp mời' });
        }

        // Kiểm tra thiệp có tồn tại không
        const invitation = await Invitation.findById(invitationId).select('_id');
        if (!invitation) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thiệp mời' });
        }

        const newWish = await Wish.create({
            invitation: invitationId,
            senderName,
            content,
            status: 'approved' // Chỉnh thành 'pending' nếu muốn duyệt thủ công
        });

        res.status(201).json({
            success: true,
            data: newWish,
            message: 'Gửi lời chúc thành công'
        });
    } catch (error) {
        next(error);
    }
};

// Thả tim cho thiệp (thiệp chúc mừng / cảm ơn). Mỗi khách (mã khách hoặc mã trình duyệt) chỉ tính 1 lần.
const HEART_KEY_RE = /^[A-Za-z0-9_-]{6,64}$/;
const heartHits = new Map(); // ip -> { minute, count }: chống bấm liên tục
const heartInvitation = async (req, res, next) => {
    try {
        const { id: invitationId } = req.params;
        const key = String(req.body?.key || '');
        if (!mongoose.Types.ObjectId.isValid(invitationId)) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thiệp mời' });
        }
        if (!HEART_KEY_RE.test(key)) return res.status(400).json({ success: false, message: 'Thiếu mã người thả tim.' });
        const ip = req.ip || 'unknown';
        const minute = Math.floor(Date.now() / 60000);
        const hit = heartHits.get(ip);
        if (hit && hit.minute === minute && hit.count >= 30) {
            return res.status(429).json({ success: false, message: 'Thao tác quá nhanh, vui lòng thử lại sau.' });
        }
        heartHits.set(ip, hit && hit.minute === minute ? { minute, count: hit.count + 1 } : { minute, count: 1 });
        if (heartHits.size > 5000) heartHits.clear();

        const result = await Invitation.updateOne(
            { _id: invitationId, heartKeys: { $ne: key } },
            { $addToSet: { heartKeys: key }, $inc: { 'reactions.hearts': 1 } },
        );
        const inv = await Invitation.findById(invitationId).select('reactions');
        if (!inv) return res.status(404).json({ success: false, message: 'Không tìm thấy thiệp mời' });
        return res.status(200).json({ success: true, data: { hearts: inv.reactions?.hearts || 0, alreadyHearted: result.modifiedCount === 0 } });
    } catch (error) {
        return next(error);
    }
};

// 2. Lấy danh sách lời chúc hiển thị lên thiệp (Chỉ lấy status: 'approved')
const getPublicWishes = async (req, res, next) => {
    try {
        const { id: invitationId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(invitationId)) {
            return res.status(200).json({ success: true, data: [] });
        }

        const wishes = await Wish.find({
            invitation: invitationId,
            status: 'approved'
        }).sort('-createdAt'); // Sắp xếp mới nhất lên đầu

        res.status(200).json({
            success: true,
            data: wishes
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// API DÀNH CHO QUẢN TRỊ VIÊN / CHỦ THIỆP
// ==========================================

// 3. Lấy TẤT CẢ lời chúc để quản lý (bao gồm cả ẩn/hiện)
const getAdminWishes = async (req, res, next) => {
    try {
        const { id: invitationId } = req.params;

        if (!(await canManageInvitation(invitationId, req.user))) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thiệp hoặc bạn không có quyền.' });
        }

        const wishes = await Wish.find({ invitation: invitationId }).sort('-createdAt');

        res.status(200).json({
            success: true,
            data: wishes
        });
    } catch (error) {
        next(error);
    }
};

// 4. Đổi trạng thái lời chúc (Ẩn/Hiện)
const updateWishStatus = async (req, res, next) => {
    try {
        const { wishId } = req.params;
        const { status, reply } = req.body; // <-- Nhận thêm trường reply

        const existingWish = mongoose.Types.ObjectId.isValid(wishId) ? await Wish.findById(wishId).select('invitation') : null;
        if (!existingWish || !(await canManageInvitation(existingWish.invitation, req.user))) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy lời chúc' });
        }

        // Tạo object chứa các field cần update
        const updateData = {};
        if (status) updateData.status = status;
        if (reply !== undefined) updateData.reply = reply; // Chấp nhận cả chuỗi rỗng để xóa reply

        const wish = await Wish.findByIdAndUpdate(
            wishId,
            updateData,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            data: wish,
            message: 'Cập nhật lời chúc thành công'
        });
    } catch (error) {
        next(error);
    }
};

// 5. Xóa lời chúc
const deleteWish = async (req, res, next) => {
    try {
        const { wishId } = req.params;

        const existingWish = mongoose.Types.ObjectId.isValid(wishId) ? await Wish.findById(wishId).select('invitation') : null;
        if (!existingWish || !(await canManageInvitation(existingWish.invitation, req.user))) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy lời chúc' });
        }

        await Wish.findByIdAndDelete(wishId);

        res.status(200).json({
            success: true,
            data: null,
            message: 'Đã xóa lời chúc'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    heartInvitation,
    createWish,
    getPublicWishes,
    getAdminWishes,
    updateWishStatus,
    deleteWish
};