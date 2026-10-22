// src/services/seoRenderer.service.js
// Gắn thẻ meta SEO (title, description, canonical, Open Graph, JSON-LD) vào index.html của React
// trước khi trả về, và trả đúng mã HTTP cho Google: 200 trang thật, 301 slug cũ, 404 trang không tồn tại.
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Product = require('../models/product.model');
const Page = require('../models/page.model');
const InvitationTemplate = require('../models/invitationTemplate.model');
const Invitation = require('../models/invitation.model');
const TemplateBlock = require('../models/templateBlock.model');
const { getMainSettings } = require('./settings.service');
const { resolveBlogMeta } = require('./blogSeo.service');
const { escapeHtml, stripHtml, truncate } = require('../utils/html');
const { slugify } = require('../utils/slugify');
const { SITE_URL, SITE_NAME, BRAND_NAME, FRONTEND_BUILD_DIR, DEFAULT_SHARE_IMAGE, LOGO_URL, MIN_INDEXABLE_TEXT_LENGTH, FAQ_PAGE_SLUG } = require('../config/site');

const INDEX_PATH = path.join(FRONTEND_BUILD_DIR, 'index.html');
const NOINDEX = 'noindex, nofollow';

const DEFAULT_META = {
    title: 'iCards.com.vn - Thiệp Mời Online & Thiệp Điện Tử Thông Minh',
    description: 'Nền tảng tạo và quản lý thiệp mời sự kiện, thiệp cưới online chuyên nghiệp, hiện đại và cá nhân hóa.',
    keywords: 'thiệp cưới online, thiệp mời điện tử, thiệp sự kiện, icards',
    image: DEFAULT_SHARE_IMAGE,
    type: 'website',
    robots: 'index, follow',
};

// Trang tĩnh có thật trên frontend. settingsKey: lấy meta do admin nhập ở mục SEO (nếu có).
const STATIC_PAGES = {
    '/shop': { title: 'Cửa Hàng & Sản Phẩm', settingsKey: 'products' },
    '/invitations': { title: 'Thư Viện Mẫu Thiệp Mời Online', settingsKey: 'invitations' },
    '/page': {
        title: 'Tin Tức & Kinh Nghiệm',
        description: 'Kinh nghiệm tổ chức sự kiện, cách viết lời mời, xu hướng thiệp cưới và thiệp online mới nhất từ iCards.',
    },
    '/faq': {
        title: 'Câu Hỏi Thường Gặp (FAQ)',
        description: 'Giải đáp thắc mắc thường gặp khi tạo, chỉnh sửa và gửi thiệp online trên iCards: loại thiệp, chi phí, cách chia sẻ, xác nhận tham dự.',
    },
    '/about': { title: 'Giới Thiệu Về iCards' },
    '/professional': { title: 'Hướng Dẫn Dịch Vụ' },
    '/ai-face-gen': { title: 'Tạo Ảnh Thiệp Bằng AI' },
};

// Trang ứng dụng (đăng nhập, quản lý, thiết kế...): trả 200 để người dùng mở được, nhưng không cho Google lập chỉ mục.
const PRIVATE_PAGES = [
    { prefix: '/sign-in', title: 'Đăng nhập' },
    { prefix: '/sign-up', title: 'Đăng ký tài khoản' },
    { prefix: '/forgot-password', title: 'Quên mật khẩu' },
    { prefix: '/reset-password', title: 'Đặt lại mật khẩu' },
    { prefix: '/account-settings', title: 'Cài đặt tài khoản' },
    { prefix: '/invitation-management', title: 'Quản lý thiệp mời' },
    { prefix: '/canvas', title: 'Thiết kế thiệp' },
    { prefix: '/search', title: 'Kết quả tìm kiếm' },
    { prefix: '/stream', title: BRAND_NAME },
];

const PLACEHOLDER_DESCRIPTION = /^mô tả chi tiết cho mẫu thiệp/i;

// ------------------------------------------------------------
// Đọc index.html (giữ trong bộ nhớ, tự đọc lại khi có bản build mới)
// ------------------------------------------------------------
let indexCache = { html: null, mtimeMs: 0 };
const loadIndexHtml = async () => {
    const stat = await fs.promises.stat(INDEX_PATH);
    if (!indexCache.html || stat.mtimeMs !== indexCache.mtimeMs) {
        indexCache = { html: await fs.promises.readFile(INDEX_PATH, 'utf8'), mtimeMs: stat.mtimeMs };
    }
    return indexCache.html;
};

// ------------------------------------------------------------
// Hàm hỗ trợ
// ------------------------------------------------------------
const safeDecode = (segment) => {
    try {
        return decodeURIComponent(segment);
    } catch (e) {
        return segment;
    }
};

const withBrand = (title) => (/icards/i.test(title) ? title : `${title} | ${SITE_NAME}`);

const absoluteUrl = (urlPath) => `${SITE_URL}${urlPath === '/' ? '/' : urlPath}`;

const pageUrl = (slug) => `/page/${encodeURIComponent(slug)}`;

const notFound = (title) => ({
    statusCode: 404,
    robots: NOINDEX,
    title: withBrand(`${title} (404)`),
    description: 'Đường dẫn bạn truy cập không tồn tại hoặc đã bị gỡ trên iCards.',
});

const replaceGuestPlaceholders = (text, salutation, guestName) => stripHtml(String(text || '')
    .replace(/\{LờiXưngHô\}/g, salutation || '')
    .replace(/\{TênKháchMời\}/g, guestName || '')
    .replace(/\{[^}]+\}/g, ''))
    .replace(/\s+([!?.,:;])/g, '$1');

const describeTemplate = (template) => {
    const own = stripHtml(template.description);
    if (own && !PLACEHOLDER_DESCRIPTION.test(own)) return truncate(own);
    return truncate(`Mẫu ${templateKind(template)} “${stripHtml(template.title)}”: chỉnh sửa online miễn phí, cá nhân hóa tên khách mời và gửi nhanh qua Zalo, Facebook, Email cùng iCards.`);
};

const templateKind = (template) => {
    const category = stripHtml(template.category || 'thiệp').toLowerCase();
    return category.startsWith('thiệp') ? category : `thiệp ${category}`;
};

// Viết thường cụm từ khi ghép giữa câu, trừ khi có tên riêng (nhiều chữ viết hoa): "Thiệp mời cưới" -> "thiệp mời cưới",
// "Ngày Phụ nữ Việt Nam 20/10" giữ nguyên
const inSentence = (phrase) => ((phrase.match(/(^|\s)\p{Lu}/gu) || []).length > 1 ? phrase : phrase.toLowerCase());

const templateTitle = (template) => {
    const title = stripHtml(template.title);
    // Không ghép thêm "Mẫu thiệp" nếu tiêu đề đã có chữ "thiệp" (tránh lặp "Mẫu Thiệp Thiệp...")
    return /thiệp/i.test(title) ? title : `${title} – Mẫu ${templateKind(template)}`;
};

const findBySlugOrId = (Model, value, extraFilter = {}) => (
    mongoose.Types.ObjectId.isValid(value) && String(new mongoose.Types.ObjectId(value)) === value
        ? Model.findOne({ _id: value, ...extraFilter }).lean()
        : Model.findOne({ slug: value, ...extraFilter }).lean()
);

const parseOrganizationSchema = (raw) => {
    if (!raw) return null;
    if (typeof raw === 'object') return Object.keys(raw).length ? raw : null;
    try {
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
};

// ------------------------------------------------------------
// Xác định meta cho từng loại URL
// ------------------------------------------------------------
const resolveMeta = async (req, urlPath = req.path) => {
    const segments = urlPath.split('/').filter(Boolean).map(safeDecode);
    const [first, second] = segments;
    const decodedPath = `/${segments.join('/')}`;

    const meta = {
        ...DEFAULT_META,
        statusCode: 200,
        canonical: absoluteUrl(urlPath),
        jsonLd: [],
    };

    // 1. Trang chủ
    if (segments.length === 0) {
        const settings = await getMainSettings();
        const homeSeo = settings?.seo?.pages?.home;
        if (homeSeo) {
            meta.title = stripHtml(homeSeo.title) || meta.title;
            meta.description = stripHtml(homeSeo.description) || meta.description;
            meta.keywords = stripHtml(homeSeo.keywords) || meta.keywords;
            if (homeSeo.social?.ogImage) meta.image = homeSeo.social.ogImage;
        }
        meta.canonical = `${SITE_URL}/`;
        meta.jsonLd.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: `${SITE_URL}/` });
        const organization = parseOrganizationSchema(settings?.seo?.global?.organizationSchema);
        if (organization) meta.jsonLd.push({ '@context': 'https://schema.org', '@type': 'Organization', ...organization });
        return meta;
    }

    // 2. Blog: /page, /page/danh-muc/:slug, /page/chu-de/:slug, /page/:slug (xem blogSeo.service.js)
    if (first === 'page') {
        const blogMeta = await resolveBlogMeta(req, segments, meta);
        if (blogMeta) return blogMeta;
    }

    // 2b. Trang tĩnh
    if (segments.length === 1 && STATIC_PAGES[decodedPath]) {
        const page = STATIC_PAGES[decodedPath];
        meta.title = withBrand(page.title);
        meta.canonical = absoluteUrl(decodedPath);
        if (page.description) meta.description = page.description;
        if (page.settingsKey) {
            const settings = await getMainSettings();
            const custom = settings?.seo?.pages?.[page.settingsKey];
            if (custom?.title) meta.title = withBrand(stripHtml(custom.title));
            if (custom?.description) meta.description = stripHtml(custom.description);
            if (custom?.social?.ogImage) meta.image = custom.social.ogImage;
        }
        return meta;
    }

    // 3. Trang ứng dụng (không lập chỉ mục)
    const privatePage = PRIVATE_PAGES.find(p => decodedPath === p.prefix || decodedPath.startsWith(`${p.prefix}/`));
    if (privatePage) {
        meta.title = withBrand(privatePage.title);
        meta.robots = NOINDEX;
        return meta;
    }

    // 4. Bài viết /page/:slug: xử lý ở bước 2 (blogSeo.service.js)

    // 5. Mẫu thiệp /invitation/:id (chấp nhận cả slug)
    if (first === 'invitation' && segments.length === 2) {
        const template = await findBySlugOrId(InvitationTemplate, second);
        if (!template) return { ...meta, ...notFound('Mẫu thiệp không tồn tại') };

        meta.title = withBrand(templateTitle(template));
        meta.description = describeTemplate(template);
        meta.image = template.imgSrc || meta.image;
        // Frontend đang liên kết mẫu thiệp theo ID nên canonical giữ dạng ID để không sinh trang trùng lặp
        meta.canonical = absoluteUrl(`/invitation/${template._id}`);
        if (!template.isActive) meta.robots = NOINDEX;
        return meta;
    }

    // 6. Bộ sưu tập /collection/:slug
    if (first === 'collection' && segments.length === 2) {
        const block = await TemplateBlock.findOne({ slug: second, isActive: true }).lean();
        if (!block) return { ...meta, ...notFound('Bộ sưu tập không tồn tại') };

        const title = stripHtml(block.title);
        meta.title = withBrand(`${title} – Bộ sưu tập mẫu thiệp`);
        meta.description = truncate(stripHtml(block.description))
            || truncate(`Bộ sưu tập mẫu ${inSentence(title)} đẹp, thiết kế sẵn trên iCards: chỉnh sửa online miễn phí và gửi nhanh qua Zalo, Facebook, Email.`);
        return meta;
    }

    // 7. Danh mục mẫu thiệp /invitations/category/:category(/group/:group(/type/:type))
    if (first === 'invitations' && second === 'category' && [3, 5, 7].includes(segments.length)
        && (segments.length < 5 || segments[3] === 'group') && (segments.length < 7 || segments[5] === 'type')) {
        const settings = await getMainSettings();
        const titleBySlug = {};
        const collectTitles = (items = []) => items.forEach((item) => {
            if (item?.title) titleBySlug[slugify(item.title)] = stripHtml(item.title);
            collectTitles(item?.children);
        });
        collectTitles(settings?.headerNav);

        const lastSegment = segments[segments.length - 1];
        const name = titleBySlug[slugify(lastSegment)] || (/[^\x00-\x7F\s]/.test(lastSegment) ? lastSegment : null);
        meta.title = withBrand(name ? `${name} – Mẫu thiệp online đẹp` : 'Mẫu Thiệp Online Theo Chủ Đề');
        meta.description = truncate(`Tuyển chọn mẫu ${name ? inSentence(name) : 'thiệp online'} đẹp, thiết kế sẵn trên iCards: chỉnh sửa miễn phí, cá nhân hóa tên khách mời và gửi nhanh qua Zalo, Facebook, Email.`);
        return meta;
    }

    // 8. Sản phẩm /product/:id
    if (first === 'product' && segments.length === 2) {
        const product = mongoose.Types.ObjectId.isValid(second) ? await Product.findById(second).lean() : null;
        if (!product) return { ...meta, ...notFound('Sản phẩm không tồn tại') };

        meta.title = withBrand(stripHtml(product.title));
        meta.description = truncate(stripHtml(product.description)) || meta.description;
        meta.image = product.imgSrc || product.images?.[0] || meta.image;
        return meta;
    }

    // 9. Thiệp mời của khách /events/:id và /events/:id/wishes (thông tin riêng tư -> không lập chỉ mục)
    if (first === 'events' && (segments.length === 2 || (segments.length === 3 && segments[2] === 'wishes'))) {
        const invitation = mongoose.Types.ObjectId.isValid(second)
            ? await Invitation.findById(second).select('settings.title settings.description settings.salutationStyle guests._id guests.name guests.salutation').lean()
            : null;
        if (!invitation) return { ...meta, ...notFound('Thiệp mời không tồn tại') };

        const guestId = mongoose.Types.ObjectId.isValid(req.query.guestId) ? String(req.query.guestId) : null;
        const guest = guestId ? invitation.guests?.find(g => String(g._id) === guestId) : null;
        const salutation = guest?.salutation || invitation.settings?.salutationStyle || '';
        const title = replaceGuestPlaceholders(invitation.settings?.title, salutation, guest?.name);
        const description = replaceGuestPlaceholders(invitation.settings?.description, salutation, guest?.name);

        meta.title = title.replace(/[!.,\s-]/g, '').length > 0 ? title : 'Thiệp Mời Online - iCards.com.vn';
        meta.description = description.length > 5 ? truncate(description, 200) : 'Trân trọng kính mời bạn đến tham dự sự kiện đặc biệt này.';
        meta.image = `${SITE_URL}/og-image/${second}${guest ? `?guestId=${guestId}` : ''}`;
        meta.type = 'article';
        meta.robots = NOINDEX;
        meta.canonical = absoluteUrl(`/events/${second}`);
        meta.noStore = true;
        return meta;
    }

    // 10. Mọi URL khác -> 404 thật
    return { ...meta, ...notFound('Trang không tồn tại') };
};

// ------------------------------------------------------------
// Gắn meta vào HTML
// ------------------------------------------------------------
const injectMeta = (html, meta) => {
    const values = {
        __META_TITLE__: meta.title,
        __OG_TITLE__: meta.title,
        __TWITTER_TITLE__: meta.title,
        __META_DESCRIPTION__: meta.description,
        __OG_DESCRIPTION__: meta.description,
        __TWITTER_DESCRIPTION__: meta.description,
        __META_IMAGE__: meta.image,
        __OG_IMAGE__: meta.image,
        __TWITTER_IMAGE__: meta.image,
        __META_URL__: meta.canonical,
        __OG_URL__: meta.canonical,
        __CANONICAL_URL__: meta.canonical,
        __META_KEYWORDS__: meta.keywords,
        __META_ROBOTS__: meta.robots,
        __OG_TYPE__: meta.type,
    };

    // Escape toàn bộ giá trị (chống XSS qua tiêu đề/mô tả thiệp do người dùng nhập)
    // và thay bằng hàm để các ký tự đặc biệt như "$&" trong nội dung không bị hiểu sai.
    let output = html.replace(/__[A-Z_]+__/g, (token) => (token in values ? escapeHtml(values[token]) : token));

    const headExtras = [];
    // Thẻ phụ (article:*, RSS...) do từng loại trang tạo, giá trị đã được escape khi tạo
    if (meta.extraHead?.length) headExtras.push(...meta.extraHead);
    if (meta.jsonLd?.length) {
        // data-seo="server": frontend gỡ các khối này khi khách chuyển sang trang khác trong ứng dụng
        headExtras.push(...meta.jsonLd
            .map(data => `<script type="application/ld+json" data-seo="server">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`));
    }
    if (headExtras.length) output = output.replace('</head>', `${headExtras.join('')}</head>`);
    // Nội dung dựng sẵn cho máy tìm kiếm / mạng xã hội (React gỡ khi khởi động)
    if (meta.ssrHtml) output = output.replace('<div id="root"></div>', `<div id="root"></div>${meta.ssrHtml}`);
    return output;
};

const renderUnavailablePage = () => `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>iCards đang bảo trì</title>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #F3F5F9; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1F2937; }
    .card { max-width: 440px; margin: 24px; padding: 40px 32px; background: #fff; border: 1px solid #E4E8F0; border-radius: 14px; text-align: center; }
    .logo { font-size: 28px; font-weight: 700; color: #27548A; }
    .logo span { color: #C9A45C; }
    h1 { font-size: 20px; margin: 20px 0 8px; }
    p { margin: 0; line-height: 1.6; color: #6B7280; }
    a { display: inline-block; margin-top: 24px; padding: 12px 28px; background: #27548A; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo"><span>i</span>Cards</div>
    <h1>Hệ thống đang được cập nhật</h1>
    <p>Trang web tạm thời chưa sẵn sàng. Vui lòng thử lại sau ít phút.</p>
    <a href="/">Tải lại trang</a>
  </div>
</body>
</html>`;

/**
 * Trả index.html của React kèm meta SEO phù hợp với URL.
 * @param {string} [urlPath] - Đường dẫn cần render (mặc định là req.path).
 */
const renderHtmlWithMeta = async (req, res, urlPath = req.path) => {
    let html;
    try {
        html = await loadIndexHtml();
    } catch (err) {
        console.error('[SEO] Không đọc được index.html:', err.message);
        res.setHeader('Retry-After', '120');
        return res.status(503).type('html').send(renderUnavailablePage());
    }

    let meta;
    try {
        meta = await resolveMeta(req, urlPath);
    } catch (err) {
        console.error('[SEO] Lỗi khi tạo meta:', err);
        meta = { ...DEFAULT_META, statusCode: 200, canonical: absoluteUrl(urlPath), jsonLd: [] };
    }

    if (meta.redirect) {
        return res.redirect(301, meta.redirect);
    }

    res.status(meta.statusCode);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', meta.noStore ? 'no-cache, no-store' : 'no-cache');
    return res.send(injectMeta(html, meta));
};

module.exports = { renderHtmlWithMeta, resolveMeta, injectMeta };
