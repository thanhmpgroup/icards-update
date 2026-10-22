require('dotenv').config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const errorHandler = require('./src/middleware/errorHandler');
const routes = require('./src/routes');
const passport = require('passport');
const session = require('express-session');

const path = require('path');
const fs = require('fs');
const os = require('os');

const { FRONTEND_BUILD_DIR, DEFAULT_SHARE_IMAGE } = require('./src/config/site');
const { securityHeaders } = require('./src/middleware/securityHeaders');
const { applySeoRedirects } = require('./src/middleware/seoRedirects');
const { generateSitemap, generateRobotsTxt } = require('./src/controllers/sitemap.controller');
const { renderHtmlWithMeta } = require('./src/services/seoRenderer.service');

// --- THỬ LOAD CÁC MODEL & SERVICE VỚI CƠ CHẾ SAFE FALLBACK ---
const Invitation = require('./src/models/invitation.model');

let renderFirstPageToBuffer = null;
try {
  renderFirstPageToBuffer = require('./src/services/canvasRender.service').renderFirstPageToBuffer;
} catch (e) {
  console.warn('[SEO Warning] Không tìm thấy canvasRender.service, /og-image sẽ chuyển hướng về ảnh mặc định.');
}

require('./src/config/passport');
require('./src/cron/reminder.cron');

if (!process.env.JWT_SECRET) {
  console.warn('[Cảnh báo] Chưa khai báo JWT_SECRET trong .env: đăng nhập sẽ không hoạt động.');
}

const app = express();
const port = process.env.PORT || 5000;

const cacheDir = path.join(os.tmpdir(), 'og-cache');

const corsOptions = {
  origin: ['https://icards.com.vn', 'https://www.icards.com.vn', 'https://admin.icards.com.vn', 'https://www.admin.icards.com.vn', 'https://icards.vercel.app', 'https://icards-dashboard.vercel.app'],
  credentials: true,
};

// Không để lộ "X-Powered-By: Express"; tin cậy nginx phía trước để nhận đúng IP/HTTPS
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(securityHeaders);
app.use(compression());

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret_key',
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// ============================================================
// 1. SITEMAP.XML & ROBOTS.TXT
// Đặt TRƯỚC express.static: trước đây file robots.txt cũ trong thư mục build
// (Sitemap: https://your-domain.com/...) được phục vụ thay cho route động này.
// ============================================================
app.get('/sitemap.xml', generateSitemap);
app.get('/robots.txt', generateRobotsTxt);
// RSS blog: Google News / ứng dụng đọc tin / Cốc Cốc phát hiện bài mới nhanh hơn
app.get('/rss.xml', require('./src/services/blogSeo.service').generateRss);

// Bảng chuyển hướng 301/302 do admin cấu hình trong trang Quản lý SEO
app.use(applySeoRedirects);

// ============================================================
// 2. FILE TĨNH: file trong /static/ của React có mã hash trong tên -> cho trình duyệt cache 1 năm
// ============================================================
const staticOptions = {
  index: false,
  setHeaders: (res, filePath) => {
    if (filePath.includes(`${path.sep}static${path.sep}`)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
};
app.use(express.static(path.join(__dirname, 'public'), staticOptions));
app.use(express.static(FRONTEND_BUILD_DIR, staticOptions));

if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

// ============================================================
// 3. ẢNH CHIA SẺ (OG IMAGE) CỦA THIỆP
// ============================================================
app.get('/og-image/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Chỉ chấp nhận guestId dạng ObjectId: giá trị này được dùng làm tên file cache,
    // nếu không kiểm tra có thể bị lợi dụng ghi file ra ngoài thư mục cache (vd: "../../")
    const guestId = mongoose.Types.ObjectId.isValid(req.query.guestId) ? String(req.query.guestId) : null;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).send('Not found');
    }

    const cacheKey = guestId ? `${id}_${guestId}` : id;
    const cacheFile = path.join(cacheDir, `${cacheKey}.png`);

    if (fs.existsSync(cacheFile)) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return fs.createReadStream(cacheFile).pipe(res);
    }

    if (!renderFirstPageToBuffer) {
      return res.redirect(DEFAULT_SHARE_IMAGE);
    }

    const invitation = await Invitation.findById(id)
      .select('content imgSrc guests')
      .lean();

    if (!invitation?.content?.length) {
      return res.redirect(DEFAULT_SHARE_IMAGE);
    }

    const guest = guestId
      ? invitation.guests?.find(g => g._id.toString() === guestId)
      : null;

    const guestDetails = guest
      ? { name: guest.name, salutation: guest.salutation, greetingName: [guest.addressTerm, guest.name].filter(Boolean).join(' ') }
      : null;

    const firstPage = invitation.content[0];
    const originalWidth = firstPage.canvasWidth || 567;

    const imageBuffer = await renderFirstPageToBuffer(firstPage, originalWidth, guestDetails);

    fs.writeFile(cacheFile, imageBuffer, (err) => {
      if (err) console.error('OG Image cache write error:', err.message);
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(imageBuffer);

  } catch (error) {
    console.error('OG Image render error:', error);
    res.redirect(DEFAULT_SHARE_IMAGE);
  }
});

// ============================================================
// 4. MOUNT CÁC API VÀ ERROR HANDLER
// ============================================================
app.use('/api', routes);
// API không tồn tại -> trả JSON 404 thay vì trang HTML của React
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Không tìm thấy API.' });
});
app.use(errorHandler);

// ============================================================
// 5. CATCH-ALL ROUTE CHO FRONTEND REACT (ĐẶT Ở BƯỚC CUỐI CÙNG)
// Gắn thẻ meta SEO và trả đúng mã 200/301/404 cho từng URL
// ============================================================
app.get(/.*/, (req, res) => {
  renderHtmlWithMeta(req, res);
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connect Db success!");
  })
  .catch((err) => {
    console.log(err);
  });

app.listen(port, () => {
  console.log("Server is running in port: " + port);
});
