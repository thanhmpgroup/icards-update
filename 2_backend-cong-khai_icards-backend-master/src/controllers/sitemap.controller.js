// src/controllers/sitemap.controller.js
const Product = require('../models/product.model');
const InvitationTemplate = require('../models/invitationTemplate.model');
const TemplateBlock = require('../models/templateBlock.model');
const { getMainSettings } = require('../services/settings.service');
const { escapeHtml } = require('../utils/html');
const { SITE_URL } = require('../config/site');
const blog = require('../services/blog.service');

// Chỉ đưa vào sitemap những URL trả về 200 và được phép lập chỉ mục
const STATIC_ROUTES = ['/', '/invitations', '/page', '/shop', '/faq', '/professional'];

const SITEMAP_CACHE_MS = 10 * 60 * 1000;
let sitemapCache = { xml: null, createdAt: 0 };

// images: ảnh đại diện của trang (Google Images hiểu ảnh thuộc bài nào)
const urlEntry = (path, updatedAt, images = []) => {
    const lastmod = updatedAt ? `\n    <lastmod>${new Date(updatedAt).toISOString()}</lastmod>` : '';
    const imgs = images.filter(Boolean).map(src => `\n    <image:image><image:loc>${escapeHtml(src)}</image:loc></image:image>`).join('');
    return `  <url>\n    <loc>${escapeHtml(`${SITE_URL}${path}`)}</loc>${lastmod}${imgs}\n  </url>\n`;
};

const buildSitemap = async () => {
    const [products, templates, collections, blogData] = await Promise.all([
        Product.find({}).select('_id updatedAt').lean(),
        InvitationTemplate.find({ isActive: true }).select('_id updatedAt imgSrc').lean(),
        TemplateBlock.find({ isActive: true }).select('slug updatedAt').lean(),
        blog.loadAll(),
    ]);
    const pages = blogData.posts.filter(blog.isIndexablePost);
    const latestPost = blogData.blogPosts[0];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

    STATIC_ROUTES.forEach((path) => { xml += urlEntry(path, path === '/page' ? latestPost?.updatedAt : undefined); });
    collections.filter(c => c.slug).forEach((c) => { xml += urlEntry(`/collection/${encodeURIComponent(c.slug)}`, c.updatedAt); });
    // Bài viết + trang danh mục / chủ đề blog có đủ bài (trang ít bài để noindex nên không đưa vào)
    pages.forEach((p) => { xml += urlEntry(blog.postPath(p.slug), p.updatedAt, [p.thumbnail]); });
    const newest = (list) => list.reduce((m, p) => (!m || new Date(p.updatedAt) > new Date(m) ? p.updatedAt : m), null);
    blogData.categories.forEach((c) => {
        const list = blogData.postsOfCategory(c);
        if (list.length >= blog.MIN_POSTS_FOR_INDEX) xml += urlEntry(blog.categoryPath(c), newest(list));
    });
    blogData.topics.forEach((t) => {
        const list = blogData.postsOfTopic(t);
        if (list.length >= blog.MIN_POSTS_FOR_INDEX) xml += urlEntry(blog.topicPath(t), newest(list));
    });
    templates.forEach((t) => { xml += urlEntry(`/invitation/${t._id}`, t.updatedAt, [t.imgSrc]); });
    products.forEach((p) => { xml += urlEntry(`/product/${p._id}`, p.updatedAt); });

    xml += '</urlset>';
    return xml;
};

const generateSitemap = async (req, res) => {
    try {
        if (!sitemapCache.xml || Date.now() - sitemapCache.createdAt > SITEMAP_CACHE_MS) {
            sitemapCache = { xml: await buildSitemap(), createdAt: Date.now() };
        }
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=600');
        res.status(200).send(sitemapCache.xml);
    } catch (error) {
        console.error('Sitemap Error:', error);
        res.status(500).send('Error generating sitemap');
    }
};

const DEFAULT_ROBOTS = `User-agent: *
Allow: /
Disallow: /account-settings
Disallow: /invitation-management
Disallow: /canvas
Disallow: /sign-in
Disallow: /sign-up
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /search/
`;

// Nội dung robots mặc định do model settings tự tạo, coi như admin chưa cấu hình
const UNCONFIGURED_ROBOTS = 'User-agent: *\nAllow: /';

const generateRobotsTxt = async (req, res) => {
    const settings = await getMainSettings();
    const custom = (settings?.seo?.global?.robotsTxt || '').trim();
    const base = custom && custom !== UNCONFIGURED_ROBOTS ? custom : DEFAULT_ROBOTS.trim();

    // Luôn trỏ Sitemap về đúng tên miền (bỏ các dòng Sitemap cũ như "your-domain.com")
    const robots = `${base
        .split(/\r?\n/)
        .filter(line => !/^\s*sitemap\s*:/i.test(line))
        .join('\n')
        .trim()}\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(robots);
};

module.exports = { generateSitemap, generateRobotsTxt };
