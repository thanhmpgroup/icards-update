const Product = require('../models/product.model');
const Template = require('../models/invitationTemplate.model');
const { Setting } = require('../models/settings.model');
const User = require('../models/user.model');
const Invitation = require('../models/invitation.model');
const Page = require('../models/page.model');
const Review = require('../models/review.model');
const Font = require('../models/font.model');
const DesignAsset = require('../models/designAsset.model');
const Media = require('../models/media.model');
const _ = require('lodash');

// Mọi mốc "hôm nay", "7 ngày" tính theo giờ Việt Nam, không theo múi giờ của máy chủ.
const TZ = 'Asia/Ho_Chi_Minh';
const DAY_MS = 24 * 60 * 60 * 1000;
const vnDateKey = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const vnStartOfDay = (date) => new Date(`${vnDateKey(date)}T00:00:00+07:00`);
const ALLOWED_RANGES = [7, 30, 90];

// Số theo ngày (giờ VN) của một collection, đủ mọi ngày trong khoảng (ngày không có dữ liệu = 0).
const dailyCounts = async (Model, match, since, days) => {
    const rows = await Model.aggregate([
        { $match: { ...match, createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } }, count: { $sum: 1 } } },
    ]);
    const byDay = new Map(rows.map(r => [r._id, r.count]));
    return Array.from({ length: days }, (_, i) => {
        const key = vnDateKey(new Date(since.getTime() + i * DAY_MS + 12 * 60 * 60 * 1000));
        return { date: key, count: byDay.get(key) || 0 };
    });
};

const getDashboardData = async ({ days } = {}) => {
    const range = ALLOWED_RANGES.includes(Number(days)) ? Number(days) : 30;
    const now = new Date();
    const today = vnStartOfDay(now);
    const since = new Date(today.getTime() - (range - 1) * DAY_MS);
    const last7 = new Date(today.getTime() - 6 * DAY_MS);
    const prev7 = new Date(today.getTime() - 13 * DAY_MS);
    const customer = { role: 'user' };

    const [
        templatesTotal, templatesActive, templatesFree, templateViews, templatesByCategory,
        productsTotal, productsFree,
        customers, staff, customersToday, customers7, customersPrev7,
        invitationsTotal, invitationsToday, invitations7, invitationsPrev7, guestTotals,
        postsPublished, postsDraft, postsNoSeo, pagesTotal,
        reviewsPending, reviewsApproved, reviewRating,
        fontsTotal, assetsTotal, mediaTotal,
        invitationSeries, customerSeries,
        topUsedRaw, topViewed, recentInvitations, recentCustomers, hotProducts, lowStockProducts,
    ] = await Promise.all([
        Template.countDocuments(),
        Template.countDocuments({ isActive: true }),
        Template.countDocuments({ $or: [{ price: 0 }, { price: { $exists: false } }] }),
        Template.aggregate([{ $group: { _id: null, views: { $sum: { $ifNull: ['$views', 0] } } } }]),
        Template.aggregate([
            { $group: { _id: { $ifNull: ['$category', 'Chưa phân loại'] }, total: { $sum: 1 }, active: { $sum: { $cond: ['$isActive', 1, 0] } } } },
            { $sort: { total: -1 } },
        ]),
        Product.countDocuments(),
        Product.countDocuments({ price: 0 }),
        User.countDocuments(customer),
        User.countDocuments({ role: { $ne: 'user' } }),
        User.countDocuments({ ...customer, createdAt: { $gte: today } }),
        User.countDocuments({ ...customer, createdAt: { $gte: last7 } }),
        User.countDocuments({ ...customer, createdAt: { $gte: prev7, $lt: last7 } }),
        Invitation.countDocuments(),
        Invitation.countDocuments({ createdAt: { $gte: today } }),
        Invitation.countDocuments({ createdAt: { $gte: last7 } }),
        Invitation.countDocuments({ createdAt: { $gte: prev7, $lt: last7 } }),
        Invitation.aggregate([
            { $project: {
                guests: { $ifNull: ['$guests', []] },
                wishes: { $size: { $ifNull: ['$wishes', []] } },
            } },
            { $project: {
                wishes: 1,
                total: { $size: '$guests' },
                attending: { $size: { $filter: { input: '$guests', cond: { $eq: ['$$this.status', 'attending'] } } } },
                declined: { $size: { $filter: { input: '$guests', cond: { $eq: ['$$this.status', 'declined'] } } } },
            } },
            { $group: { _id: null, total: { $sum: '$total' }, attending: { $sum: '$attending' }, declined: { $sum: '$declined' }, wishes: { $sum: '$wishes' } } },
        ]),
        Page.countDocuments({ isBlog: true, isPublished: true }),
        Page.countDocuments({ isBlog: true, isPublished: false }),
        Page.countDocuments({ isBlog: true, isPublished: true, $or: [{ 'seo.metaDescription': { $in: [null, ''] } }, { 'seo.metaDescription': { $exists: false } }] }),
        Page.countDocuments({ isBlog: { $ne: true } }),
        Review.countDocuments({ status: 'pending' }),
        Review.countDocuments({ status: 'approved' }),
        Review.aggregate([{ $match: { status: 'approved' } }, { $group: { _id: null, avg: { $avg: '$rating' } } }]),
        Font.countDocuments(),
        DesignAsset.countDocuments(),
        Media.countDocuments(),
        dailyCounts(Invitation, {}, since, range),
        dailyCounts(User, customer, since, range),
        Invitation.aggregate([
            { $group: { _id: '$template', uses: { $sum: 1 } } },
            { $sort: { uses: -1 } },
            { $limit: 5 },
            { $lookup: { from: Template.collection.name, localField: '_id', foreignField: '_id', as: 't' } },
            { $unwind: { path: '$t', preserveNullAndEmptyArrays: true } },
            { $project: { _id: 1, uses: 1, title: '$t.title', imgSrc: '$t.imgSrc', views: '$t.views', category: '$t.category', isActive: '$t.isActive' } },
        ]),
        Template.find({ isActive: true }).sort({ views: -1 }).limit(5).select('title imgSrc views category').lean(),
        Invitation.find().sort({ createdAt: -1 }).limit(6).select('slug createdAt user template guests').populate('user', 'username email').populate('template', 'title imgSrc').lean(),
        User.find(customer).sort({ createdAt: -1 }).limit(5).select('username email createdAt firstName lastName').lean(),
        Product.find().sort({ clicks: -1 }).limit(5).select('title clicks').lean(),
        Product.find({ stock: { $lt: 10 } }).limit(5).sort({ stock: 1 }).lean(),
    ]);

    const guests = guestTotals[0] || { total: 0, attending: 0, declined: 0, wishes: 0 };
    const views = templateViews[0]?.views || 0;
    const hotTemplates = topViewed.map(t => ({ id: t._id, name: t.title, views: t.views || 0, imgSrc: t.imgSrc, category: t.category }));

    return {
        generatedAt: now.toISOString(),
        range,
        stats: {
            // Trường cũ, giữ để không làm hỏng màn hình cũ
            totalProducts: productsTotal,
            totalTemplates: templatesTotal,
            totalUsers: customers,
            newOrders: invitationsToday,
            dailyVisitors: [], // Chưa có công cụ đo lượt truy cập web; không trả số giả
        },
        kpis: {
            invitations: { total: invitationsTotal, today: invitationsToday, last7: invitations7, prev7: invitationsPrev7 },
            customers: { total: customers, today: customersToday, last7: customers7, prev7: customersPrev7, staff },
            templates: { total: templatesTotal, active: templatesActive, hidden: templatesTotal - templatesActive, free: templatesFree, views },
            products: { total: productsTotal, free: productsFree },
            guests: { total: guests.total, attending: guests.attending, declined: guests.declined, pending: Math.max(0, guests.total - guests.attending - guests.declined), wishes: guests.wishes },
            content: { postsPublished, postsDraft, postsNoSeo, pages: pagesTotal },
            reviews: { pending: reviewsPending, approved: reviewsApproved, avgRating: reviewRating[0]?.avg ? Math.round(reviewRating[0].avg * 10) / 10 : null },
            library: { fonts: fontsTotal, designAssets: assetsTotal, media: mediaTotal },
        },
        series: invitationSeries.map((d, i) => ({ date: d.date, invitations: d.count, customers: customerSeries[i].count })),
        templatesByCategory: templatesByCategory.map(c => ({ category: c._id, total: c.total, active: c.active })),
        topUsedTemplates: topUsedRaw.map(t => ({ id: t._id, title: t.title || 'Mẫu đã xoá', imgSrc: t.imgSrc || '', uses: t.uses, views: t.views || 0, category: t.category || '', isActive: !!t.isActive })),
        topViewedTemplates: hotTemplates,
        recentInvitations: recentInvitations.map(inv => ({
            id: inv._id,
            slug: inv.slug,
            createdAt: inv.createdAt,
            customer: inv.user ? (inv.user.username || inv.user.email) : 'Tài khoản đã xoá',
            template: inv.template ? inv.template.title : 'Mẫu đã xoá',
            imgSrc: inv.template ? inv.template.imgSrc : '',
            guests: Array.isArray(inv.guests) ? inv.guests.length : 0,
        })),
        recentCustomers: recentCustomers.map(u => ({ id: u._id, name: [u.lastName, u.firstName].filter(Boolean).join(' ') || u.username, email: u.email, createdAt: u.createdAt })),
        // Trường cũ
        hotProducts: hotProducts.map(p => ({ id: p._id, name: p.title, clicks: p.clicks || 0 })),
        hotTemplates,
        lowStockProducts,
    };
};


const getSettings = async () => {
    let settings = await Setting.findOne({ singletonKey: "main_settings" });
    if (!settings) {
        // Nếu chưa có, tạo mới với các giá trị mặc định để tránh lỗi null ở frontend
        console.log("Creating default settings document...");
        settings = await Setting.create({
            singletonKey: "main_settings",
            livePreviewUrl: "https://icards.com.vn",
            headerNav: [],
            theme: {
                announcementBar: { text: 'Chào mừng đến với cửa hàng!', isEnabled: true }
            },
            // banners / socialLinks là mảng; trước đây để {} nên database mới tinh tạo cài đặt bị lỗi
            banners: [],
            footer: {
                socialLinks: [],
                columns: []
            },
            seo: {}
        });
    }
    return settings;
};


const updateSettings = async (settingsData) => {
    let settings = await Setting.findOne({ singletonKey: "main_settings" });

    if (!settings) {
        console.log("Creating new settings document during update...");
        return await Setting.create({ singletonKey: "main_settings", ...settingsData });
    }

    // =======================================================================
    // === BẮT ĐẦU SỬA LỖI: LOGIC PHÒNG VỆ VÀ SỬA DỮ LIỆU TỰ ĐỘNG ===
    // =======================================================================
    // Hàm này sẽ đệ quy qua các mục nav và thêm trường 'type' nếu nó bị thiếu.
    // Điều này giúp dữ liệu luôn hợp lệ với schema mới nhất.
    const ensureNavItemsHaveType = (items, level = 0) => {
        if (!items || !Array.isArray(items)) {
            return [];
        }
        return items.map(item => {
            const newItem = { ...item };
            if (!newItem.type) {
                if (level === 0) newItem.type = 'category';
                else if (level === 1) newItem.type = 'group';
                else newItem.type = 'type';
            }
            if (newItem.children) {
                newItem.children = ensureNavItemsHaveType(newItem.children, level + 1);
            }
            return newItem;
        });
    };

    // Trước khi cập nhật, kiểm tra và sửa lại `headerNav` nếu cần thiết.
    if (settingsData.headerNav) {
        settingsData.headerNav = ensureNavItemsHaveType(settingsData.headerNav);
    }
    // =======================================================================
    // === KẾT THÚC SỬA LỖI ===
    // =======================================================================

    // Sử dụng lodash.mergeWith để hợp nhất dữ liệu, nhưng thay thế hoàn toàn các mảng.
    // Điều này đảm bảo rằng việc xóa các mục trong mảng (như banner, link) từ frontend
    // sẽ được phản ánh chính xác trong cơ sở dữ liệu.
    const customizer = (objValue, srcValue) => {
        if (_.isArray(srcValue)) {
            return srcValue;
        }
    };

    _.mergeWith(settings, settingsData, customizer);

    // Đánh dấu các đường dẫn có cấu trúc phức tạp là đã bị sửa đổi để Mongoose biết và lưu lại.
    settings.markModified('theme');
    settings.markModified('banners');
    settings.markModified('footer');
    settings.markModified('seo');
    settings.markModified('headerNav');

    await settings.save(); // Lưu lại các thay đổi vào DB.
    return settings;
};




module.exports = {
    getDashboardData,
    getSettings,
    updateSettings
};