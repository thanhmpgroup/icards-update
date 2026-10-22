const mongoose = require('mongoose');
const { slugify } = require('../utils/slugify');

const invitationTemplateSchema = new mongoose.Schema({
    category: { type: String, required: true },
    group: { type: String, required: true },
    type: { type: String, required: true },
    title: { type: String, required: true, unique: true },
    imgSrc: { type: String, required: true },
    thumbnailBackgroundSrc: { type: String, default: '' },
    slug: { type: String, unique: true },
    description: { type: String, default: '' },
    templateData: { type: mongoose.Schema.Types.Mixed },
    previewDetails: { type: Object, default: null },
    // Giá mẫu thiệp: price = giá bán sau giảm (0 = Miễn phí), originalPrice = giá niêm yết (hiện gạch ngang nếu lớn hơn price)
    price: { type: Number, min: 0, default: 0 },
    originalPrice: { type: Number, min: 0, default: 0 },
    views: { type: Number, default: 0 },
    displayOrder: { 
        type: Number, 
        default: 0 
    },
    isActive: { 
        type: Boolean, 
        default: false 
    },
    loveGiftsButton: {
        type: {
            text: String,
            link: String,
            isEnabled: Boolean
        },
        default: null
    },
    occasionSectionId: {
        type: String,
        default: null, // null nghĩa là thiệp vãng lai, không nằm trong khối đặc biệt nào ngoài trang chủ
        index: true    // Đánh index để tối ưu tốc độ truy vấn tốc độ cao ngoài trang chủ khi hệ thống phình to
    }
});

invitationTemplateSchema.pre('save', async function() {
    if (this.isModified('title') || !this.slug) {
        // Slug chuẩn tiếng Việt, không trùng (thêm -2, -3...). Trước đây "Thiệp chúc mừng" -> "thip-chc-mng"
        const base = slugify(this.title) || 'mau-thiep';
        let candidate = base;
        let suffix = 2;
        while (await this.constructor.exists({ slug: candidate, _id: { $ne: this._id } })) {
            candidate = `${base}-${suffix}`;
            suffix += 1;
        }
        this.slug = candidate;
    }
});

const InvitationTemplate = mongoose.model('InvitationTemplate', invitationTemplateSchema);
module.exports = InvitationTemplate;
