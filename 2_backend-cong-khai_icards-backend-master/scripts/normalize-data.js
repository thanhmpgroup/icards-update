// scripts/normalize-data.js
// Chuẩn hóa dữ liệu cũ trong MongoDB:
//   1. Slug bài viết có dấu cách / dấu tiếng Việt -> slug chuẩn, kèm chuyển hướng 301 từ URL cũ
//   2. Slug mẫu thiệp bị mất chữ có dấu ("thip-chc-mng...") -> tạo lại từ tiêu đề
//   3. Slug chủ đề, danh mục bài viết vô nghĩa / có dấu cách -> tạo lại từ tên
//   4. Ảnh đại diện mặc định là ảnh người thật (pravatar) -> ảnh trung tính của iCards
//
// Cách chạy (mặc định CHỈ XEM TRƯỚC, không ghi gì):
//   node scripts/normalize-data.js
// Ghi thay đổi thật vào database (nên sao lưu database trước):
//   node scripts/normalize-data.js --apply
require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const Page = require('../src/models/page.model');
const InvitationTemplate = require('../src/models/invitationTemplate.model');
const Topic = require('../src/models/topic.model');
const PageCategory = require('../src/models/pageCategory.model');
const User = require('../src/models/user.model');
const Setting = require('../src/models/settings.model');
const { slugify } = require('../src/utils/slugify');
const { DEFAULT_AVATAR_URL } = require('../src/config/site');

const APPLY = process.argv.includes('--apply');

// Lấy slug không trùng trong danh sách đã dùng
const takeUnique = (base, taken) => {
    let candidate = base || 'muc';
    let suffix = 2;
    while (taken.has(candidate)) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
    }
    taken.add(candidate);
    return candidate;
};

/**
 * @param {Model} Model
 * @param {(doc) => string} sourceOf - Chuỗi dùng để tạo slug mới
 * @param {(doc) => boolean} needsFix - Bản ghi nào cần sửa
 */
const planSlugChanges = async (Model, sourceOf, needsFix) => {
    const docs = await Model.find({}).select('_id slug title name').lean();
    const toFix = docs.filter(needsFix);
    const fixIds = new Set(toFix.map(d => String(d._id)));
    const taken = new Set(docs.filter(d => !fixIds.has(String(d._id))).map(d => d.slug));
    return toFix.map(doc => ({ _id: doc._id, label: doc.title || doc.name, from: doc.slug, to: takeUnique(slugify(sourceOf(doc)), taken) }))
        .filter(change => change.from !== change.to);
};

const printChanges = (title, changes) => {
    console.log(`\n=== ${title}: ${changes.length} thay đổi ===`);
    changes.forEach(c => console.log(`  - ${c.label}\n      ${c.from}  ->  ${c.to}`));
};

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(APPLY ? '>>> CHẾ ĐỘ GHI THẬT (--apply)' : '>>> CHẾ ĐỘ XEM TRƯỚC (thêm --apply để ghi)');

    const pageChanges = await planSlugChanges(Page, d => d.slug || d.title, d => !d.slug || d.slug !== slugify(d.slug));
    const templateChanges = await planSlugChanges(InvitationTemplate, d => d.title, d => d.slug !== slugify(d.title));
    const topicChanges = await planSlugChanges(Topic, d => d.name, d => d.slug !== slugify(d.name));
    const categoryChanges = await planSlugChanges(PageCategory, d => d.name, d => d.slug !== slugify(d.name));
    const avatarCount = await User.countDocuments({ avatar: /pravatar\.cc/ });

    printChanges('Slug bài viết (sẽ thêm chuyển hướng 301 từ URL cũ)', pageChanges);
    printChanges('Slug mẫu thiệp', templateChanges);
    printChanges('Slug chủ đề bài viết', topicChanges);
    printChanges('Slug danh mục bài viết', categoryChanges);
    console.log(`\n=== Ảnh đại diện pravatar cần thay: ${avatarCount} tài khoản ===`);

    if (!APPLY) {
        console.log('\nChưa ghi gì vào database. Chạy lại với --apply để áp dụng.');
        return;
    }

    // Dùng updateOne để không kích hoạt hook/validate khác của model
    const applySlugs = (Model, changes) => Promise.all(changes.map(c => Model.updateOne({ _id: c._id }, { $set: { slug: c.to } }, { timestamps: false })));
    await applySlugs(Page, pageChanges);
    await applySlugs(InvitationTemplate, templateChanges);
    await applySlugs(Topic, topicChanges);
    await applySlugs(PageCategory, categoryChanges);

    if (pageChanges.length) {
        const settings = await Setting.findOne({ singletonKey: 'main_settings' }).lean();
        const existing = new Set((settings?.seo?.redirects || []).map(r => r.source));
        const newRedirects = pageChanges
            .filter(c => c.from && !existing.has(`/page/${c.from}`))
            .map(c => ({ id: crypto.randomUUID(), source: `/page/${c.from}`, destination: `/page/${c.to}`, type: '301' }));
        await Setting.updateOne(
            { singletonKey: 'main_settings' },
            { $push: { 'seo.redirects': { $each: newRedirects } } },
            { upsert: true }
        );
        console.log(`Đã thêm ${newRedirects.length} chuyển hướng 301 vào trang Quản lý SEO.`);
    }

    if (avatarCount) {
        await User.updateMany({ avatar: /pravatar\.cc/ }, { $set: { avatar: DEFAULT_AVATAR_URL } }, { timestamps: false });
    }

    console.log('\nHoàn tất.');
};

run()
    .catch((err) => {
        console.error('Lỗi:', err);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
