// BE/controllers/user.controller.js
const userService = require('../services/user.service');
const { uploadFileToR2, deleteFileFromR2 } = require('../services/r2.service.js');
const sharp = require('sharp');
const User = require('../models/user.model');

const getUsers = async (req, res, next) => {
  try {
    const users = await userService.getAllUsers();
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const newUser = await userService.createUser(req.body);
    res.status(201).json(newUser);
  } catch (error) {
    next(error);
  }
};

const getUser = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
    try {
        const user = await userService.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error) {
        next(error);
    }
};

const updateMe = async (req, res, next) => {
    try {
    const userId = req.user.id;
    const { firstName, lastName, phone, address, bio, dob } = req.body;
    const updateData = { firstName, lastName, phone, address, bio, dob };
    const updatedUser = await userService.updateUser(userId, updateData);

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

const updateAvatar = async (req, res, next) => {
  try {
    const userId = req.user.id;

    if (!req.file || !req.file.cfUrl) {
      return res.status(400).json({ message: 'Please upload an image file.' });
    }

    const oldAvatarUrl = req.user.avatar;
    if (oldAvatarUrl) {
        const oldFileKey = oldAvatarUrl.split('/').pop();
        if(oldFileKey) {
          await deleteFileFromR2(oldFileKey);
        }
    }

    const newAvatarUrl = req.file.cfUrl;
    const updatedUser = await userService.updateUser(userId, { avatar: newAvatarUrl });

    res.status(200).json({
      success: true,
      message: 'Avatar updated successfully.',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;
        await userService.changeUserPassword(userId, currentPassword, newPassword);
        res.status(200).json({
            success: true,
            message: 'Đổi mật khẩu thành công.',
        });
    } catch (error) {
        if (error.message.includes('không chính xác')) {
            return res.status(401).json({ message: error.message });
        }
        next(error);
    }
};

const uploadUserImages = async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'Vui lòng chọn ít nhất một tệp ảnh.' });
        }

        // Lấy user ID từ 'protect' middleware
        const userId = req.user.id;
        if (!userId) {
            return res.status(401).json({ message: 'Không tìm thấy người dùng. Vui lòng đăng nhập lại.' });
        }

        const uploadPromises = req.files.map(async (file) => {
            const buffer = await sharp(file.buffer)
                .resize({ width: 1920, fit: 'inside', withoutEnlargement: true }) // Giữ ảnh chất lượng tốt hơn
                .webp({ quality: 90 })
                .toBuffer();

            // SỬA Ở ĐÂY: Dùng R2
            const r2Data = await uploadFileToR2(buffer, 'image/webp');
            
            // Trả về đối tượng để lưu vào model
            return {
                name: file.originalname, // Giữ lại tên gốc để tham khảo
                url: r2Data.url,
                cfKey: r2Data.key // Đây là 'key' từ r2.service.js
            };
        });

        const uploadedImagesData = await Promise.all(uploadPromises);

        // Tạo các đối tượng mới để push vào mảng personalImages
        const newPersonalImages = uploadedImagesData.map(img => ({
            url: img.url,
            cfKey: img.cfKey,
            uploadedAt: new Date()
        }));

        // --- LOGIC ĐÃ SỬA ---
        // Sử dụng $push với $position: 0 để thêm vào đầu mảng (atomic operation)
        // Điều này an toàn hơn là sửa đổi req.user và .save()
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $push: {
                    personalImages: {
                        $each: newPersonalImages,
                        $position: 0 // Thêm vào đầu mảng
                    }
                }
            },
            { new: true } // Không bắt buộc, nhưng tốt để có
        );
        
        if (!updatedUser) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng để lưu ảnh.' });
        }
        // --- KẾT THÚC LOGIC ĐÃ SỬA ---

        // Trả về data của các ảnh vừa tải lên để FE cập nhật UI
        res.status(200).json({
            success: true,
            message: 'Các ảnh đã được tải lên và lưu thành công.',
            // Trả về định dạng { id, name, url }
            data: uploadedImagesData.map(img => ({ id: img.cfKey, name: img.name, url: img.url }))
        });

    } catch (error) {
        next(error);
    }
};
const getMyPersonalImages = async (req, res, next) => {
    try {
        if (!req.user || !req.user.personalImages) {
            return res.status(401).json({ message: 'Không tìm thấy người dùng.' });
        }
        
        // Sắp xếp ảnh, ảnh mới nhất lên đầu
        const sortedImages = req.user.personalImages.sort((a, b) => 
            (new Date(b.uploadedAt || 0)) - (new Date(a.uploadedAt || 0))
        );

        // Map về định dạng mà FE 'UserImageManager' có thể đang mong đợi
        const formattedImages = sortedImages.map(img => ({
            id: img.cfKey, // Dùng cfKey làm id duy nhất
            name: img.url.split('/').pop(), // Lấy tên file từ URL
            url: img.url
        }));

        res.status(200).json({
            success: true,
            data: formattedImages,
        });

    } catch (error) {
        next(error);
    }
};

module.exports = {
  getUsers,
  createUser,
  getUser,
  getMe,
  updateMe,
  updateAvatar,
  changePassword,
  uploadUserImages,
  getMyPersonalImages,
};
// ================== Nhạc nền & font khách tự tải lên ==================
const { detectAudio, detectFont, fontNameFromFile } = require('../utils/fileSniff');
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const MAX_FONT_BYTES = 5 * 1024 * 1024;
const MAX_FONTS_PER_USER = 50;

/** POST /users/me/upload-audio (field "file"): mp3, m4a, ogg, wav, flac, webm <= 15MB */
const uploadUserAudio = async (req, res, next) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ message: 'Vui lòng chọn tệp nhạc.' });
        if (file.size > MAX_AUDIO_BYTES) return res.status(400).json({ message: 'Tệp nhạc tối đa 15MB.' });
        const kind = detectAudio(file.buffer);
        if (!kind) return res.status(400).json({ message: 'Tệp không phải nhạc hợp lệ (hỗ trợ mp3, m4a, ogg, wav, flac).' });
        const r2 = await uploadFileToR2(file.buffer, kind.mime);
        return res.status(201).json({ status: 'success', data: { url: r2.url, name: file.originalname, mime: kind.mime } });
    } catch (error) {
        return next(error);
    }
};

/** POST /users/me/upload-font (field "file"): ttf, otf, woff, woff2 <= 5MB */
const uploadUserFont = async (req, res, next) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ message: 'Vui lòng chọn tệp font.' });
        if (file.size > MAX_FONT_BYTES) return res.status(400).json({ message: 'Tệp font tối đa 5MB.' });
        const kind = detectFont(file.buffer);
        if (!kind) return res.status(400).json({ message: 'Tệp không phải font hợp lệ (hỗ trợ .ttf, .otf, .woff, .woff2).' });
        const user = await User.findById(req.user._id).select('personalFonts');
        if (!user) return res.status(401).json({ message: 'Không tìm thấy người dùng.' });
        if ((user.personalFonts || []).length >= MAX_FONTS_PER_USER) {
            return res.status(400).json({ message: `Mỗi tài khoản lưu tối đa ${MAX_FONTS_PER_USER} font.` });
        }
        // Tên font không trùng với font đã có của khách
        const base = fontNameFromFile(file.originalname);
        const taken = new Set((user.personalFonts || []).map(f => f.name.toLowerCase()));
        let name = base;
        for (let i = 2; taken.has(name.toLowerCase()); i += 1) name = `${base} ${i}`;
        const r2 = await uploadFileToR2(file.buffer, kind.mime);
        const font = { name, url: r2.url, cfKey: r2.key, format: kind.format, uploadedAt: new Date() };
        await User.updateOne({ _id: user._id }, { $push: { personalFonts: { $each: [font], $position: 0 } } });
        return res.status(201).json({ status: 'success', data: { name, url: r2.url, format: kind.format } });
    } catch (error) {
        return next(error);
    }
};

/** GET /users/me/fonts */
const getMyFonts = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id).select('personalFonts');
        const fonts = (user?.personalFonts || []).map(f => ({ name: f.name, url: f.url, format: f.format }));
        return res.status(200).json({ status: 'success', data: fonts });
    } catch (error) {
        return next(error);
    }
};

module.exports.uploadUserAudio = uploadUserAudio;
module.exports.uploadUserFont = uploadUserFont;
module.exports.getMyFonts = getMyFonts;
