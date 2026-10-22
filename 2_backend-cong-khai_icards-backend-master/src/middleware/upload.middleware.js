// BE/middleware/upload.middleware.js
// THAY ĐỔI: Dùng require
const multer = require('multer');
const sharp = require('sharp');
const { uploadFileToR2 } = require('../services/r2.service.js');
const AppError = require('../utils/AppError');
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new AppError('Chỉ chấp nhận tệp hình ảnh.', 400), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,limits: {
    // Ảnh được giữ trong RAM trước khi nén, nên giới hạn 30MB/ảnh (trước đây 500MB, dễ làm treo máy chủ)
    fileSize: 1024 * 1024 * 30,
    // Thêm giới hạn fieldSize để cho phép các trường JSON (content, settings) lớn hơn
    fieldSize: 1024 * 1024 * 200
  },
});

const resizeImage = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    const buffer = await sharp(req.file.buffer)
      .resize({ width: 800, height: 800, fit: 'inside' })
      .webp({ quality: 90 })
      .toBuffer();
    
    req.file.buffer = buffer;
    req.file.mimetype = 'image/webp';
    next();
  } catch (error) {
    console.error('Error resizing image:', error);
    next(error);
  }
};

const uploadImageToCloudflare = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    // Lấy thêm mimetype cho R2
    const { buffer, mimetype } = req.file; 
    
    // Sử dụng R2 service
    const r2Data = await uploadFileToR2(buffer, mimetype);

    // Vẫn gán vào cfUrl để nhất quán với các controller
    req.file.cfUrl = r2Data.url; 
    req.file.cfKey = r2Data.key; // Gán key để có thể xóa

    next();
  } catch (error) {
    console.error('Error uploading image to R2:', error); // Sửa log
    next(error);
  }
}

// THAY ĐỔI: Dùng module.exports
module.exports = {
  upload,
  resizeImage,
  uploadImageToCloudflare
};