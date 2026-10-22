// AdminBE/services/topic.service.js
const Topic = require('../models/topic.model');
const PageCategory = require('../models/pageCategory.model');
const Page = require('../models/page.model');
const { slugify, stripUuidSuffix } = require('../utils/slugify');

const withCleanSlug = (data = {}) => {
    if (data.slug === undefined) return data;
    return { ...data, slug: slugify(stripUuidSuffix(data.slug)) || slugify(data.name || '') };
};

// Hàm lấy dữ liệu và build thành cây
const getAllTopics = async () => {
    const topics = await Topic.find().sort('order').lean();
    
    // Thuật toán O(n) để build Tree
    const topicMap = {};
    const tree = [];

    // Khởi tạo map
    topics.forEach(topic => {
        topicMap[topic._id] = { ...topic, children: [] };
    });

    // Phân bổ vào cây
    topics.forEach(topic => {
        if (topic.parentId && topicMap[topic.parentId]) {
            topicMap[topic.parentId].children.push(topicMap[topic._id]);
        } else {
            tree.push(topicMap[topic._id]);
        }
    });

    return tree; // Trả về cấu trúc cây phân cấp
};

// Hàm lấy dữ liệu phẳng (phục vụ dropdown select hoặc map ID)
const getFlatTopics = () => Topic.find().sort('order');

const createTopic = (topicData) => Topic.create(withCleanSlug(topicData));

const updateTopic = (id, topicData) => Topic.findByIdAndUpdate(id, withCleanSlug(topicData), { new: true, runValidators: true });

const deleteTopic = async (id) => {
    // 1. Gỡ topic này ra khỏi tất cả các bài viết đang sử dụng
    await Page.updateMany({ topics: id }, { $pull: { topics: id } });
    
    // 2. Cập nhật các topic con thành cấp 1 (hoặc bạn có thể xoá luôn tuỳ logic nghiệp vụ)
    await Topic.updateMany({ parentId: id }, { parentId: null });

    return Topic.findByIdAndDelete(id);
};

const updateTopicOrder = (topics) => {
    // Cho phép update cả thứ tự và parentId khi kéo thả trên UI
    const promises = topics.map((topic, index) => {
        return Topic.findByIdAndUpdate(topic.id, { 
            order: index,
            parentId: topic.parentId || null
        });
    });
    return Promise.all(promises);
};

// HÀM MỚI: Seed dữ liệu từ PageCategory sang Topic
// HÀM MỚI: Seed dữ liệu từ PageCategory sang Topic (ở cuối file topic.service.js)
const seedFromCategories = async () => {
    const categories = await PageCategory.find().lean();
    let addedCount = 0;

    // Danh mục cha phải được tạo trước để gắn được quan hệ cha-con
    // (trước đây đọc nhầm cat.parentId - trường này không tồn tại, nên mọi chủ đề đều thành cấp 1)
    const depthOf = (cat, seen = new Set()) => {
        if (!cat.parent || seen.has(String(cat._id))) return 0;
        seen.add(String(cat._id));
        const parent = categories.find(c => String(c._id) === String(cat.parent));
        return parent ? 1 + depthOf(parent, seen) : 0;
    };
    const ordered = [...categories].sort((a, b) => depthOf(a) - depthOf(b));
    const topicIdByCategoryId = new Map();

    for (const cat of ordered) {
        // Slug chuẩn: bỏ UUID đuôi và dấu cách mà slug danh mục cũ đang có
        const validSlug = slugify(stripUuidSuffix(cat.slug || '')) || slugify(cat.name);

        let topic = await Topic.findOne({ $or: [{ slug: validSlug }, { name: cat.name }] });

        if (!topic) {
            topic = await Topic.create({
                name: cat.name,
                slug: validSlug,
                order: cat.order,
                parentId: cat.parent ? (topicIdByCategoryId.get(String(cat.parent)) || null) : null
            });
            addedCount++;
        }
        topicIdByCategoryId.set(String(cat._id), topic._id);
    }
    return addedCount;
};

module.exports = {
    getAllTopics,
    getFlatTopics,
    createTopic,
    updateTopic,
    deleteTopic,
    updateTopicOrder,
    seedFromCategories // Export hàm seed
};