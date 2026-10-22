const Media = require('../models/media.model');
const r2Service = require('../services/r2.service');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

// Lấy danh sách hình ảnh
exports.getAllMedia = catchAsync(async (req, res, next) => {
    // Phân trang đơn giản hoặc lấy tất cả
    const media = await Media.find().sort({ createdAt: -1 });
    res.status(200).json({
        success: true,
        data: media
    });
});

// Upload hình ảnh lên R2
exports.uploadMedia = catchAsync(async (req, res, next) => {
    if (!req.file) {
        return next(new AppError('Vui lòng chọn file để tải lên', 400));
    }

    try {
        // Gọi service upload lên R2 (đã có sẵn trong file r2.service.js của bạn)
        const { key, url } = await r2Service.uploadFileToR2(req.file.buffer, req.file.mimetype);

        // Lưu thông tin vào Database
        const newMedia = await Media.create({
            name: req.file.originalname,
            url: url,
            fileKey: key,
            mimetype: req.file.mimetype,
            size: req.file.size,
            uploadedBy: req.user._id // Giả sử middleware auth đã gán req.user
        });

        res.status(201).json({
            success: true,
            data: newMedia
        });
    } catch (error) {
        return next(new AppError('Lỗi khi tải file lên R2', 500));
    }
});

// Xóa hình ảnh
exports.deleteMedia = catchAsync(async (req, res, next) => {
    const media = await Media.findById(req.params.id);
    if (!media) {
        return next(new AppError('Không tìm thấy file media', 404));
    }

    // 1. Xóa file trên R2
    await r2Service.deleteFileFromR2(media.fileKey);

    // 2. Xóa bản ghi trong Database
    await Media.findByIdAndDelete(req.params.id);

    res.status(200).json({
        success: true,
        message: 'Xóa media thành công'
    });
});