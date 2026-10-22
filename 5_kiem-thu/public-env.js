// Môi trường chạy thử đủ web + API trên máy: MongoDB tạm, backend công khai phục vụ bản build web khách (cùng nguồn /api).
// R2 và fal.ai được thay bằng bản giả (stubs.js). Mật khẩu thử ghi ra test-user.json (chỉ trên máy).
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const { spawn } = require('child_process');
const { MongoMemoryServer } = require('mongodb-memory-server');
const BE = '/Users/gmall/Desktop/ICARDS/icards-backend-master';
const mongoose = require(path.join(BE, 'node_modules/mongoose'));
const sharp = require(path.join(BE, 'node_modules/sharp'));
const PORT = 5098;
const IMG_PORT = 5095;
const BUILD = path.join(__dirname, '..', 'fe-local-build');

(async () => {
  const png = await sharp({ create: { width: 600, height: 800, channels: 3, background: { r: 238, g: 214, b: 220 } } }).png().toBuffer();
  const R2_DIR = path.join(__dirname, 'fake-r2');
  fs.mkdirSync(R2_DIR, { recursive: true });
  http.createServer((q, s) => {
    const m = /^\/r2\/([a-f0-9]+)$/.exec(q.url.split('?')[0]);
    if (m && fs.existsSync(path.join(R2_DIR, m[1]))) {
      s.writeHead(200, { 'Content-Type': fs.readFileSync(path.join(R2_DIR, `${m[1]}.mime`), 'utf8'), 'Access-Control-Allow-Origin': '*' });
      return s.end(fs.readFileSync(path.join(R2_DIR, m[1])));
    }
    s.writeHead(200, { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' }); s.end(png);
  }).listen(IMG_PORT);

  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri('icards_public_env');
  await mongoose.connect(uri);
  const User = require(path.join(BE, 'src/models/user.model'));
  const InvitationTemplate = require(path.join(BE, 'src/models/invitationTemplate.model'));
  const img = `http://localhost:${IMG_PORT}/card.png`;
  const tpl = await InvitationTemplate.create({
    category: 'Thiệp mời', group: 'Thiệp mời cưới', type: 'Online', title: 'Mẫu thử nghiệm', imgSrc: img, isActive: true,
    templateData: {
      width: 454, height: 643,
      pages: [
        { id: 'p1', name: 'Trang 1', canvasWidth: 454, canvasHeight: 643, backgroundColor: '#FBF6EE', items: [
          { id: 'i1', type: 'image', url: img, x: 77, y: 60, width: 300, height: 360, zIndex: 5 },
          { id: 't1', type: 'text', content: 'Gia Minh & Ái Ngọc', x: 52, y: 450, width: 350, height: 60, fontSize: 34, fontFamily: 'Georgia', color: '#8B5E34', zIndex: 6 },
        ] },
        { id: 'p2', name: 'Trang 2', canvasWidth: 454, canvasHeight: 643, backgroundColor: '#FFFFFF', items: [
          { id: 't2', type: 'text', content: 'Lễ thành hôn', x: 52, y: 200, width: 350, height: 60, fontSize: 30, fontFamily: 'Georgia', color: '#333', zIndex: 5 },
        ] },
      ],
      settings: { invitationType: 'Thiệp cưới', groomName: 'Gia Minh', brideName: 'Ái Ngọc' },
    },
  });
  const password = 'Test-' + crypto.randomBytes(6).toString('hex');
  await User.create({ username: 'khach-test', email: 'khach-test@example.test', password });
  fs.writeFileSync(path.join(__dirname, 'test-user.json'), JSON.stringify({ login: 'khach-test', password, templateId: String(tpl._id), mongoUri: uri }, null, 2));
  await mongoose.disconnect();
  const child = spawn(process.execPath, ['-r', path.join(__dirname, 'stubs.js'), 'index.js'], {
    cwd: BE,
    env: {
      PATH: process.env.PATH, HOME: process.env.HOME, MONGO_URI: uri, JWT_SECRET: 'local_public_secret', PORT: String(PORT), FRONTEND_BUILD_DIR: BUILD, NODE_ENV: 'production',
      ACCOUNT_ID: 'x', ACCESS_KEY_ID: 'x', SECRET_ACCESS_KEY: 'x', BUCKET_NAME: 'x', R2_PUBLIC_URL: 'https://r2.test',
      FAL_KEY: 'fake-key', FAKE_IMG_BASE: `http://localhost:${IMG_PORT}`, FAKE_R2_DIR: R2_DIR, FAKE_R2_BASE: `http://localhost:${IMG_PORT}`,
      GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'x', FACEBOOK_APP_ID: 'x', FACEBOOK_APP_SECRET: 'x',
      CALLBACK_URL: 'http://localhost/api/', FRONTEND_URL: `http://localhost:${PORT}`, CORS_EXTRA_ORIGINS: `http://localhost:${PORT}`,
    },
    stdio: 'inherit',
  });
  const stop = async () => { child.kill(); await mongo.stop(); process.exit(0); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
})();
