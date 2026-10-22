const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const mongoose = require("mongoose");
const cors = require('cors');
const cookieParser = require('cookie-parser');
const errorHandler = require('./src/middleware/errorHandler');
const routes = require('./src/routes');
const passport = require('passport');
const session = require('express-session');
const authAdminRoutes = require('./src/routes/auth.routes');
const dataAdminRoutes = require('./src/routes/admin.routes');
const designAssetRoutes = require('./src/routes/designAsset.routes'); 
const userRoutes = require('./src/routes/user.routes');
const invitationTemplateRoutes = require('./src/routes/invitationTemplate.routes');
const publicRoutes = require('./src/routes/public.routes');
const mediaRoutes = require('./src/routes/media.routes');
const publicPageRoutes = require('./src/routes/publicPage.routes');
const { blockCrossSiteWrites } = require('./src/middleware/originCheck');
require('./src/config/passport');
const app = express();
const port = process.env.PORT || 8000;
app.disable('x-powered-by');
app.set('trust proxy', 1); // chạy sau nginx: lấy đúng IP khách cho giới hạn đăng nhập
const corsOptions = {
  origin: [
    'http://localhost:3000', 'https://admin.icards.com.vn', 'https://www.admin.icards.com.vn', 'https://www.icards.com.vn', 'https://icards.com.vn',
    // Thêm tên miền khác (máy chủ thử nghiệm...) qua .env: CORS_EXTRA_ORIGINS=https://staging.icards.com.vn,http://localhost:3102
    ...String(process.env.CORS_EXTRA_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean),
  ],
  credentials: true, 
};
app.use(cors(corsOptions));
// Chặn trang web lạ gửi yêu cầu thay đổi dữ liệu kèm cookie đăng nhập của admin (CSRF)
app.use(blockCrossSiteWrites(corsOptions.origin));
// 500mb cho phép bất kỳ ai (chưa cần đăng nhập) làm tràn RAM máy chủ. Ảnh/file đi qua multer, không qua đây.
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET, 
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static('public'));
const adminApiRouter = express.Router();
adminApiRouter.use('/auth', authAdminRoutes);
adminApiRouter.use('/', dataAdminRoutes); // gồm cả /template-blocks, cần đăng nhập + vai trò nhân viên
app.use('/api/v1/admin/media', mediaRoutes);
app.use('/api/v1/admin', adminApiRouter);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/design-assets', designAssetRoutes);
app.use('/api/v1/invitation-templates', invitationTemplateRoutes);
app.use('/api/v1/public', publicRoutes);
// Trước đây toàn bộ CRUD bài viết ở đây KHÔNG cần đăng nhập (ai cũng sửa/xóa được bài, xem được bài nháp).
// Admin dùng /api/v1/admin/pages; đường dẫn này chỉ còn đọc bài đã xuất bản.
app.use('/api/v1/pages', publicPageRoutes);
app.use('/api', (req, res) => {
  res.status(404).json({ status: 'fail', message: 'Không tìm thấy API.' });
});
app.use(errorHandler);
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connect Db success!")
  })
  .catch((err) => {
    console.log(err)
  })

app.listen(port, () => {
  console.log("Server is running in port: " + port);
});