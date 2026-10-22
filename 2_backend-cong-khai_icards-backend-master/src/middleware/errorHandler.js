const errorHandler = (err, req, res, next) => {
  // Chuẩn hóa mã lỗi: ưu tiên mã do AppError/multer gán, sau đó tới các lỗi Mongoose phổ biến
  let statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  let message = err.message;

  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Dữ liệu hoặc ID không hợp lệ.';
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
  } else if (err.code === 11000) {
    statusCode = 409;
    message = 'Dữ liệu đã tồn tại (bị trùng).';
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = 'Tệp tải lên quá lớn.';
  }

  if (statusCode >= 500) {
    console.error(err.stack);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  res.status(statusCode).json({
    message: isProduction && statusCode >= 500 ? 'Đã có lỗi xảy ra, vui lòng thử lại sau.' : message,
    stack: isProduction ? null : err.stack,
  });
};

module.exports = errorHandler;
