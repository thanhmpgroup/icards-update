// AdminBE/middleware/upload.middleware.js

const multer = require('multer');
const sharp = require('sharp');
const AppError = require('../utils/AppError');
const { uploadFileToR2 } = require('../services/r2.service.js');
// === START: MODIFICATION ===
// Import dịch vụ Cloudflare Images THỰC SỰ (đã sửa ở bước 1)
const { uploadFileToCloudflare: uploadToCfImages } = require('../services/cloudflare.service.js');
// === END: MODIFICATION ===


// ... (storage, FONT_MIME_TYPES, fileFilter, upload, resizeImage giữ nguyên) ...
const storage = multer.memoryStorage();
const FONT_MIME_TYPES = [
    'font/ttf',
    'font/otf',
    'font/woff',
    'font/woff2',
    'application/font-woff',
    'application/font-woff2',
    'application/x-font-truetype',
    'application/x-font-opentype',
    'application/vnd.ms-fontobject',
    'application/font-sfnt',
    'application/octet-stream', // Đôi khi Windows gửi font dưới dạng stream chung
    'application/x-font-ttf',   // Bổ sung thêm
    'font/collection',          // Bổ sung thêm
    'font/opentype'             // Bổ sung thêm
];

const fileFilter = (req, file, cb) => {
    // 2. Lấy đuôi file để làm fallback check (Rất quan trọng cho Font)
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    const validFontExtensions = ['ttf', 'otf', 'woff', 'woff2'];

    const allowedImageMimeTypes = file.mimetype.startsWith('image/');
    const allowedVideoMimeTypes = file.mimetype.startsWith('video/'); 
    
    // 3. Logic check Font: Hợp lệ nếu MimeType đúng HOẶC đuôi file chuẩn
    const isFontMimeType = FONT_MIME_TYPES.includes(file.mimetype);
    const isFontExtension = validFontExtensions.includes(fileExtension);
    const allowedFontMimeTypes = isFontMimeType || isFontExtension;

    const allowedZipMimeTypes = [
        'application/zip', 
        'application/x-zip-compressed', 
        'multipart/x-zip'
    ].includes(file.mimetype);

    if (allowedImageMimeTypes || allowedFontMimeTypes || allowedZipMimeTypes || allowedVideoMimeTypes) {
        cb(null, true);
    } else {
        if (fileExtension === 'zip') {
            cb(null, true);
            return;
        }
        console.warn(`[Cảnh báo Upload] Bị từ chối: File ${file.originalname} có mimetype là ${file.mimetype}`);
        cb(new AppError(`File không hợp lệ! Vui lòng chỉ tải lên ảnh, video, font chữ (.ttf, .otf, .woff, .woff2) hoặc file .zip.`, 400), false);
    }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { 
      fileSize: 1024 * 1024 * 500, 
      files: 200
  }, 
});


const resizeImage = async (req, res, next) => {
  if (!req.file || req.files) {
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

// Hàm này dùng cho R2 (fonts, videos), giữ nguyên
const uploadImageToR2 = async (req, res, next) => {
  if (!req.file || req.files) {
    return next();
  }
  try {
    const { buffer } = req.file;
    const cfData = await uploadFileToR2(buffer, req.file.mimetype, req.file.originalname);
    req.file.cfUrl = cfData.url;
    req.file.cfId = cfData.id; // (hoặc key)
    next();
  } catch (error) {
    console.error('Lỗi khi tải ảnh lên R2:', error);
    next(error);
  }
}

// === START: MODIFICATION ===
// Sửa hàm này để nó gọi Cloudflare Images (uploadToCfImages)
const uploadImageToCloudflare = async (req, res, next) => {
  if (!req.file || req.files) {
    return next();
  }

  try {
    const { buffer } = req.file;
    // Gọi dịch vụ Cloudflare Images đã được import
    const cfData = await uploadToCfImages(buffer, req.file.mimetype);

    // Gắn URL và ID của Cloudflare Images vào request
    req.file.cfUrl = cfData.url;
    req.file.cfId = cfData.id; 

    next();
  } catch (error) {
    console.error('Error uploading image to Cloudflare Images:', error);
    next(error);
  }
}
// === END: MODIFICATION ===

module.exports = {
  upload,
  resizeImage,
  uploadImageToCloudflare, // (Giờ đã trỏ đến Cloudflare Images)
  uploadImageToR2 // (Vẫn trỏ đến R2)
};