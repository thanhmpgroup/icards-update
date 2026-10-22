// AdminBE/controllers/admin.controller.js

const adminService = require('../services/admin.service');
const _ = require('lodash');
const sharp = require('sharp');
const { uploadFileToCloudflare } = require('../services/cloudflare.service.js');
const { uploadFileToR2 } = require('../services/r2.service.js'); // Import R2 service

exports.getDashboardData = async (req, res, next) => {
    try {
        const data = await adminService.getDashboardData({ days: req.query.days });
        // Tên, email khách hàng chỉ dành cho admin; designer/marketing chỉ thấy số liệu tổng.
        if (req.user?.role !== 'admin') {
            data.recentCustomers = [];
            data.recentInvitations = data.recentInvitations.map(({ customer, ...rest }) => rest);
        }
        res.status(200).json(data);
    } catch (error) {
        next(error);
    }
};

exports.getSettings = async (req, res, next) => {
    try {
        // Tìm bản ghi settings (thường collection này chỉ chứa 1 document duy nhất)
        const settings = await adminService.getSettings(); // Hoặc await Settings.findOne(); tùy logic service của bạn

        res.status(200).json({
            message: "Lấy cấu hình thành công",
            data: settings || {} // Trả về object rỗng nếu hệ thống chưa có cấu hình nào
        });
    } catch (error) {
        next(error);
    }
};
const createSlug = (text) => {
    return text.toString().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/([^0-9a-z-\s])/g, '')
        .replace(/(\s+)/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
};
exports.updateSettings = async (req, res, next) => {
    try {
        const settingsData = JSON.parse(req.body.settings || '{}');

        if (req.files && req.files.length > 0) {
            const fileUrlMap = new Map();
            const uploadPromises = req.files.map(async (file) => {
                let finalUrl = '';
                
                // === START: MODIFICATION ===
                if (file.mimetype.startsWith('video/')) {
                    // 1. Video được tải lên R2
                    const { url } = await uploadFileToR2(file.buffer, file.mimetype, file.originalname);
                    finalUrl = url;
                
                } else if (file.mimetype.startsWith('font/') || file.mimetype === 'application/octet-stream') {
                    // 2. Font (hoặc file nhị phân) được tải lên R2
                    const { url } = await uploadFileToR2(file.buffer, file.mimetype, file.originalname);
                    finalUrl = url;

                } else if (file.mimetype.startsWith('image/')) {
                    // 3. TẤT CẢ các loại ảnh (JPG, PNG, GIF, SVG) đi qua Cloudflare Images
                    
                    // Chỉ xử lý (resize, webp) các ảnh không phải GIF/SVG
                    if (file.mimetype !== 'image/gif' && file.mimetype !== 'image/svg+xml') {
                        const fileBuffer = await sharp(file.buffer)
                            .resize({ width: 1920, fit: 'inside', withoutEnlargement: true })
                            .webp({ quality: 85 })
                            .toBuffer();
                        
                        // Gửi buffer đã xử lý và contentType mới ('image/webp')
                        const { url } = await uploadFileToCloudflare(fileBuffer, 'image/webp');
                        finalUrl = url;
                    } else {
                        // Giữ nguyên GIF và SVG, tải trực tiếp lên Cloudflare Images
                        const { url } = await uploadFileToCloudflare(file.buffer, file.mimetype);
                        finalUrl = url;
                    }
                } else {
                     // 4. Các loại file khác (nếu có) mặc định lên R2
                    const { url } = await uploadFileToR2(file.buffer, file.mimetype, file.originalname);
                    finalUrl = url;
                }
                // === END: MODIFICATION ===

                fileUrlMap.set(file.fieldname, finalUrl);
            });
            await Promise.all(uploadPromises);
            
            if (Array.isArray(settingsData.banners)) {
                settingsData.banners.forEach((banner, index) => {
                    const isVideo = banner.mediaType === 'video';
                    const mediaField = isVideo ? 'videoUrl' : 'imageUrl';
                    // Ưu tiên tên trường theo mã banner (bannerid__<id>__imageUrl): thêm/xoá/sắp xếp slide
                    // không làm lệch ảnh. Vẫn nhận kiểu cũ theo thứ tự (banners__<index>__imageUrl).
                    const byIdField = banner.id ? `bannerid__${banner.id}__${mediaField}` : null;
                    const fieldName = byIdField && fileUrlMap.has(byIdField)
                        ? byIdField
                        : `banners__${index}__${mediaField}`;

                    if (fileUrlMap.has(fieldName)) {
                        if (isVideo) {
                            banner.videoUrl = fileUrlMap.get(fieldName);
                            banner.imageUrl = '';
                        } else {
                            banner.imageUrl = fileUrlMap.get(fieldName);
                            banner.videoUrl = '';
                        }
                    }
                });
            }

            for (const [fieldName, url] of fileUrlMap.entries()) {
                if (!fieldName.startsWith('banners__') && !fieldName.startsWith('bannerid__')) {
                    const path = fieldName.replace(/__/g, '.');
                    _.set(settingsData, path, url);
                }
            }
        }
        
        if (settingsData.occasionSections && Array.isArray(settingsData.occasionSections)) {
            settingsData.occasionSections = settingsData.occasionSections.map(sec => {
                // Nếu section chưa có slug, tự động tạo slug từ title
                if (!sec.slug && sec.title) {
                    sec.slug = createSlug(sec.title);
                }
                return sec;
            });
        }
        // === KẾT THÚC BỔ SUNG ===

        const updatedSettings = await adminService.updateSettings(settingsData);
        
        res.status(200).json({
            message: "Cài đặt đã được cập nhật thành công.",
            data: updatedSettings
        });
    } catch (error) {
        next(error);
    }
};