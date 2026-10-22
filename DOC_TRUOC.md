# iCards – bộ code đã sửa (22/10/2026)

Gồm 4 phần, **chưa deploy**. Mọi thay đổi được ghi ở cuối file `CAP_NHAT.md` của từng phần (mỗi đợt một mục có ngày). Bảng tổng hợp dễ đọc: `Tong_hop_sua_loi_iCards_20-10-2026.xlsx`.

| Thư mục | Chạy ở | Ghi chú |
|---|---|---|
| `1_web-khach_icards-frontend` | icards.com.vn (React CRA, React 19, MUI 7) | Repo GitHub `gmallecommerce2026-ship-it/icards`, nhánh `fix/ui-ux-review`. Thay đổi **chưa commit**: `git status` / `git diff` để xem toàn bộ so với commit gốc. |
| `2_backend-cong-khai_icards-backend-master` | api.icards.com.vn (Express 5 + Mongoose) | Phục vụ luôn bản build React và gắn SEO phía máy chủ (`src/services/seoRenderer.service.js`, `blogSeo.service.js`). Biến môi trường: xem `.env.example` (`SITE_URL`, `FRONTEND_BUILD_DIR`, `FAL_KEY` cho tạo ảnh AI, `CORS_EXTRA_ORIGINS`...). |
| `3_backend-admin_icards-dashboard-backend-master` | adminapi.icards.com.vn/api/v1 | Dùng chung MongoDB với backend công khai (models `invitation`, `review` phải giữ cùng cấu trúc). |
| `4_trang-admin_icards-dashboard-master` | admin.icards.com.vn (React) | `src/Utils/shapes.js` và `components/ShapeSvg` phải giống hệt bản web khách. |
| `5_kiem-thu` | máy dev | Kiểm thử tự động, chạy với MongoDB tạm (`mongodb-memory-server`), R2 và fal.ai được giả lập (`stubs.js`). |

Không gồm: `node_modules`, `build`, file `.env` thật. Cài lại bằng `npm install` trong từng thư mục.

## Deploy
Đưa lên **cùng lúc** 4 phần (web khách phụ thuộc API mới của 2 backend):
1. Backend công khai + backend admin: `npm install`, khởi động lại.
2. Web khách: `npm install && npm run build`, chép `build/` vào `FRONTEND_BUILD_DIR` của backend công khai.
3. Trang admin: `npm install && npm run build`, deploy như cũ.
4. Sau deploy: gửi lại `https://icards.com.vn/sitemap.xml` và khai báo `https://icards.com.vn/rss.xml` trong Google Search Console / Cốc Cốc Webmaster.

## Kiểm thử
Trong `5_kiem-thu`: `npm install` (cài `mongodb-memory-server`), sửa đường dẫn `BE` / `ADMIN_BE` ở đầu file theo máy của bạn, rồi:
- `node run.js` — 67 kịch bản API (thiệp, khối hình/bảng, thư mục, thả tim, nhạc, font, AI, đánh giá, watermark).
- `node blog-seo.js` — 42 kịch bản SEO blog (cần một bản build web khách, đặt ở `../fe-local-build` hoặc sửa `FRONTEND_BUILD_DIR`).
- `public-env.js` — chạy thử đủ web + API trên máy (MongoDB tạm, tài khoản thử tự tạo); `seed-blog.js` chép bài blog công khai của web thật vào database tạm.
