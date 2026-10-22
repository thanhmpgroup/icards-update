const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    // price = giá bán sau giảm (0 = Miễn phí), originalPrice = giá niêm yết (hiện gạch ngang nếu lớn hơn price)
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, min: 0, default: 0 },
    category: {
        type: String,
        required: true,
        enum: ['Phụ kiện trang trí', 'Quà tặng', 'Shop - Service', 'Tổ chức sự kiện']
    },
    images: [{ type: String }], 
    imgSrc: { type: String },
    stock: { type: Number, default: 0 },
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);
module.exports = Product;

// {
//   "title": "Bó Hoa Tulip Trang Trí",
//   "description": "Bó hoa tulip nhân tạo cao cấp, thích hợp để trang trí bàn làm việc, phòng khách hoặc làm quà tặng.",
//   "price": 250000,
//   "category": "Phụ kiện trang trí",
//   "images": [
//     "https://example.com/images/tulip1.jpg",
//     "https://example.com/images/tulip2.jpg"
//   ],
//   "imgSrc": "https://example.com/images/tulip_main.jpg",
//   "stock": 50,
//   "createdAt": "2025-07-02T10:00:00.000Z",
//   "updatedAt": "2025-07-02T10:00:00.000Z"
// }