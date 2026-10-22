# iCards Backend

Máy chủ Node.js (Express 5 + MongoDB) cho web công khai **icards.com.vn** và API `api.icards.com.vn`.

Server này làm ba việc:

1. **API** cho web công khai: đăng nhập, thiệp mời của người dùng, khách mời, lời chúc, mẫu thiệp, bài viết.
2. **Trả trang React kèm thẻ SEO**: mỗi URL được gắn sẵn title, description, canonical, Open Graph, JSON-LD và mã HTTP đúng (200 / 301 / 404) trước khi gửi cho trình duyệt và Google.
3. **Tác vụ nền**: email nhắc lịch sự kiện lúc 8:00 sáng hằng ngày (giờ Việt Nam).

> Trang quản trị `admin.icards.com.vn` dùng backend riêng (`adminapi.icards.com.vn`), không nằm trong thư mục này.

## Cấu trúc thư mục

```
index.js                     Khởi động server, thứ tự middleware, route SEO
src/config/site.js           Tên miền, đường dẫn build frontend, ảnh chia sẻ mặc định
src/routes/                  Khai báo route API
src/controllers/             Xử lý request (sitemap.controller.js: sitemap.xml + robots.txt)
src/services/                Nghiệp vụ (seoRenderer.service.js: gắn meta SEO cho từng URL)
src/models/                  Schema MongoDB
src/middleware/              Xác thực, upload, header bảo mật, bảng chuyển hướng SEO
src/utils/                   slugify (slug tiếng Việt), html (chống XSS), emailTemplates (giao diện email)
src/cron/reminder.cron.js    Email nhắc lịch sự kiện
scripts/normalize-data.js    Chuẩn hóa slug và dữ liệu cũ trong database
deploy/nginx.conf.example    Cấu hình nginx tham khảo (gzip, header bảo mật, chặn index admin)
public/                      File tĩnh của backend (ảnh đại diện mặc định)
```

## Chạy trên máy

```bash
npm install
cp .env.example .env   # rồi điền giá trị thật
npm run dev
```

Các biến môi trường được mô tả trong `.env.example`. Khi chạy trên máy cá nhân, đặt `FRONTEND_BUILD_DIR` trỏ tới thư mục `build` của frontend.

## Lệnh hữu ích

| Lệnh | Tác dụng |
|---|---|
| `npm start` | Chạy server |
| `npm run dev` | Chạy với nodemon (tự khởi động lại khi sửa code) |
| `npm run normalize-data` | Xem trước các slug/dữ liệu cũ cần chuẩn hóa (không ghi gì) |
| `npm run normalize-data -- --apply` | Ghi thay đổi vào database và thêm chuyển hướng 301 cho URL bài viết cũ |

## Quy ước

- **Slug** luôn tạo bằng `src/utils/slugify.js`: "Thiệp chúc mừng Mẹ 20/10" → `thiep-chuc-mung-me-20-10`.
- **Nội dung người dùng nhập** (tiêu đề thiệp, tên khách...) phải qua `escapeHtml` trước khi đưa vào HTML hoặc email.
- **Route ghi/xóa dữ liệu chung** (mẫu thiệp, khối trang chủ, chủ đề) phải có `protect` + `authorize(...)`.
- **Email** dùng `src/utils/emailTemplates.js` để giữ giao diện thống nhất.

Lịch sử thay đổi xem tại [CAP_NHAT.md](CAP_NHAT.md).
