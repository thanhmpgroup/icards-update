// Kiểm thử SEO blog: API rút gọn, trang Tin tức / danh mục / chủ đề / bài viết dựng sẵn, RSS, sitemap.
const path = require('path');
const { spawn } = require('child_process');
const { MongoMemoryServer } = require('mongodb-memory-server');
const BE = '/Users/gmall/Desktop/ICARDS/icards-backend-master';
const mongoose = require(path.join(BE, 'node_modules/mongoose'));
const PORT = 5091;
const BASE = `http://127.0.0.1:${PORT}`;
let pass = 0; let fail = 0;
const ok = (c, name, extra) => { if (c) { pass += 1; console.log('PASS', name); } else { fail += 1; console.log('FAIL', name, extra !== undefined ? String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 500) : ''); } };
const get = async (url) => { const r = await fetch(BASE + url, { redirect: 'manual' }); return { status: r.status, location: r.headers.get('location'), type: r.headers.get('content-type'), text: await r.text() }; };
const ldOf = (html) => [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
const metaOf = (html, attr, key) => (new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`).exec(html) || [])[1];
const long = (n) => Array.from({ length: n }, (_, i) => `<p>Đoạn văn số ${i + 1} nói về cách tạo thiệp online đẹp, gửi khách mời qua Zalo và quản lý xác nhận tham dự dễ dàng.</p>`).join('');

(async () => {
  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri('icards_blog_seo');
  await mongoose.connect(uri);
  const Page = require(path.join(BE, 'src/models/page.model'));
  const PageCategory = require(path.join(BE, 'src/models/pageCategory.model'));
  const Topic = require(path.join(BE, 'src/models/topic.model'));
  const User = require(path.join(BE, 'src/models/user.model'));
  const editor = await User.create({ username: 'bientap', email: 'bt@example.test', password: 'Mk-test-123456', firstName: 'Lan', lastName: 'Nguyễn' });
  // Dữ liệu giống thật: slug danh mục có dấu cách / đuôi mã ngẫu nhiên
  const root = await PageCategory.collection.insertOne({ name: 'KIẾN THỨC & VĂN HÓA THIỆP', slug: 'huong dan lam thiep', parent: null, order: 1 });
  const child = await PageCategory.collection.insertOne({ name: 'Hướng dẫn làm thiệp online', slug: 'huong-dan-lam-thiep-online-603c069e-c37e-40e0', parent: root.insertedId, order: 2 });
  const lonely = await PageCategory.collection.insertOne({ name: 'Lời chúc hay', slug: 'loi-chuc-hay-70d49149', parent: null, order: 3 });
  const topic = await Topic.collection.insertOne({ name: 'Lợi ích thiệp mời online', slug: 'trepoti54', order: 1 });
  const mk = (i, extra) => Page.collection.insertOne({
    title: `Bài viết thử ${i}: cách tạo thiệp online`, slug: `bai-viet-thu-${i}`, content: `<h2>Phần mở đầu</h2>${long(6)}<h2>Các bước</h2><h3>Bước một</h3>${long(4)}<script>alert(1)</script><img src="https://r2.test/a${i}.webp" onerror="alert(2)">`,
    isBlog: true, isPublished: true, category: child.insertedId, topics: [], thumbnail: `https://r2.test/t${i}.webp`, author: editor._id,
    createdAt: new Date(Date.UTC(2026, 9, i)), updatedAt: new Date(Date.UTC(2026, 9, i + 1)), seo: {}, injectedBlocks: [], ...extra,
  });
  for (let i = 1; i <= 14; i += 1) await mk(i, i === 3 ? { topics: [topic.insertedId] } : {});
  await mk(20, { category: lonely.insertedId, slug: 'loi-chuc-1', title: 'Lời chúc sinh nhật hay' });
  await Page.collection.insertOne({ title: 'Điều khoản sử dụng', slug: 'dieu-khoan-su-dung', content: long(8), isBlog: false, isPublished: true, createdAt: new Date(), updatedAt: new Date(), seo: {}, injectedBlocks: [] });
  await Page.collection.insertOne({ title: 'Bài nháp', slug: 'bai-nhap', content: long(8), isBlog: true, isPublished: false, createdAt: new Date(), updatedAt: new Date(), seo: {}, injectedBlocks: [] });

  const env = {
    PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'test', PORT: String(PORT), MONGO_URI: uri, JWT_SECRET: 'x',
    ACCOUNT_ID: 'x', ACCESS_KEY_ID: 'x', SECRET_ACCESS_KEY: 'x', BUCKET_NAME: 'x', R2_PUBLIC_URL: 'https://r2.test',
    GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'x', FACEBOOK_APP_ID: 'x', FACEBOOK_APP_SECRET: 'x', CALLBACK_URL: 'http://localhost/api/',
    FRONTEND_URL: 'http://localhost:3000', FRONTEND_BUILD_DIR: path.join(__dirname, '..', 'fe-local-build'), SITE_URL: 'https://icards.com.vn',
  };
  const child2 = spawn(process.execPath, ['-r', path.join(__dirname, 'stubs.js'), 'index.js'], { cwd: BE, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; child2.stdout.on('data', d => { logs += d; }); child2.stderr.on('data', d => { logs += d; });
  for (let i = 0; i < 60; i += 1) { try { const r = await fetch(`${BASE}/api/pages`); if (r.status < 500) break; } catch (e) { /* chờ */ } await new Promise(r => setTimeout(r, 500)); }

  try {
    // ---- API ----
    let r = await get('/api/pages?isBlog=true');
    let d = JSON.parse(r.text).data;
    ok(d.length === 15 && d.every(p => p.isBlog), 'API: chỉ bài blog đã xuất bản (bỏ trang tĩnh, bài nháp)', d.length);
    ok(d.every(p => p.content === undefined) && d[0].excerpt && d[0].readingMinutes >= 1, 'API: không kèm nội dung đầy đủ, có excerpt + phút đọc', d[0]);
    ok(r.text.length < 20000, `API: danh sách nhẹ (${r.text.length} byte)`, r.text.length);
    ok(d[0].slug === 'loi-chuc-1' && d[1].slug === 'bai-viet-thu-14', 'API: mới nhất trước', d.slice(0, 2).map(p => p.slug));
    r = await get('/api/pages?isBlog=false');
    ok(JSON.parse(r.text).data.map(p => p.slug).join() === 'dieu-khoan-su-dung', 'API: isBlog=false chỉ trang tĩnh');
    r = await get('/api/pages/bai-viet-thu-3');
    d = JSON.parse(r.text);
    ok(d.data.author?.name === 'Nguyễn Lan', 'API bài viết: tên tác giả thật', d.data.author);
    ok(d.related?.relatedPosts?.length === 4 && d.related.relatedPosts.every(p => p.category?.name === 'Hướng dẫn làm thiệp online' && p.slug !== 'bai-viet-thu-3'), 'API bài viết: 4 bài liên quan cùng danh mục, không gồm chính nó', d.related?.relatedPosts?.map(p => p.slug));
    ok(d.data.categoryTrail?.map(c => c.path).join() === '/page/danh-muc/kien-thuc-van-hoa-thiep,/page/danh-muc/huong-dan-lam-thiep-online', 'API bài viết: breadcrumb danh mục cha -> con, URL sạch', d.data.categoryTrail);
    ok(d.data.readingMinutes >= 1 && d.data.wordCount > 100, 'API bài viết: phút đọc, số từ');

    // ---- Trang Tin tức ----
    r = await get('/page');
    ok(r.status === 200 && r.text.includes('<title>Tin tức &amp; Kinh nghiệm thiệp mời | iCards.com.vn</title>'), 'Tin tức: tiêu đề', r.text.slice(0, 300));
    let ld = ldOf(r.text);
    const blogLd = ld.find(x => x['@type'] === 'Blog');
    ok(blogLd && blogLd.blogPost.length === 10 && blogLd.blogPost[0].url === 'https://icards.com.vn/page/loi-chuc-1', 'Tin tức: JSON-LD Blog + 10 bài mới', blogLd?.blogPost?.length);
    ok(ld.some(x => x['@type'] === 'BreadcrumbList'), 'Tin tức: BreadcrumbList');
    ok(r.text.includes('id="ssr-content"') && r.text.includes('<h1') && r.text.includes('href="/page/bai-viet-thu-14"') && r.text.includes('href="/page/danh-muc/kien-thuc-van-hoa-thiep"'), 'Tin tức: nội dung dựng sẵn có H1, link bài, link danh mục');
    ok(r.text.includes('href="/page?trang=2"') && r.text.includes('rel="next"'), 'Tin tức: link phân trang');
    ok(r.text.includes('type="application/rss+xml"'), 'Tin tức: link RSS');
    ok(metaOf(r.text, 'name', 'robots')?.includes('max-image-preview:large'), 'Tin tức: robots cho ảnh lớn');
    r = await get('/page?trang=2');
    ok(r.status === 200 && r.text.includes('<link rel="canonical" href="https://icards.com.vn/page?trang=2"') && r.text.includes('Trang 2'), 'Tin tức trang 2: canonical riêng', r.text.match(/rel="canonical" href="[^"]*"/)?.[0]);
    r = await get('/page?trang=9');
    ok(r.status === 404, 'Tin tức: trang vượt quá -> 404', r.status);
    r = await get('/page?search=thiep');
    ok(metaOf(r.text, 'name', 'robots') === 'noindex, follow', 'Tìm kiếm: noindex, follow');
    r = await get(`/page?category=${child.insertedId}`);
    ok(r.status === 301 && r.location === '/page/danh-muc/huong-dan-lam-thiep-online', 'Link cũ ?category=<id> -> 301 URL sạch', r);
    r = await get(`/page?topic=${topic.insertedId}`);
    ok(r.status === 301 && r.location === '/page/chu-de/loi-ich-thiep-moi-online', 'Link cũ ?topic=<id> -> 301 URL sạch', r);

    // ---- Danh mục / chủ đề ----
    r = await get('/page/danh-muc/kien-thuc-van-hoa-thiep');
    ld = ldOf(r.text);
    const coll = ld.find(x => x['@type'] === 'CollectionPage');
    ok(r.status === 200 && coll && coll.mainEntity.itemListElement.length === 12, 'Danh mục cha: gồm bài của danh mục con, 12 bài/trang', coll?.mainEntity?.numberOfItems);
    ok(r.text.includes('<h1 style="margin:8px 0 4px">KIẾN THỨC &amp; VĂN HÓA THIỆP</h1>') && r.text.includes('href="/page/danh-muc/kien-thuc-van-hoa-thiep?trang=2"'), 'Danh mục: H1 + phân trang');
    ok(metaOf(r.text, 'name', 'robots')?.startsWith('index'), 'Danh mục đủ bài: cho lập chỉ mục');
    r = await get('/page/danh-muc/kien-thuc-van-hoa-thiep?trang=2');
    ok(r.status === 200 && ldOf(r.text).find(x => x['@type'] === 'CollectionPage').mainEntity.itemListElement[0].position === 13, 'Danh mục trang 2: tiếp tục từ bài 13');
    r = await get('/page/danh-muc/loi-chuc-hay');
    ok(r.status === 200 && metaOf(r.text, 'name', 'robots') === 'noindex, follow', 'Danh mục chỉ 1 bài: noindex (trang mỏng)');
    r = await get('/page/danh-muc/khong-co-that');
    ok(r.status === 404 && metaOf(r.text, 'name', 'robots') === 'noindex, nofollow', 'Danh mục không có: 404 thật', r.status);
    r = await get(`/page/danh-muc/${encodeURIComponent('Lời Chúc Hay')}`);
    ok(r.status === 301 && r.location === '/page/danh-muc/loi-chuc-hay', 'Danh mục viết hoa/có dấu: 301 về URL chuẩn', r);
    r = await get('/page/chu-de/loi-ich-thiep-moi-online');
    ok(r.status === 200 && r.text.includes('Lợi ích thiệp mời online'), 'Chủ đề: 200 + tên chủ đề');

    // ---- Bài viết ----
    r = await get('/page/bai-viet-thu-3');
    ld = ldOf(r.text);
    const post = ld.find(x => x['@type'] === 'BlogPosting');
    ok(r.status === 200 && post, 'Bài viết: BlogPosting');
    ok(post?.author?.['@type'] === 'Person' && post.author.name === 'Nguyễn Lan' && post.articleSection === 'Hướng dẫn làm thiệp online' && post.inLanguage === 'vi-VN' && post.wordCount > 100, 'Bài viết: tác giả, chuyên mục, ngôn ngữ, số từ', post);
    const crumbs = ld.find(x => x['@type'] === 'BreadcrumbList')?.itemListElement?.map(i => i.name);
    ok(crumbs?.join(' > ') === 'Trang chủ > Tin tức > KIẾN THỨC & VĂN HÓA THIỆP > Hướng dẫn làm thiệp online > Bài viết thử 3: cách tạo thiệp online', 'Bài viết: breadcrumb đủ cấp danh mục', crumbs);
    ok(metaOf(r.text, 'property', 'article:published_time') === '2026-10-03T00:00:00.000Z' && metaOf(r.text, 'property', 'article:section') === 'Hướng dẫn làm thiệp online' && metaOf(r.text, 'property', 'article:tag') === 'Lợi ích thiệp mời online', 'Bài viết: thẻ article:*');
    ok(r.text.includes('<article><h1') && r.text.includes('Phần mở đầu') && r.text.includes('Bài viết liên quan') && r.text.includes('phút đọc'), 'Bài viết: nội dung dựng sẵn (H1, thân bài, liên quan)');
    const ssr = r.text.slice(r.text.indexOf('id="ssr-content"'));
    ok(!/<script>alert/.test(ssr) && !/onerror=/.test(ssr) && ssr.includes('loading="lazy"'), 'Bài viết dựng sẵn: bỏ script/onerror, ảnh tải chậm');
    r = await get('/page/dieu-khoan-su-dung');
    ld = ldOf(r.text);
    ok(ld.some(x => x['@type'] === 'WebPage') && !ld.some(x => x['@type'] === 'BlogPosting') && ld.find(x => x['@type'] === 'BreadcrumbList').itemListElement.length === 2, 'Trang tĩnh: WebPage, không gắn là bài blog');
    r = await get('/page/bai-nhap');
    ok(r.status === 404, 'Bài nháp: 404');
    r = await get('/page/Bai-Viet-Thu-3');
    ok(r.status === 301 && r.location === '/page/bai-viet-thu-3', 'Slug viết hoa: 301', r);

    // ---- RSS, sitemap ----
    r = await get('/rss.xml');
    ok(r.status === 200 && /rss\+xml/.test(r.type) && (r.text.match(/<item>/g) || []).length === 15 && r.text.includes('<link>https://icards.com.vn/page/loi-chuc-1</link>'), 'RSS: 15 bài, link đúng', r.text.slice(0, 200));
    r = await get('/sitemap.xml');
    ok(r.text.includes('/page/danh-muc/kien-thuc-van-hoa-thiep</loc>') && r.text.includes('/page/danh-muc/huong-dan-lam-thiep-online</loc>'), 'Sitemap: trang danh mục đủ bài');
    ok(!r.text.includes('/page/danh-muc/loi-chuc-hay<') && !r.text.includes('/page/bai-nhap<'), 'Sitemap: bỏ danh mục ít bài, bài nháp');
    ok(r.text.includes('<image:loc>https://r2.test/t3.webp</image:loc>') && r.text.includes('xmlns:image='), 'Sitemap: ảnh bài viết');
  } catch (e) {
    fail += 1; console.log('FAIL ngoại lệ', e);
  } finally {
    if (fail) console.log(logs.split('\n').slice(-30).join('\n'));
    child2.kill();
    await mongoose.disconnect();
    await mongo.stop();
    console.log(`\nKẾT QUẢ: ${pass} đạt, ${fail} lỗi`);
    process.exit(fail ? 1 : 0);
  }
})();
