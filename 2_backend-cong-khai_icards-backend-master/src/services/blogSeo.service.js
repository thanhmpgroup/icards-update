// src/services/blogSeo.service.js
// SEO cho blog (Tin tức) khi máy chủ trả trang:
//   /page                         Trang Tin tức (Blog + danh sách bài mới, BreadcrumbList)
//   /page/danh-muc/:slug(?trang=N) Trang danh mục (CollectionPage + ItemList), 404 nếu không có, noindex nếu quá ít bài
//   /page/chu-de/:slug(?trang=N)   Trang chủ đề (như trên)
//   /page/:slug                    Bài viết (BlogPosting / WebPage, BreadcrumbList theo danh mục, article:* meta)
// Ngoài thẻ meta, máy chủ dựng sẵn nội dung HTML (tiêu đề, bài viết, danh sách bài, liên kết) trong <div id="ssr-content">
// để Google, Cốc Cốc, Bing, Zalo đọc được ngay không cần chạy JavaScript; React xoá khối này khi khởi động
// và hiển thị đúng nội dung đó (không phải nội dung riêng cho máy tìm kiếm).
const Page = require('../models/page.model');
const blog = require('./blog.service');
const { escapeHtml, stripHtml, truncate } = require('../utils/html');
const { slugify } = require('../utils/slugify');
const { SITE_URL, SITE_NAME, BRAND_NAME, LOGO_URL, MIN_INDEXABLE_TEXT_LENGTH, FAQ_PAGE_SLUG } = require('../config/site');

const NOINDEX = 'noindex, nofollow';
const NOINDEX_FOLLOW = 'noindex, follow';
// Cho Google hiện ảnh lớn / đoạn trích đầy đủ (Discover, kết quả có ảnh)
const ROBOTS_RICH = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
const BLOG_NAME = 'Tin tức & Kinh nghiệm thiệp mời';
const BLOG_DESCRIPTION = 'Kinh nghiệm tổ chức sự kiện, cách viết lời mời, xu hướng thiệp cưới và thiệp online mới nhất từ iCards.';

const abs = (p) => `${SITE_URL}${p}`;
const withBrand = (title) => (/icards/i.test(title) ? title : `${title} | ${SITE_NAME}`);
const viDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }) : '');
const iso = (d) => (d ? new Date(d).toISOString() : undefined);
const pageParam = (req) => {
    const n = parseInt(req.query?.trang, 10);
    return Number.isFinite(n) && n > 1 ? n : 1;
};
const publisher = () => ({ '@type': 'Organization', name: BRAND_NAME, url: `${SITE_URL}/`, logo: { '@type': 'ImageObject', url: LOGO_URL } });
const breadcrumb = (items) => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })),
});
const metaTag = (attr, key, value) => (value ? `<meta ${attr}="${key}" content="${escapeHtml(value)}">` : '');
const RSS_LINK = `<link rel="alternate" type="application/rss+xml" title="${escapeHtml(`${BLOG_NAME} – ${SITE_NAME}`)}" href="${SITE_URL}/rss.xml">`;

// Nội dung bài do admin soạn: bỏ script/style, thuộc tính sự kiện, link javascript: trước khi dựng sẵn
const sanitizeArticleHtml = (html) => String(html || '')
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style)[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"')
    .replace(/<img(?![^>]*\sloading=)/gi, '<img loading="lazy" decoding="async"');

// ------------------------------------------------------------
// HTML dựng sẵn (kiểu dáng tối giản, chỉ hiện trong lúc JavaScript chưa chạy)
// ------------------------------------------------------------
const SSR_STYLE = 'max-width:860px;margin:0 auto;padding:24px 16px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.7;color:#1f2937';
const topNav = (categories) => `<nav aria-label="Điều hướng chính" style="font-size:14px;margin-bottom:12px"><a href="/">${escapeHtml(BRAND_NAME)}</a> · <a href="/page">Tin tức</a> · <a href="/invitations">Mẫu thiệp</a>${
    categories.length ? ` · ${categories.map(c => `<a href="${escapeHtml(c.path)}">${escapeHtml(c.name)}</a>`).join(' · ')}` : ''}</nav>`;
const crumbsHtml = (items) => `<nav aria-label="Breadcrumb" style="font-size:13px;color:#6b7280"><ol style="list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:6px">${
    items.map((it, i) => `<li>${i < items.length - 1 ? `<a href="${escapeHtml(it.path)}">${escapeHtml(it.name)}</a> ›` : `<span aria-current="page">${escapeHtml(it.name)}</span>`}</li>`).join('')}</ol></nav>`;
const postCard = (p) => `<li style="margin:0 0 18px"><h2 style="font-size:19px;margin:0"><a href="${escapeHtml(blog.postPath(p.slug))}">${escapeHtml(p.title)}</a></h2>`
    + `<p style="margin:2px 0;font-size:13px;color:#6b7280"><time datetime="${iso(p.createdAt)}">${viDate(p.createdAt)}</time> · ${p.readingMinutes} phút đọc</p>`
    + `${p.excerpt ? `<p style="margin:0">${escapeHtml(p.excerpt)}</p>` : ''}</li>`;
const pager = (basePath, page, pages) => {
    if (pages <= 1) return '';
    const link = (n) => (n === 1 ? basePath : `${basePath}?trang=${n}`);
    const items = [];
    if (page > 1) items.push(`<a rel="prev" href="${escapeHtml(link(page - 1))}">‹ Trang trước</a>`);
    for (let n = 1; n <= pages; n += 1) items.push(n === page ? `<strong>${n}</strong>` : `<a href="${escapeHtml(link(n))}">${n}</a>`);
    if (page < pages) items.push(`<a rel="next" href="${escapeHtml(link(page + 1))}">Trang sau ›</a>`);
    return `<nav aria-label="Phân trang" style="display:flex;gap:10px;flex-wrap:wrap">${items.join('')}</nav>`;
};

const rootCategories = (data) => data.categories
    .filter(c => !c.parent || !data.categoryById.has(String(c.parent)))
    .filter(c => data.postsOfCategory(c).length > 0)
    .map(c => ({ name: c.name, path: blog.categoryPath(c) }));

// ------------------------------------------------------------
// Trang Tin tức /page
// ------------------------------------------------------------
const resolveBlogIndex = async (req, meta) => {
    const data = await blog.loadAll();

    // Đường dẫn cũ ?category=<id|slug> / ?topic=<id|slug> -> 301 sang URL sạch
    const legacyCat = req.query?.category;
    if (legacyCat && legacyCat !== 'all') {
        const cat = data.categoryById.get(String(legacyCat))
            || data.categories.find(c => c.slug === legacyCat || blog.blogUrlSlug(c.name) === slugify(legacyCat));
        if (cat) return { redirect: blog.categoryPath(cat) };
    }
    const legacyTopic = req.query?.topic;
    if (legacyTopic && legacyTopic !== 'all') {
        const topic = data.topics.find(t => String(t._id) === String(legacyTopic) || t.slug === legacyTopic || blog.blogUrlSlug(t.name) === slugify(legacyTopic));
        if (topic) return { redirect: blog.topicPath(topic) };
    }

    const posts = data.blogPosts.filter(blog.isIndexablePost);
    // Danh sách "Tất cả bài viết" phân trang giống giao diện (?trang=2...)
    const all = data.blogPosts;
    const pages = Math.max(1, Math.ceil(all.length / blog.POSTS_PER_PAGE));
    const page = pageParam(req);
    if (page > pages) return { ...meta, statusCode: 404, robots: NOINDEX, title: withBrand('Trang không tồn tại (404)') };
    const pageList = all.slice((page - 1) * blog.POSTS_PER_PAGE, page * blog.POSTS_PER_PAGE);
    meta.title = withBrand(`${BLOG_NAME}${page > 1 ? ` – Trang ${page}` : ''}`);
    meta.description = BLOG_DESCRIPTION;
    meta.canonical = abs(page > 1 ? `/page?trang=${page}` : '/page');
    meta.robots = req.query?.search ? NOINDEX_FOLLOW : ROBOTS_RICH;
    meta.image = posts.find(p => p.thumbnail)?.thumbnail || meta.image;
    meta.extraHead = [RSS_LINK];
    meta.jsonLd.push({
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: BLOG_NAME,
        description: BLOG_DESCRIPTION,
        url: abs('/page'),
        inLanguage: 'vi-VN',
        publisher: publisher(),
        blogPost: posts.slice(0, 10).map(p => ({
            '@type': 'BlogPosting',
            headline: truncate(p.title, 110),
            url: abs(blog.postPath(p.slug)),
            datePublished: iso(p.createdAt),
            dateModified: iso(p.updatedAt || p.createdAt),
            ...(p.thumbnail ? { image: p.thumbnail } : {}),
        })),
    }, breadcrumb([{ name: 'Trang chủ', path: '/' }, { name: 'Tin tức', path: '/page' }]));

    const cats = rootCategories(data);
    meta.ssrHtml = `<div id="ssr-content" style="${SSR_STYLE}">${topNav(cats)}`
        + `<h1 style="margin:8px 0 4px">${escapeHtml(BLOG_NAME)}</h1><p>${escapeHtml(BLOG_DESCRIPTION)}</p>`
        + `<ul style="list-style:none;padding:0">${pageList.map(postCard).join('')}</ul>${pager('/page', page, pages)}`
        + '</div>';
    return meta;
};

// ------------------------------------------------------------
// Trang danh mục / chủ đề
// ------------------------------------------------------------
const resolveArchive = async (req, meta, kind, urlSlug) => {
    const data = await blog.loadAll();
    const isCategory = kind === blog.CATEGORY_PREFIX;
    // Chuẩn hoá trước khi tìm: "/page/danh-muc/Thiệp Cưới" -> "thiep-cuoi" (rồi 301 về URL chuẩn bên dưới)
    const key = slugify(urlSlug);
    const entity = isCategory ? data.categoryBySlug.get(key) : data.topicBySlug.get(key);
    if (!entity) {
        return {
            ...meta,
            statusCode: 404,
            robots: NOINDEX,
            title: withBrand(isCategory ? 'Danh mục không tồn tại (404)' : 'Chủ đề không tồn tại (404)'),
            description: 'Đường dẫn bạn truy cập không tồn tại hoặc đã bị gỡ trên iCards.',
        };
    }
    const basePath = isCategory ? blog.categoryPath(entity) : blog.topicPath(entity);
    // Slug viết khác (chữ hoa, có dấu...) -> 301 về URL chuẩn
    if (`/page/${kind}/${urlSlug}` !== basePath) return { redirect: basePath };

    const all = (isCategory ? data.postsOfCategory(entity) : data.postsOfTopic(entity));
    const pages = Math.max(1, Math.ceil(all.length / blog.POSTS_PER_PAGE));
    const page = pageParam(req);
    if (page > pages) return { ...meta, statusCode: 404, robots: NOINDEX, title: withBrand('Trang không tồn tại (404)') };
    const list = all.slice((page - 1) * blog.POSTS_PER_PAGE, page * blog.POSTS_PER_PAGE);
    const path = page > 1 ? `${basePath}?trang=${page}` : basePath;
    const label = isCategory ? 'Danh mục' : 'Chủ đề';
    const name = stripHtml(entity.name);

    meta.title = withBrand(`${name}${page > 1 ? ` – Trang ${page}` : ''} – ${label} Tin tức`);
    meta.description = truncate(`${name}: ${all.length} bài viết về ${name.toLowerCase()} trên blog iCards – kinh nghiệm, mẫu lời mời và hướng dẫn tạo thiệp online.`);
    meta.canonical = abs(path);
    meta.robots = all.length >= blog.MIN_POSTS_FOR_INDEX ? ROBOTS_RICH : NOINDEX_FOLLOW;
    meta.image = all.find(p => p.thumbnail)?.thumbnail || meta.image;
    meta.extraHead = [RSS_LINK];

    const trail = [{ name: 'Trang chủ', path: '/' }, { name: 'Tin tức', path: '/page' }];
    if (isCategory) {
        const chain = await blog.categoryTrail(entity._id);
        trail.push(...chain);
    } else {
        trail.push({ name, path: basePath });
    }
    meta.jsonLd.push({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${name} – ${label}`,
        description: meta.description,
        url: meta.canonical,
        inLanguage: 'vi-VN',
        isPartOf: { '@type': 'Blog', name: BLOG_NAME, url: abs('/page') },
        mainEntity: {
            '@type': 'ItemList',
            numberOfItems: list.length,
            itemListElement: list.map((p, i) => ({ '@type': 'ListItem', position: (page - 1) * blog.POSTS_PER_PAGE + i + 1, url: abs(blog.postPath(p.slug)), name: p.title })),
        },
    }, breadcrumb(trail));

    meta.ssrHtml = `<div id="ssr-content" style="${SSR_STYLE}">${topNav(rootCategories(data))}${crumbsHtml(trail)}`
        + `<h1 style="margin:8px 0 4px">${escapeHtml(name)}</h1><p>${escapeHtml(`${label} gồm ${all.length} bài viết.`)}</p>`
        + `<ul style="list-style:none;padding:0">${list.map(postCard).join('')}</ul>${pager(basePath, page, pages)}`
        + '</div>';
    return meta;
};

// ------------------------------------------------------------
// Bài viết /page/:slug
// ------------------------------------------------------------
const resolveArticle = async (req, meta, slug) => {
    if (slug === FAQ_PAGE_SLUG) return { redirect: '/faq' };
    let page = await Page.findOne({ slug, isPublished: true })
        .populate('category', 'name slug parent')
        .populate('topics', 'name slug')
        .populate('author', 'firstName lastName username')
        .lean();
    if (!page) {
        // Thử dạng slug chuẩn (vd: chữ hoa, dấu cách, có dấu) -> 301 về đường dẫn đúng
        const normalized = slugify(slug);
        page = normalized && normalized !== slug
            ? await Page.findOne({ slug: normalized, isPublished: true }).select('slug').lean()
            : null;
        if (page) return { redirect: blog.postPath(page.slug) };
        return {
            ...meta,
            statusCode: 404,
            robots: NOINDEX,
            title: withBrand('Bài viết không tồn tại (404)'),
            description: 'Đường dẫn bạn truy cập không tồn tại hoặc đã bị gỡ trên iCards.',
        };
    }
    // MongoDB so slug không phân biệt hoa thường ở một số collation: chuyển 301 về đúng URL
    if (page.slug !== slug) return { redirect: blog.postPath(page.slug) };

    const text = stripHtml(page.content);
    const title = stripHtml(page.seo?.metaTitle || page.title);
    const isBlog = !!page.isBlog;
    const author = blog.authorName(page.author);
    const trailCats = isBlog ? await blog.categoryTrail(page.category?._id) : [];
    const related = isBlog ? await blog.relatedPosts(page, 4) : [];
    const keywords = stripHtml(page.seo?.keywords) || (page.topics || []).map(t => t?.name).filter(Boolean).join(', ');

    meta.title = withBrand(title);
    meta.robots = text.length < MIN_INDEXABLE_TEXT_LENGTH ? NOINDEX : ROBOTS_RICH;
    meta.description = truncate(stripHtml(page.seo?.metaDescription || page.summary || text)) || meta.description;
    if (keywords) meta.keywords = keywords;
    meta.image = page.thumbnail || meta.image;
    meta.type = 'article';
    meta.canonical = /^https?:\/\//i.test(page.seo?.canonicalUrl || '') ? page.seo.canonicalUrl : abs(blog.postPath(page.slug));
    meta.extraHead = [
        RSS_LINK,
        metaTag('property', 'article:published_time', iso(page.createdAt)),
        metaTag('property', 'article:modified_time', iso(page.updatedAt || page.createdAt)),
        metaTag('property', 'og:updated_time', iso(page.updatedAt || page.createdAt)),
        isBlog ? metaTag('property', 'article:section', page.category?.name) : '',
        ...(page.topics || []).filter(Boolean).slice(0, 6).map(t => metaTag('property', 'article:tag', t.name)),
        author ? metaTag('name', 'author', author) : metaTag('name', 'author', `Ban biên tập ${BRAND_NAME}`),
    ].filter(Boolean);

    const trail = isBlog
        ? [{ name: 'Trang chủ', path: '/' }, { name: 'Tin tức', path: '/page' }, ...trailCats, { name: stripHtml(page.title), path: blog.postPath(page.slug) }]
        : [{ name: 'Trang chủ', path: '/' }, { name: stripHtml(page.title), path: blog.postPath(page.slug) }];
    meta.jsonLd.push({
        '@context': 'https://schema.org',
        '@type': isBlog ? 'BlogPosting' : 'WebPage',
        headline: truncate(stripHtml(page.title), 110),
        name: stripHtml(page.title),
        description: meta.description,
        image: [meta.image],
        url: meta.canonical,
        datePublished: iso(page.createdAt),
        dateModified: iso(page.updatedAt || page.createdAt),
        inLanguage: 'vi-VN',
        mainEntityOfPage: { '@type': 'WebPage', '@id': meta.canonical },
        author: author ? { '@type': 'Person', name: author } : { '@type': 'Organization', name: `Ban biên tập ${BRAND_NAME}`, url: `${SITE_URL}/` },
        publisher: publisher(),
        ...(isBlog && page.category?.name ? { articleSection: page.category.name } : {}),
        ...(keywords ? { keywords } : {}),
        ...(isBlog ? { wordCount: blog.wordCount(text), isPartOf: { '@type': 'Blog', name: BLOG_NAME, url: abs('/page') } } : {}),
    }, breadcrumb(trail));

    const data = await blog.loadAll();
    meta.ssrHtml = `<div id="ssr-content" style="${SSR_STYLE}">${topNav(rootCategories(data))}${crumbsHtml(trail)}`
        + '<article>'
        + `<h1 style="margin:8px 0 4px;line-height:1.3">${escapeHtml(stripHtml(page.title))}</h1>`
        + `<p style="font-size:13px;color:#6b7280;margin:0 0 16px">${isBlog && page.category?.name ? `<a href="${escapeHtml(trailCats[trailCats.length - 1]?.path || '/page')}">${escapeHtml(page.category.name)}</a> · ` : ''}`
        + `<time datetime="${iso(page.createdAt)}">${viDate(page.createdAt)}</time>`
        + `${page.updatedAt && viDate(page.updatedAt) !== viDate(page.createdAt) ? ` · Cập nhật <time datetime="${iso(page.updatedAt)}">${viDate(page.updatedAt)}</time>` : ''}`
        + ` · ${escapeHtml(author || `Ban biên tập ${BRAND_NAME}`)} · ${blog.readingMinutes(text)} phút đọc</p>`
        + `${page.thumbnail ? `<img src="${escapeHtml(page.thumbnail)}" alt="${escapeHtml(stripHtml(page.title))}" style="max-width:100%;height:auto">` : ''}`
        + `<div>${sanitizeArticleHtml(page.content)}</div>`
        + '</article>'
        + `${related.length ? `<section><h2 style="font-size:20px">Bài viết liên quan</h2><ul>${related.map(p => `<li><a href="${escapeHtml(blog.postPath(p.slug))}">${escapeHtml(p.title)}</a></li>`).join('')}</ul></section>` : ''}`
        + '</div>';
    return meta;
};

/**
 * Meta cho mọi URL dưới /page (trả null nếu không thuộc blog để seoRenderer xử lý tiếp).
 * segments: các phần của đường dẫn đã giải mã, vd ['page', 'danh-muc', 'kien-thuc-van-hoa-thiep'].
 */
const resolveBlogMeta = async (req, segments, meta) => {
    if (segments[0] !== 'page') return null;
    if (segments.length === 1) return resolveBlogIndex(req, meta);
    if (segments.length === 3 && [blog.CATEGORY_PREFIX, blog.TOPIC_PREFIX].includes(segments[1])) {
        return resolveArchive(req, meta, segments[1], segments[2]);
    }
    if (segments.length === 2) return resolveArticle(req, meta, segments[1]);
    return null;
};

// ------------------------------------------------------------
// RSS 2.0: /rss.xml (30 bài mới nhất)
// ------------------------------------------------------------
const cdata = (s) => `<![CDATA[${String(s || '').replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
const buildRss = async () => {
    const data = await blog.loadAll();
    const posts = data.blogPosts.filter(blog.isIndexablePost).slice(0, 30);
    const items = posts.map(p => [
        '<item>',
        `<title>${cdata(p.title)}</title>`,
        `<link>${escapeHtml(abs(blog.postPath(p.slug)))}</link>`,
        `<guid isPermaLink="true">${escapeHtml(abs(blog.postPath(p.slug)))}</guid>`,
        `<pubDate>${new Date(p.createdAt).toUTCString()}</pubDate>`,
        p.category?.name ? `<category>${cdata(p.category.name)}</category>` : '',
        `<description>${cdata(p.excerpt)}</description>`,
        p.thumbnail ? `<enclosure url="${escapeHtml(p.thumbnail)}" type="image/${/\.png(\?|$)/i.test(p.thumbnail) ? 'png' : (/\.webp(\?|$)/i.test(p.thumbnail) ? 'webp' : 'jpeg')}" length="0"/>` : '',
        '</item>',
    ].filter(Boolean).join(''));
    return '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n'
        + `<title>${cdata(`${BLOG_NAME} – ${SITE_NAME}`)}</title>\n`
        + `<link>${abs('/page')}</link>\n`
        + `<atom:link href="${abs('/rss.xml')}" rel="self" type="application/rss+xml"/>\n`
        + `<description>${cdata(BLOG_DESCRIPTION)}</description>\n`
        + '<language>vi-VN</language>\n'
        + (posts[0] ? `<lastBuildDate>${new Date(posts[0].updatedAt || posts[0].createdAt).toUTCString()}</lastBuildDate>\n` : '')
        + `${items.join('\n')}\n</channel>\n</rss>\n`;
};

const generateRss = async (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=600');
        res.status(200).send(await buildRss());
    } catch (error) {
        console.error('RSS Error:', error);
        res.status(500).send('Error generating RSS');
    }
};

module.exports = { resolveBlogMeta, generateRss, buildRss, sanitizeArticleHtml, ROBOTS_RICH };
