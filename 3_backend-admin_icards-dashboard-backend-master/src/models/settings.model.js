// AdminBE/models/settings.model.js
const mongoose = require('mongoose');
const navItemSchema = new mongoose.Schema({}, { _id: false });

navItemSchema.add({
    id: { type: String, required: true },
    title: { type: String, required: true },
    path: { type: String, required: true },
    order: { type: Number, default: 0 },
    isVisible: { type: Boolean, default: true },
    type: { type: String, enum: ['category', 'group', 'type'], required: true },
    originalName: { type: String },
    children: [navItemSchema]
});
const occasionSectionItemSchema = new mongoose.Schema({
    key: { type: String, required: true }, // Lưu 'Category-Group-Type'
}, { _id: false });

const occasionSectionSchema = new mongoose.Schema({
    id: { type: String, required: true },
    title: { type: String, required: true },
    slug: { type: String },
    isVisible: { type: Boolean, default: true },
    order: { type: Number, default: 0 },

    // BẠN PHẢI THÊM DÒNG NÀY ĐỂ LƯU ĐƯỢC CÁC THIỆP TRONG KHỐI
    items: [occasionSectionItemSchema]
}, { _id: false });
const socialLinkSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    icon: { type: String } // Thêm trường icon
}, { _id: false });

// Schema cho một liên kết trong cột footer
const footerLinkSchema = new mongoose.Schema({
    id: { type: String, required: true },
    text: { type: String, required: true },
    url: { type: String, required: true }
}, { _id: false });

const footerColumnSchema = new mongoose.Schema({
    id: { type: String, required: true },
    title: { type: String, required: true },
    links: [footerLinkSchema]
}, { _id: false });

const footerSchema = new mongoose.Schema({
    socialLinks: [socialLinkSchema],
    columns: [footerColumnSchema],
    legalLinks: [footerLinkSchema]
}, { _id: false });

const bannerSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, default: '' },
    isEnabled: { type: Boolean, default: true },
    displayPage: { 
        type: String, 
        enum: ['all', 'home', 'shop', 'professional', 'invitations', 'greetings', 'thanks', 'others'],
        default: 'all' 
    },
    // Bổ sung thêm 'html' vào enum
    mediaType: { type: String, enum: ['image', 'video', 'html'], default: 'image' },
    imageUrl: { type: String, default: '' },
    videoUrl: { type: String, default: '' },
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    htmlContent: { type: String, default: '' },
    link: { type: String, default: '' },
    buttonText: { type: String, default: '' },
    buttonLink: { type: String, default: '' },
    // Vị trí trên trang chủ: 'hero' = slide của banner chính (có thể nhiều slide), 'secondary' = 2 banner phụ
    placement: { type: String, enum: ['', 'hero', 'secondary'], default: '' },
    // Độ tối lớp phủ lên ảnh/video (0 = không phủ). Trước đây luôn phủ 40-60% làm banner bị mờ.
    overlayOpacity: { type: Number, min: 0, max: 0.8, default: 0 },
    // Khung chữ trên banner: vị trí và độ rộng tính theo % kích thước banner (kéo thả, co giãn trong admin)
    textBox: {
        x: { type: Number, min: 0, max: 100, default: 8 },
        y: { type: Number, min: 0, max: 100, default: 50 },
        width: { type: Number, min: 10, max: 100, default: 45 },
        align: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
        color: { type: String, default: '#ffffff' },
        scale: { type: Number, min: 0.5, max: 2, default: 1 }, // hệ số cỡ chữ
    },
    // Tiêu đề + mô tả ngắn hiển thị BÊN DƯỚI banner phụ trang chủ (kiểu Paperless Post)
    captionTitle: { type: String, default: '' },
    captionText: { type: String, default: '' },
    captionLinkText: { type: String, default: '' },
}, { _id: false });


const settingsSchema = new mongoose.Schema({
    singletonKey: { type: String, default: "main_settings", unique: true },
    livePreviewUrl: { type: String, default: "https://icards.com.vn" },
    headerNav: [navItemSchema],
    theme: {
        primaryColor: String,
        fontFamily: String,
        customFontUrl: String,
        logoUrl: String,
        companyName: { type: String, default: 'Công ty TNHH Đầu Tư Phát Triển Kết Nối Thế Giới' },
        address: { type: String, default: 'Cầu Giấy, Hà Nội, Việt Nam' },
        phone: { type: String, default: '(+84) 987 235 1645' },
        announcementBar: {
            text: String,
            isEnabled: Boolean,
            backgroundColor: String,
            textColor: String,
            link: String,
            backgroundImage: String,
            isMarquee: { type: Boolean, default: false }
        }
    },
    banners: [bannerSchema],
    footer: footerSchema,
    seo: {
        pages: {
            home: {
                title: String,
                description: String,
                keywords: String,
                social: { ogTitle: String, ogDescription: String, ogImage: String }
            },
            products: {
                title: String,
                description: String,
                keywords: String,
                social: { ogTitle: String, ogDescription: String, ogImage: String }
            },
            invitations: {
                title: String,
                description: String,
                keywords: String,
                social: { ogTitle: String, ogDescription: String, ogImage: String }
            },
        },
        global: {
            robotsTxt: { type: String, default: "User-agent: *\nAllow: /" },
            organizationSchema: { type: mongoose.Schema.Types.Mixed }
        },
        redirects: [{
            id: String,
            source: String,
            destination: String,
            type: { type: String, enum: ['301', '302'] }
        }]
    },
    occasionOrder: {
        type: [String],
        default: [],
        description: 'Mảng các key (Category-Group-Type) lưu thứ tự hiển thị section Những dịp lan toả niềm vui'
    },
    occasionSections: {
        type: [occasionSectionSchema],
        default: [],
        description: 'Mảng các khối (Section) phân loại Những dịp lan toả niềm vui'
    }
}, { timestamps: true });

const Setting = mongoose.model('Setting', settingsSchema);
const initializeSettings = async () => {
    try {
        const settings = await Setting.findOne({ singletonKey: "main_settings" });
        if (!settings) {
            console.log("Creating default settings document...");
            await Setting.create({
                singletonKey: "main_settings"
                // Bạn có thể thêm các giá trị mặc định khác ở đây nếu muốn
            });
        }
    } catch (error) {
        console.error("Error initializing settings:", error);
        // Thoát tiến trình nếu không thể khởi tạo cài đặt, vì đây là lỗi nghiêm trọng
        process.exit(1);
    }
};



module.exports = { Setting, initializeSettings };
