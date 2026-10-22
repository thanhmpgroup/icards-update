// src/services/blog.service.js
// Dữ liệu dùng chung cho blog (Tin tức): danh sách bài rút gọn, URL danh mục / chủ đề sạch, bài liên quan.
// Dùng cho API /pages, trang SEO dựng sẵn (seoRenderer), sitemap và RSS.
//
// URL sạch được tạo từ TÊN danh mục / chủ đề (slug lưu trong DB nhiều chỗ có dấu cách, đuôi mã ngẫu nhiên):
//   /page/danh-muc/kien-thuc-van-hoa-thiep, /page/chu-de/loi-ich-thiep-moi-online
// Phía frontend dùng đúng hàm tạo slug này (src/Utils/blogSeo.js).
const Page = require('../models/page.model');
const PageCategory = require('../models/pageCategory.model');
const Topic = require('../models/topic.model');
require('../models/user.model');
const { slugify } = require('../utils/slugify');
const { stripHtml, truncate } = require('../utils/html');
const { FAQ_PAGE_SLUG, MIN_INDEXABLE_TEXT_LENGTH } = require('../config/site');

const BLOG_PATH = '/page';
const CATEGORY_PREFIX = 'danh-muc';
const TOPIC_PREFIX = 'chu-de';
// Trang danh mục / chủ đề có ít bài hơn mức này: vẫn mở được nhưng không cho lập chỉ mục (trang mỏng)
const MIN_POSTS_FOR_INDEX = 2;
const POSTS_PER_PAGE = 12;
const CACHE_MS = 60 * 1000;

const blogUrlSlug = (name) => slugify(name || '');
const postPath = (slug) => `${BLOG_PATH}/${encodeURIComponent(slug)}`;
const categoryPath = (cat) => `${BLOG_PATH}/${CATEGORY_PREFIX}/${blogUrlSlug(cat.name)}`;
const topicPath = (topic) => `${BLOG_PATH}/${TOPIC_PREFIX}/${blogUrlSlug(topic.name)}`;

/** Số phút đọc (khoảng 220 từ/phút) */
const readingMinutes = (text) => Math.max(1, Math.round((String(text || '').split(/\s+/).filter(Boolean).length) / 220));
const wordCount = (text) => String(text || '').split(/\s+/).filter(Boolean).length;

/** Tên tác giả hiển thị: tên thật của tài khoản, tài khoản quản trị chung thì "Ban biên tập iCards" */
const authorName = (author) => {
    if (!author || typeof author !== 'object') return null;
    const full = [author.lastName, author.firstName].filter(Boolean).join(' ').trim() || author.name || '';
    if (!full || /^(admin|administrator|root|test)/i.test(full)) return null;
    return full;
};

// ------------------------------------------------------------
// Bộ nhớ đệm ngắn (60 giây): blog ít bài, đọc toàn bộ một lần cho mọi trang
// ------------------------------------------------------------
let cache = { at: 0, data: null };
const invalidate = () => { cache = { at: 0, data: null }; };

const loadAll = async () => {
    if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;
    const [pages, categories, topics] = await Promise.all([
        Page.find({ isPublished: true })
            .select('title slug content isBlog category topics thumbnail createdAt updatedAt seo author')
            .populate('category', 'name slug parent')
            .populate('topics', 'name slug')
            .populate('author', 'firstName lastName username')
            .sort({ createdAt: -1 })
            .lean(),
        PageCategory.find().sort('order').lean(),
        Topic.find().sort('order').lean(),
    ]);

    // Bài rút gọn (không kèm nội dung đầy đủ: danh sách nhẹ hơn hàng trăm lần)
    const posts = pages.map((p) => {
        const text = stripHtml(p.content);
        return {
            _id: p._id,
            title: p.title,
            slug: p.slug,
            isBlog: !!p.isBlog,
            category: p.category ? { _id: p.category._id, name: p.category.name, slug: p.category.slug, parent: p.category.parent || null } : null,
            topics: (p.topics || []).filter(Boolean).map(t => ({ _id: t._id, name: t.name, slug: t.slug })),
            thumbnail: p.thumbnail || '',
            excerpt: truncate(stripHtml(p.seo?.metaDescription) || text, 180),
            readingMinutes: readingMinutes(text),
            textLength: text.length,
            author: authorName(p.author),
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
        };
    });

    // Danh mục: cây + tập con cháu (bài của danh mục con cũng thuộc danh mục cha)
    const byId = new Map(categories.map(c => [String(c._id), { ...c, children: [] }]));
    byId.forEach((c) => { if (c.parent && byId.has(String(c.parent))) byId.get(String(c.parent)).children.push(c); });
    const descendants = (cat) => [String(cat._id), ...cat.children.flatMap(descendants)];
    const categoryBySlug = new Map();
    byId.forEach((c) => { const s = blogUrlSlug(c.name); if (s && !categoryBySlug.has(s)) categoryBySlug.set(s, c); });
    const topicBySlug = new Map();
    topics.forEach((t) => { const s = blogUrlSlug(t.name); if (s && !topicBySlug.has(s)) topicBySlug.set(s, t); });

    const blogPosts = posts.filter(p => p.isBlog && p.slug !== FAQ_PAGE_SLUG);
    const postsOfCategory = (cat) => {
        const ids = new Set(descendants(cat));
        return blogPosts.filter(p => p.category && ids.has(String(p.category._id)));
    };
    // Chủ đề: bài gắn chủ đề, hoặc (dữ liệu cũ chưa gắn) tiêu đề có chứa tên chủ đề — giống bộ lọc trên frontend
    const postsOfTopic = (topic) => {
        const id = String(topic._id);
        const name = String(topic.name || '').toLowerCase();
        return blogPosts.filter(p => p.topics.some(t => String(t._id) === id) || (name && p.title.toLowerCase().includes(name)));
    };

    cache = {
        at: Date.now(),
        data: { posts, blogPosts, categories: [...byId.values()], categoryById: byId, categoryBySlug, topics, topicBySlug, postsOfCategory, postsOfTopic, descendants },
    };
    return cache.data;
};

/** Danh sách bài cho API /pages (đã bỏ nội dung đầy đủ). isBlog: 'true' | 'false' | undefined */
const listPosts = async ({ isBlog } = {}) => {
    const { posts } = await loadAll();
    if (isBlog === 'true' || isBlog === true) return posts.filter(p => p.isBlog);
    if (isBlog === 'false' || isBlog === false) return posts.filter(p => !p.isBlog);
    return posts;
};

/** Bài liên quan: cùng danh mục (gồm danh mục con), rồi cùng chủ đề, rồi bài mới nhất */
const relatedPosts = async (page, limit = 4) => {
    const { blogPosts, categoryById, descendants } = await loadAll();
    const selfId = String(page._id);
    const picked = [];
    const add = (list) => list.forEach((p) => { if (picked.length < limit && String(p._id) !== selfId && !picked.includes(p)) picked.push(p); });
    const catId = page.category?._id ? String(page.category._id) : (page.category ? String(page.category) : null);
    if (catId && categoryById.has(catId)) {
        // Ưu tiên đúng danh mục, sau đó cả nhánh danh mục cha
        add(blogPosts.filter(p => p.category && String(p.category._id) === catId));
        const cat = categoryById.get(catId);
        const root = cat.parent && categoryById.has(String(cat.parent)) ? categoryById.get(String(cat.parent)) : cat;
        const ids = new Set(descendants(root));
        add(blogPosts.filter(p => p.category && ids.has(String(p.category._id))));
    }
    const topicIds = new Set((page.topics || []).map(t => String(t._id || t)));
    if (topicIds.size) add(blogPosts.filter(p => p.topics.some(t => topicIds.has(String(t._id)))));
    add(blogPosts);
    return picked;
};

/** Đường dẫn breadcrumb danh mục của bài (cha -> con) */
const categoryTrail = async (categoryId) => {
    if (!categoryId) return [];
    const { categoryById } = await loadAll();
    const trail = [];
    let cur = categoryById.get(String(categoryId));
    const seen = new Set();
    while (cur && !seen.has(String(cur._id))) {
        seen.add(String(cur._id));
        trail.unshift({ name: cur.name, path: categoryPath(cur) });
        cur = cur.parent ? categoryById.get(String(cur.parent)) : null;
    }
    return trail;
};

const isIndexablePost = (p) => p.slug && p.slug !== FAQ_PAGE_SLUG && p.textLength >= MIN_INDEXABLE_TEXT_LENGTH;

module.exports = {
    BLOG_PATH,
    CATEGORY_PREFIX,
    TOPIC_PREFIX,
    MIN_POSTS_FOR_INDEX,
    POSTS_PER_PAGE,
    blogUrlSlug,
    postPath,
    categoryPath,
    topicPath,
    readingMinutes,
    wordCount,
    authorName,
    loadAll,
    listPosts,
    relatedPosts,
    categoryTrail,
    isIndexablePost,
    invalidate,
};
