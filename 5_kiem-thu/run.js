// Kiểm thử API mới (đợt xmind): tên thiệp/đường dẫn, khối hình, thư mục, thả tim, tải nhạc/font, AI, font trong design.
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { MongoMemoryServer } = require('mongodb-memory-server');
const BE = '/Users/gmall/Desktop/ICARDS/icards-backend-master';
const ADMIN_BE = '/Users/gmall/Desktop/ICARDS/icards-dashboard-backend-master';
const mongoose = require(path.join(BE, 'node_modules/mongoose'));
const sharp = require(path.join(BE, 'node_modules/sharp'));
const PORT = 5097;
const IMG_PORT = 5096;
const API = `http://127.0.0.1:${PORT}/api`;

let pass = 0; let fail = 0;
const ok = (cond, name, extra) => { if (cond) { pass += 1; console.log('PASS', name); } else { fail += 1; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); } };

const cookieJar = {};
const req = async (method, url, { body, form, who } = {}) => {
  const headers = { Origin: 'http://localhost:3000' };
  if (who && cookieJar[who]) headers.Cookie = cookieJar[who];
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(API + url, { method, headers, body: payload });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie && who) cookieJar[who] = setCookie.split(';')[0];
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  return { status: res.status, data };
};

const pagesWithShape = () => JSON.stringify([{
  id: 'p1', name: 'Trang 1', canvasWidth: 454, canvasHeight: 643, backgroundColor: '#fff',
  items: [
    { id: 's1', type: 'shape', shapeType: 'heart', x: 10, y: 10, width: 80, height: 80, fill: '#f00', fillEnabled: true, zIndex: 6, effect: { type: 'shadow', blur: 10 }, animation: { type: 'pop', duration: 0.8, delay: 0 } },
    { id: 'i1', type: 'image', url: 'https://r2.test/a.webp', x: 0, y: 0, width: 200, height: 200, frameShape: 'heart', imageScale: 1.4, imagePosition: { x: 5, y: -3 }, flipX: true, zIndex: 5 },
    { id: 't1', type: 'text', content: 'Gia Minh', x: 50, y: 300, width: 200, height: 40, fontSize: 30, textStrokeColor: '#fff', textStrokeWidth: 2, letterSpacing: 2, lineHeight: 1.5, zIndex: 7 },
    { id: 'tb1', type: 'table', rows: 2, cols: 2, cells: [['Giờ', 'Nội dung'], ['17:00', 'Đón khách']], headerRow: true, borderColor: '#8B5E34', x: 20, y: 400, width: 300, height: 72, zIndex: 8 },
    { id: 'd1', type: 'shape', shapeType: 'path', drawKind: 'signature', pathData: 'M 1 1 Q 5 5 10 2 L 20 8', viewBoxW: 22, viewBoxH: 10, x: 30, y: 500, width: 22, height: 10, stroke: '#1E3A8A', strokeWidth: 2.4, zIndex: 9 },
    { id: 'n1', type: 'text', content: 'Ghi chú', boxBackground: '#FFF3A3', boxPadding: 14, boxRadius: 4, minBoxHeight: 180, x: 200, y: 100, width: 180, height: 180, zIndex: 10 },
  ],
}]);

const invitationForm = (fields) => {
  const f = new FormData();
  Object.entries(fields).forEach(([k, v]) => f.append(k, v));
  return f;
};

(async () => {
  // Ảnh giả để "AI" trả về
  const png = await sharp({ create: { width: 64, height: 80, channels: 3, background: { r: 240, g: 200, b: 210 } } }).png().toBuffer();
  const imgServer = http.createServer((q, s) => { s.writeHead(200, { 'Content-Type': 'image/png' }); s.end(png); }).listen(IMG_PORT);

  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri('icards_xmind_test');
  await mongoose.connect(uri);
  const User = require(path.join(BE, 'src/models/user.model'));
  const InvitationTemplate = require(path.join(BE, 'src/models/invitationTemplate.model'));
  const Invitation = require(path.join(BE, 'src/models/invitation.model'));
  const tpl = await InvitationTemplate.create({ category: 'Thiệp mời', group: 'Thiệp mời cưới', type: 'Online', title: 'Khung Vòm Hồng Phấn', imgSrc: 'https://r2.test/t.webp', isActive: true, templateData: { pages: [], settings: {} } });
  await User.create({ username: 'chuthiep', email: 'chuthiep@example.test', password: 'Mk-test-123456' });
  await User.create({ username: 'nguoikhac', email: 'nguoikhac@example.test', password: 'Mk-test-123456' });

  const env = {
    PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'test', PORT: String(PORT), MONGO_URI: uri, JWT_SECRET: 'test_secret_xmind',
    ACCOUNT_ID: 'x', ACCESS_KEY_ID: 'x', SECRET_ACCESS_KEY: 'x', BUCKET_NAME: 'x', R2_PUBLIC_URL: 'https://r2.test',
    FAL_KEY: 'fake-key', FAKE_IMG_BASE: `http://127.0.0.1:${IMG_PORT}`,
    GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'x', FACEBOOK_APP_ID: 'x', FACEBOOK_APP_SECRET: 'x',
    CALLBACK_URL: 'http://localhost/api/', FRONTEND_URL: 'http://localhost:3000', CLOUDFLARE_API_TOKEN: '', RESEND_API_KEY: '',
  };
  const child = spawn(process.execPath, ['-r', path.join(__dirname, 'stubs.js'), 'index.js'], { cwd: BE, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  child.stdout.on('data', d => { logs += d; });
  child.stderr.on('data', d => { logs += d; });
  for (let i = 0; i < 60; i += 1) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/api/invitation-templates?limit=1`); if (r.status < 500) break; } catch (e) { /* chờ */ }
    await new Promise(r => setTimeout(r, 500));
  }

  try {
    // Đăng nhập
    let r = await req('POST', '/auth/login', { body: { login: 'chuthiep', password: 'Mk-test-123456' }, who: 'owner' });
    ok(r.status === 200 && cookieJar.owner, 'đăng nhập chủ thiệp', r);
    r = await req('POST', '/auth/login', { body: { login: 'nguoikhac', password: 'Mk-test-123456' }, who: 'other' });
    ok(r.status === 200, 'đăng nhập người khác', r);

    // 1. Tạo thiệp không gửi slug: tên giữ nguyên, slug tự tạo, khối hình lưu được
    r = await req('POST', '/invitations', { who: 'owner', form: invitationForm({ templateId: String(tpl._id), name: 'Đám cưới Minh & Lan', folder: 'Đám cưới', content: pagesWithShape(), design: JSON.stringify({ customFonts: [{ name: 'Font Của Tôi', url: 'https://r2.test/f.woff2', format: 'woff2' }] }), settings: JSON.stringify({ invitationType: 'Thiệp cưới' }) }) });
    const inv1 = r.data?.data;
    ok(r.status === 201, 'tạo thiệp không cần slug (201)', r);
    ok(inv1?.name === 'Đám cưới Minh & Lan', 'tên thiệp giữ nguyên chữ có dấu', inv1?.name);
    ok(inv1?.slug === 'dam-cuoi-minh-lan', 'đường dẫn tự tạo từ tên', inv1?.slug);
    ok(inv1?.folder === 'Đám cưới', 'thư mục lưu khi tạo', inv1?.folder);
    const items = inv1?.content?.[0]?.items || [];
    ok(items.some(i => i.type === 'shape' && i.shapeType === 'heart'), 'khối hình (type shape) lưu được (trước đây bị từ chối)', items.map(i => i.type));
    const img = items.find(i => i.id === 'i1') || {};
    ok(img.frameShape === 'heart' && img.imageScale === 1.4 && img.flipX === true && img.imagePosition?.x === 5, 'khung ảnh, phóng ảnh, lật lưu đủ', img);
    const shp = items.find(i => i.id === 's1') || {};
    const tb = items.find(i => i.id === 'tb1') || {};
    ok(tb.type === 'table' && tb.rows === 2 && tb.cells?.[1]?.[1] === 'Đón khách', 'phần tử bảng (type table) lưu được đủ ô chữ', tb);
    const sig = items.find(i => i.id === 'd1') || {};
    ok(sig.drawKind === 'signature' && sig.viewBoxW === 22 && sig.pathData?.startsWith('M 1 1'), 'nét chữ ký (vẽ tay) lưu đủ khung gốc', sig);
    const note = items.find(i => i.id === 'n1') || {};
    ok(note.boxBackground === '#FFF3A3' && note.boxPadding === 14 && note.minBoxHeight === 180, 'ghi chú dán lưu nền khung chữ', note);
    ok(shp.effect?.type === 'shadow' && shp.animation?.type === 'pop', 'hiệu ứng và chuyển động lưu đủ', shp);
    const txt = items.find(i => i.id === 't1') || {};
    ok(txt.textStrokeWidth === 2 && txt.letterSpacing === 2 && txt.lineHeight === 1.5, 'viền chữ, giãn chữ, giãn dòng lưu đủ', txt);
    ok(inv1?.design?.customFonts?.[0]?.name === 'Font Của Tôi', 'font riêng lưu trong design', inv1?.design);

    // 2. Trùng tên -> đường dẫn -2 (không còn 409 hay ký tự ngẫu nhiên)
    r = await req('POST', '/invitations', { who: 'owner', form: invitationForm({ templateId: String(tpl._id), name: 'Đám cưới Minh & Lan', content: pagesWithShape() }) });
    ok(r.status === 201 && r.data?.data?.slug === 'dam-cuoi-minh-lan-2', 'trùng tên -> đường dẫn thêm -2', r.data?.data?.slug);
    const inv2 = r.data?.data;
    // Người khác đặt cùng tên -> -3 (đường dẫn duy nhất toàn hệ thống)
    r = await req('POST', '/invitations', { who: 'other', form: invitationForm({ templateId: String(tpl._id), name: 'Đám cưới Minh & Lan', content: pagesWithShape() }) });
    ok(r.status === 201 && r.data?.data?.slug === 'dam-cuoi-minh-lan-3', 'người khác cùng tên -> -3', r.data?.data?.slug);
    const invOther = r.data?.data;
    // Không gửi tên -> lấy tên mẫu
    r = await req('POST', '/invitations', { who: 'owner', form: invitationForm({ templateId: String(tpl._id), content: pagesWithShape() }) });
    ok(r.status === 201 && r.data?.data?.name === 'Khung Vòm Hồng Phấn' && r.data?.data?.slug === 'khung-vom-hong-phan', 'không gửi tên -> dùng tên mẫu', r.data?.data);

    // 3. Đổi tên không đổi đường dẫn
    r = await req('PUT', `/invitations/${inv1._id}`, { who: 'owner', form: invitationForm({ name: 'Tiệc cưới Minh – Lan 2026', content: pagesWithShape() }) });
    ok(r.status === 200 && r.data?.data?.name === 'Tiệc cưới Minh – Lan 2026' && r.data?.data?.slug === 'dam-cuoi-minh-lan', 'đổi tên giữ nguyên đường dẫn đã gửi khách', r.data?.data);
    r = await req('PUT', `/invitations/${inv1._id}`, { who: 'owner', form: invitationForm({ folder: 'x'.repeat(61), content: pagesWithShape() }) });
    ok(r.status === 400, 'tên thư mục quá 60 ký tự bị từ chối', r);

    // 4. Thư mục
    r = await req('PATCH', `/invitations/${inv2._id}/folder`, { who: 'owner', body: { folder: '  Sinh   nhật  ' } });
    ok(r.status === 200 && r.data?.data?.folder === 'Sinh nhật', 'chuyển thiệp vào thư mục (gọn khoảng trắng)', r);
    r = await req('PATCH', `/invitations/${invOther._id}/folder`, { who: 'owner', body: { folder: 'Lấy trộm' } });
    ok(r.status === 404, 'không đổi được thư mục thiệp người khác', r);
    r = await req('PATCH', `/invitations/${inv2._id}/folder`, { body: { folder: 'A' } });
    ok(r.status === 401, 'chưa đăng nhập không đổi được thư mục', r);
    r = await req('GET', '/invitations?summary=1', { who: 'owner' });
    const list = r.data?.data || [];
    ok(r.status === 200 && list.length === 3 && list.every(i => i.content === undefined && i.name), 'danh sách rút gọn cho tab Dự án (không kèm nội dung)', list.map(i => Object.keys(i)));

    // 5. Thả tim
    r = await req('POST', `/wishes/public/${inv1._id}/heart`, { body: { key: 'khach123abc' } });
    ok(r.status === 200 && r.data?.data?.hearts === 1 && r.data.data.alreadyHearted === false, 'thả tim lần đầu', r);
    r = await req('POST', `/wishes/public/${inv1._id}/heart`, { body: { key: 'khach123abc' } });
    ok(r.data?.data?.hearts === 1 && r.data.data.alreadyHearted === true, 'cùng người thả lần 2 không tăng', r);
    r = await req('POST', `/wishes/public/${inv1._id}/heart`, { body: { key: 'nguoikhac9999' } });
    ok(r.data?.data?.hearts === 2, 'người khác thả tim -> 2', r);
    r = await req('POST', `/wishes/public/${inv1._id}/heart`, { body: { key: 'a b<script>' } });
    ok(r.status === 400, 'mã thả tim không hợp lệ bị từ chối', r);
    r = await req('POST', `/wishes/public/notanid/heart`, { body: { key: 'khach123abc' } });
    ok(r.status === 404, 'thiệp không tồn tại -> 404', r);
    r = await req('GET', `/invitations/public/${inv1._id}`);
    ok(r.data?.data?.reactions?.hearts === 2 && JSON.stringify(r.data).indexOf('khach123abc') === -1, 'trang thiệp có số tim, không lộ danh sách người thả', r.data?.data?.reactions);
    const raw = await Invitation.findById(inv1._id).select('+heartKeys').lean();
    ok(raw.heartKeys?.length === 2, 'lưu khoá người thả tim (ẩn với API)', raw.heartKeys);

    // 6. Phản hồi một dòng (dùng sổ lời chúc)
    r = await req('POST', `/wishes/public/${inv1._id}`, { body: { senderName: 'Bố Minh', content: 'Cảm ơn các con!' } });
    ok(r.status === 201, 'gửi một dòng phản hồi', r);

    // 7. Tải nhạc
    const mp3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(200, 1)]);
    let f = new FormData(); f.append('file', new Blob([mp3], { type: 'audio/mpeg' }), 'nhac-cuoi.mp3');
    r = await req('POST', '/users/me/upload-audio', { who: 'owner', form: f });
    ok(r.status === 201 && /^https:\/\/r2\.test\//.test(r.data?.data?.url) && /audio%2Fmpeg/.test(r.data.data.url), 'tải nhạc mp3', r);
    f = new FormData(); f.append('file', new Blob([Buffer.from('<html><script>alert(1)</script></html>')], { type: 'audio/mpeg' }), 'gia.mp3');
    r = await req('POST', '/users/me/upload-audio', { who: 'owner', form: f });
    ok(r.status === 400, 'tệp HTML đổi đuôi .mp3 bị từ chối', r);
    f = new FormData(); f.append('file', new Blob([mp3]), 'a.mp3');
    r = await req('POST', '/users/me/upload-audio', { form: f });
    ok(r.status === 401, 'chưa đăng nhập không tải nhạc được', r);

    // 8. Tải font
    const woff2 = Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(100, 2)]);
    f = new FormData(); f.append('file', new Blob([woff2]), 'Great_Vibes-Regular.woff2');
    r = await req('POST', '/users/me/upload-font', { who: 'owner', form: f });
    ok(r.status === 201 && r.data?.data?.name === 'Great Vibes-Regular' && r.data.data.format === 'woff2', 'tải font woff2, tên lấy từ tệp', r);
    f = new FormData(); f.append('file', new Blob([woff2]), 'Great_Vibes-Regular.woff2');
    r = await req('POST', '/users/me/upload-font', { who: 'owner', form: f });
    ok(r.data?.data?.name === 'Great Vibes-Regular 2', 'font trùng tên -> thêm số', r.data?.data);
    f = new FormData(); f.append('file', new Blob([Buffer.from('MZ' + 'x'.repeat(50))]), 'virus.ttf');
    r = await req('POST', '/users/me/upload-font', { who: 'owner', form: f });
    ok(r.status === 400, 'tệp không phải font bị từ chối', r);
    r = await req('GET', '/users/me/fonts', { who: 'owner' });
    ok(r.status === 200 && r.data?.data?.length === 2, 'danh sách font của khách', r.data);
    r = await req('GET', '/users/me/fonts', { who: 'other' });
    ok(r.data?.data?.length === 0, 'font của người khác không lẫn sang', r.data);

    // 9. Tạo ảnh AI
    r = await req('POST', '/ai/card-art', { body: { prompt: 'hoa' } });
    ok(r.status === 401, 'AI cần đăng nhập', r);
    r = await req('POST', '/ai/card-art', { who: 'owner', body: { prompt: 'hoa', style: 'khong-co' } });
    ok(r.status === 400, 'AI: phong cách không hợp lệ', r);
    r = await req('POST', '/ai/card-art', { who: 'owner', body: { prompt: 'x'.repeat(301) } });
    ok(r.status === 400, 'AI: mô tả quá 300 ký tự', r);
    r = await req('POST', '/ai/card-art', { who: 'owner', body: { prompt: 'hoa hồng phấn, tông kem', style: 'watercolor-floral', aspect: 'portrait' } });
    ok(r.status === 200 && r.data?.data?.images?.length === 2 && r.data.data.images.every(u => /image%2Fwebp/.test(u)), 'AI trả 2 ảnh đã lưu (webp)', r);
    r = await req('POST', '/ai/card-art', { who: 'owner', body: { prompt: 'hoa', style: 'tet' } });
    ok(r.status === 429, 'AI: bấm liên tục bị chặn tạm', r);

    // 11. Watermark: thiệp từ mẫu miễn phí có dấu, mẫu trả phí thì không (máy chủ quyết định)
    r = await req('GET', `/invitations/public/${inv1._id}`);
    ok(r.status === 200 && r.data?.data?.watermark === true, 'thiệp từ mẫu miễn phí: watermark = true', r.data?.data?.watermark);
    const paidTpl = await InvitationTemplate.create({ category: 'Thiệp mời', group: 'Thiệp mời cưới', type: 'Online', title: 'Mẫu trả phí', imgSrc: 'https://r2.test/p.webp', isActive: true, price: 150000, templateData: { pages: [], settings: {} } });
    r = await req('POST', '/invitations', { who: 'owner', form: invitationForm({ templateId: String(paidTpl._id), name: 'Thiệp trả phí', content: pagesWithShape(), settings: JSON.stringify({ invitationType: 'Thiệp cưới' }) }) });
    const paidInv = r.data?.data;
    r = await req('GET', `/invitations/public/${paidInv?._id}`);
    ok(r.status === 200 && r.data?.data?.watermark === false, 'thiệp từ mẫu trả phí: không watermark', r.data?.data?.watermark);
    r = await req('GET', `/invitations/${inv1._id}`, { who: 'owner' });
    ok(r.status === 200 && r.data?.data?.watermark === true && r.data?.data?.content?.length > 0, 'chủ thiệp mở thiệp: có cờ watermark, dữ liệu đủ', r.data?.data?.watermark);
    if (inv1.slug) {
      r = await req('GET', `/invitations/slug/${inv1.slug}`);
      if (r.status === 200) ok(r.data?.data?.watermark === true, 'xem theo đường dẫn (slug): có cờ watermark', r.data?.data?.watermark);
    }

    // 12. Đánh giá của khách
    r = await req('POST', '/reviews', { body: { rating: 5, content: 'Rất dễ dùng, thiệp đẹp' } });
    ok(r.status === 401, 'chưa đăng nhập không viết đánh giá được', r.status);
    r = await req('POST', '/reviews', { who: 'owner', body: { rating: 0, content: 'Rất dễ dùng, thiệp đẹp' } });
    ok(r.status === 400, 'đánh giá: số sao không hợp lệ bị từ chối', r);
    r = await req('POST', '/reviews', { who: 'owner', body: { rating: 5, content: 'ngắn' } });
    ok(r.status === 400, 'đánh giá: nội dung quá ngắn bị từ chối', r);
    r = await req('POST', '/reviews', { who: 'owner', body: { rating: 5, title: '<b>Tuyệt vời</b>', content: 'Rất dễ dùng <script>alert(1)</script>, thiệp đẹp lắm', displayName: 'Chị Lan' } });
    ok(r.status === 200 && r.data?.data?.status === 'pending' && r.data?.data?.hasCreatedCard === true, 'đánh giá mới: chờ duyệt, có nhãn đã tạo thiệp', r.data);
    ok(!/<|>/.test(r.data?.data?.title + r.data?.data?.content), 'đánh giá: bỏ thẻ HTML', r.data?.data);
    r = await req('GET', '/reviews/public');
    ok(r.status === 200 && r.data?.data?.length === 0 && r.data?.stats?.count === 0, 'đánh giá chưa duyệt không hiện công khai', r.data);
    const Review = require(path.join(BE, 'src/models/review.model'));
    await Review.updateMany({}, { status: 'approved' });
    r = await req('POST', '/reviews', { who: 'other', body: { rating: 4, content: 'Nhiều mẫu đẹp, giao diện dễ dùng' } });
    const otherUser = await User.findOne({ username: 'nguoikhac' });
    const otherHasCard = Boolean(await Invitation.exists({ user: otherUser._id }));
    ok(r.status === 200 && r.data?.data?.displayName === 'nguoikhac' && r.data?.data?.hasCreatedCard === otherHasCard, 'đánh giá: tên mặc định theo tài khoản, nhãn "đã tạo thiệp" đúng thực tế', r.data?.data);
    await Review.updateOne({ displayName: 'nguoikhac' }, { status: 'approved' });
    r = await req('GET', '/reviews/public');
    ok(r.status === 200 && r.data?.data?.length === 2 && r.data?.stats?.average === 4.5 && r.data?.stats?.count === 2, 'đánh giá đã duyệt hiện + điểm trung bình', r.data?.stats);
    ok(r.data?.data?.every(x => !x.user && !x.status), 'đánh giá công khai không lộ tài khoản', r.data?.data?.[0]);
    r = await req('POST', '/reviews', { who: 'owner', body: { rating: 3, content: 'Sửa lại: vẫn ổn nhưng cần thêm mẫu' } });
    ok(r.status === 200 && r.data?.data?.status === 'pending', 'sửa đánh giá: quay về chờ duyệt', r.data?.data);
    ok(await Review.countDocuments({}) === 2, 'mỗi tài khoản chỉ một đánh giá (sửa, không tạo mới)');
    r = await req('GET', '/reviews/me', { who: 'owner' });
    ok(r.status === 200 && r.data?.data?.rating === 3, 'xem đánh giá của tôi', r.data);

    // 10. Bản admin: kiểu phần tử 'shape' hợp lệ
    // Thư mục admin trên máy chưa cài node_modules: dùng mongoose của backend công khai
    process.env.NODE_PATH = path.join(BE, 'node_modules');
    require('module').Module._initPaths();
    const adminMongoose = require('mongoose');
    adminMongoose.deleteModel('Invitation'); // cùng một mongoose với backend công khai
    const AdminInv = require(path.join(ADMIN_BE, 'src/models/invitation.model'));
    const doc = new AdminInv({ user: new adminMongoose.Types.ObjectId(), template: new adminMongoose.Types.ObjectId(), slug: 's', content: [{ id: 'p', items: [{ id: 'a', type: 'shape' }] }] });
    const verr = doc.validateSync();
    ok(!verr || !String(verr).includes('shape'), 'backend admin chấp nhận phần tử khối hình', String(verr || ''));
    const doc2 = new AdminInv({ user: new adminMongoose.Types.ObjectId(), template: new adminMongoose.Types.ObjectId(), slug: 's2', content: [{ id: 'p', items: [{ id: 'b', type: 'table' }] }] });
    const verr2 = doc2.validateSync();
    ok(!verr2 || !String(verr2).includes('table'), 'backend admin chấp nhận phần tử bảng', String(verr2 || ''));
    // Admin duyệt / ẩn / xoá đánh giá (controller admin, cùng collection)
    adminMongoose.deleteModel('Review');
    const adminReview = require(path.join(ADMIN_BE, 'src/controllers/review.controller'));
    const mkRes = () => { const o = { code: 200 }; o.status = (c) => { o.code = c; return o; }; o.json = (d) => { o.body = d; return o; }; return o; };
    let ar = mkRes();
    await adminReview.getReviews({ query: { status: 'pending' } }, ar, (e) => { throw e; });
    ok(ar.code === 200 && ar.body?.data?.length === 1 && ar.body?.data?.[0]?.user?.username === 'chuthiep' && ar.body?.counts?.approved === 1, 'admin: danh sách chờ duyệt kèm tài khoản', ar.body?.counts);
    const pendingId = String(ar.body?.data?.[0]?._id);
    ar = mkRes();
    await adminReview.updateReviewStatus({ params: { id: pendingId }, body: { status: 'approved' } }, ar, (e) => { throw e; });
    ok(ar.code === 200 && ar.body?.data?.status === 'approved', 'admin: duyệt đánh giá', ar.body);
    ar = mkRes();
    await adminReview.updateReviewStatus({ params: { id: pendingId }, body: { status: 'xoa' } }, ar, (e) => { throw e; });
    ok(ar.code === 400, 'admin: trạng thái lạ bị từ chối', ar.code);
    ar = mkRes();
    await adminReview.deleteReview({ params: { id: pendingId } }, ar, (e) => { throw e; });
    ok(ar.code === 200, 'admin: xoá đánh giá', ar.body);
    r = await req('GET', '/reviews/public');
    ok(r.data?.stats?.count === 1, 'sau khi xoá: còn 1 đánh giá công khai', r.data?.stats);
  } catch (e) {
    fail += 1;
    console.log('FAIL ngoại lệ', e);
  } finally {
    console.log(`\nKẾT QUẢ: ${pass} đạt, ${fail} lỗi`);
    if (fail) console.log('--- log máy chủ ---\n' + logs.slice(-3000));
    child.kill();
    imgServer.close();
    await mongoose.disconnect();
    await mongo.stop();
    process.exit(fail ? 1 : 0);
  }
})();
