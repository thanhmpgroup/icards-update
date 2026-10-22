# Cập nhật 09/10/2026: sửa lỗi bảo mật, SEO và giao diện email

Đối chiếu với báo cáo *Đánh giá trang quản trị iCards* (07/10/2026) và rà toàn bộ mã nguồn backend.
Đã chạy thử trên MongoDB tạm với 77 kịch bản kiểm thử, tất cả đạt.

## Phải làm trước khi deploy

1. **Thu hồi API token Cloudflare cũ** (Cloudflare → My Profile → API Tokens). Token cũ đã nằm trong mã nguồn nên coi như bị lộ. Tạo token mới.
2. Thêm vào `.env` trên máy chủ: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (token mới), `CLOUDFLARE_ACCOUNT_HASH` (xem `.env.example`).
3. Chạy `npm install` (có thêm gói `compression`).
4. Khởi động lại server rồi kiểm tra: `https://icards.com.vn/robots.txt` phải ghi `Sitemap: https://icards.com.vn/sitemap.xml`.
5. Sao lưu database, chạy `npm run normalize-data` để xem trước, rồi `npm run normalize-data -- --apply`.
6. Vào Google Search Console, gửi lại `sitemap.xml`.

## Bảo mật (nghiêm trọng)

| Lỗi | Đã sửa |
|---|---|
| Ai cũng gọi được `POST /api/invitation-templates/seed`: **xóa toàn bộ mẫu thiệp** và thay bằng 8 mẫu giả | Chỉ admin đã đăng nhập |
| `GET /api/invitation-templates/migrate/fix-shapes` ghi đè mọi mẫu, `POST /api/design-assets/seed` xóa toàn bộ tài sản thiết kế, không cần đăng nhập | Chỉ admin |
| Thêm/sửa/xóa/sắp xếp khối trang chủ (`/api/template-blocks`) và chủ đề bài viết (`/api/public/topics`) không cần đăng nhập | Chỉ admin, marketing |
| API token Cloudflare ghi thẳng trong `cloudflare.service.js` | Đọc từ `.env` |
| XSS: tiêu đề thiệp do người dùng nhập được chèn thẳng vào thẻ meta của trang `/events/:id` | Escape toàn bộ giá trị meta |
| `/og-image/:id?guestId=../../...` ghi được file PNG ra ngoài thư mục cache | Chỉ nhận `guestId` dạng ObjectId |
| Người đăng nhập bất kỳ xem/ẩn/trả lời/xóa được lời chúc của thiệp người khác | Kiểm tra chủ thiệp |
| `GET /api/invitations/slug/:slug` trả về SĐT, email, tiền mừng của toàn bộ khách, kế hoạch, ngân sách | Chỉ trả dữ liệu công khai |
| `?isActive=false` làm lộ các mẫu thiệp đang ẩn; từ khóa tìm kiếm như `(` làm lỗi 500 | Đã chặn và escape |
| Đặt lại mật khẩu không kiểm tra độ mạnh; "Quên mật khẩu" tiết lộ email nào đã có tài khoản | Đã sửa |
| Giới hạn ảnh tải lên 500 MB/ảnh (giữ trong RAM) | 30 MB/ảnh |
| Header lộ `X-Powered-By: Express`, thiếu header bảo mật | Thêm nosniff, HSTS, chống nhúng iframe lạ; bỏ X-Powered-By |

## SEO

| Lỗi | Đã sửa |
|---|---|
| `robots.txt` ghi `Sitemap: https://your-domain.com/...` vì file cũ trong thư mục build được phục vụ trước route động | Route robots/sitemap chạy trước file tĩnh; đọc ô robots trong trang Quản lý SEO nếu admin có điền |
| 18 bài/trang cũ có slug chứa dấu cách/dấu tiếng Việt trả 404 (server không giải mã URL) | Giải mã URL; script `normalize-data` chuyển sang slug chuẩn và thêm chuyển hướng 301 |
| 11 bài đã xuất bản nhưng không có nội dung | Vẫn mở được nhưng gắn noindex và không đưa vào sitemap (ngưỡng 300 ký tự), tránh trang mỏng nội dung |
| `/page` (trang Tin tức), 7 trang `/collection/...` và các trang danh mục mẫu thiệp trả **404 + noindex** dù hiển thị bình thường | Trả 200, có title/description riêng |
| Trang đăng nhập, thiết kế, tìm kiếm... trả 404 | Trả 200 + noindex |
| Thiệp riêng của khách (`/events/:id`) cho Google lập chỉ mục | noindex |
| Sitemap có `/page` 404 và `/about` (frontend không có trang này) | Sitemap chỉ chứa URL trả 200; thêm các trang bộ sưu tập và trang chính sách |
| Meta description mẫu thiệp chứa thẻ HTML hoặc câu mẫu "Mô tả chi tiết cho mẫu thiệp…" | Bỏ HTML; câu mẫu được thay bằng mô tả tự sinh |
| Tiêu đề mẫu thiệp chỉ có tên, không có từ khóa | Thêm loại thiệp khi tên chưa có chữ "thiệp" (vd: "Hoa Hồng Chúc Phúc – Mẫu thiệp chúc mừng"). Lỗi lặp "Mẫu Thiệp Thiệp" trong báo cáo không do backend; dữ liệu hiện tại đã hết |
| Bảng chuyển hướng trong trang Quản lý SEO lưu được nhưng server không áp dụng | Đã áp dụng (301/302) |
| Thiếu dữ liệu có cấu trúc | Thêm JSON-LD: WebSite (trang chủ), BlogPosting + Breadcrumb (bài viết), Organization (khi admin điền Schema) |
| File JS/CSS có hash bị cache `max-age=0` | Cache 1 năm; bật nén gzip cho HTML/JSON |
| Trang `/faq` trống ("Chưa có câu hỏi nào được tạo"): frontend đọc bài slug `faq` theo dạng khối hỏi/đáp, còn admin lưu HTML | API tự tách HTML (mỗi `<h2>` là một câu hỏi) thành khối hỏi/đáp; `/page/faq` chuyển 301 về `/faq` |

## Lỗi chức năng

- Bộ tạo slug xóa chữ có dấu: "Thiệp chúc mừng Mẹ 20/10" → `thip-chc-mng-m-2010`. Nay ra `thiep-chuc-mung-me-20-10` (mẫu thiệp, bài viết, danh mục, chủ đề).
- Xóa chủ đề bài viết luôn lỗi (`Page` import sai).
- Frontend gọi `POST /invitation-templates/:id/view` để đếm lượt xem nhưng route chưa tồn tại.
- Gửi email hàng loạt luôn báo "0 thất bại" dù có email lỗi; nay gửi theo đợt 5 email để tránh bị Gmail chặn.
- Cron nhắc lịch chạy theo giờ của máy chủ (nếu máy chủ để giờ UTC thì 8:00 UTC = 15:00 giờ Việt Nam). Nay cố định 8:00 giờ Việt Nam. File `reminder.cron.js` cũ đặt lịch **mỗi phút** (chưa gây hậu quả vì chưa được nạp); nay là nơi duy nhất chứa cron.
- Lỗi `ReferenceError: id is not defined` ở `/api/public/events/:eventId`.
- Lỗi lấy tài sản thiết kế làm request treo vô hạn (lỗi bị nuốt).
- API không tồn tại trả trang HTML thay vì JSON 404.
- Đăng nhập bằng email có chữ hoa thất bại; đăng ký trùng email chữ hoa báo lỗi 500.
- Model settings có thể làm sập server nếu MongoDB chậm lúc khởi động.
- Ảnh đại diện mặc định là ảnh người thật dùng chung cho mọi tài khoản; nay là biểu tượng trung tính.

## Giao diện

- **Email thiệp mời, email nhắc lịch, email đặt lại mật khẩu** thiết kế lại theo nhận diện iCards (xanh #27548A, logo chữ, nút bấm rõ, link dự phòng, chân trang), hiển thị tốt trên Gmail, Outlook và điện thoại. Có bản text thuần cho hộp thư không hỗ trợ HTML. Email nhắc lịch ghi rõ số ngày còn lại.
- Email đặt lại mật khẩu trước đây chỉ là văn bản thuần.
- Trang báo bảo trì có thiết kế khi bản build frontend chưa sẵn sàng (trước đây hiện chữ "Error loading page").

## Chưa xử lý được trong bộ code này

Các mục sau thuộc **trang admin** (frontend `admin.icards.com.vn` và backend `adminapi.icards.com.vn`), không nằm trong thư mục này:

- Trang Media (tải 95 MB ảnh gốc, không phân trang), trang Fonts, bảng Người dùng, Dashboard, chia tab Tuỳ chỉnh Giao diện, menu thu gọn trên điện thoại, đưa trang SEO lên menu.
- Bộ tạo slug của backend admin vẫn là bản cũ: cần sửa giống `src/utils/slugify.js`, nếu không bài/mẫu mới tạo từ admin vẫn ra slug lỗi.
- Nén gzip, ẩn phiên bản nginx, chặn Google lập chỉ mục admin: cấu hình nginx, xem `deploy/nginx.conf.example`.

Việc nội dung, đội vận hành tự làm trong admin:

- 15 trang chính sách, liên hệ, tuyển dụng còn ô chưa điền như `[Email liên hệ]`, `[Số điện thoại]`, `[Tên pháp nhân/công ty chủ quản]`, `[Ngày cập nhật]`.
- 60/70 mẫu dùng tên danh mục cũ ("Thiệp Mời", "Thiệp Theo Mùa"...) chưa khớp cây danh mục. Việc này cần người quyết định nên chưa tự chuyển.
- Mẫu thiệp có thể mở bằng slug (`/invitation/hoa-hong-chuc-phuc`), nhưng frontend vẫn liên kết bằng ID. Khi frontend chuyển sang slug thì đổi canonical và sitemap theo.
- Ảnh chia sẻ cá nhân hóa (`/og-image`) cần gói `@napi-rs/canvas`, nhưng `package.json` chưa khai báo. Nếu máy chủ chưa cài thì link chia sẻ luôn dùng ảnh mặc định.

## Đã xử lý trực tiếp trong admin (10/10/2026)

- Gỡ xuất bản (chuyển Draft, không xoá) 12 bài: 1 bài gõ thử "Thiệp cảm ơn – Nghệ thuật tri giúp…" và 11 bài trống.
  - Lưu ý: nút "Published/Draft" trong danh sách bài viết của admin có lỗi ở backend admin. Khi bấm, bài bị đổi loại thành Page và mất danh mục, chủ đề (nội dung, slug, ảnh vẫn giữ). 12 bài trên đều trống nên không ảnh hưởng; nếu xuất bản lại thì cần chọn lại loại bài và danh mục. Trước khi backend admin được sửa, muốn ẩn một bài thật thì mở "Chỉnh sửa" rồi tắt "Hiển thị công khai", không dùng nút này.
- Đổi slug cho 3 bài có nội dung thật đang bị 404:
  - "Thiệp mời & hành vi gửi lời mời trong thời đại số" → `/page/thiep-moi-hanh-vi-gui-loi-moi-trong-thoi-dai-so`
  - "Giới Thiệu iCards.com.vn" → `/page/gioi-thieu-icards-com-vn`
  - "Các câu hỏi thường gặp (FAQ)" → slug `faq` (nội dung của trang `/faq`, hiển thị đủ sau khi deploy)
- Đổi link "Giới thiệu" ở footer từ `/about` (không có trang, khách bị đưa về trang chủ) sang `/page/gioi-thieu-icards-com-vn`. Đã đối chiếu: ngoài link này, không cài đặt nào khác bị đổi.
- Giữ nguyên theo quyết định của chủ web: 3 trang chính sách cũ có slug dấu cách ("Chính sách bảo vệ dữ liệu cá nhân", "Chính sách Đổi, Trả hàng hóa", "Chính Sách Và Quy Định Chung"). Lưu ý: sau khi deploy và chạy `normalize-data`, 3 trang này sẽ mở được và trùng một phần nội dung với các trang chính sách ở footer.
- Kết quả: sitemap hiện tại còn 1/126 URL lỗi (`/page`, hết khi deploy code mới), trước đó 12/136.

## Cập nhật 14/10/2026

- **Giá:** mẫu thiệp có `price` (giá bán, 0 = Miễn phí) và `originalPrice` (giá niêm yết); sản phẩm thêm `originalPrice`. Bộ sưu tập (`/template-blocks/slug/...`) trả kèm giá.
- **Khách mời theo mẫu Excel mới:** mỗi khách lưu thêm 18 cột (xưng hô, vai vế, Họ/Tên đệm/Tên, biệt danh, tên ưu tiên, bên, người mời, ưu tiên, đơn vị, địa chỉ, kênh gửi, trạng thái mời, lời mời cá nhân, ghi chú). Nhập hàng loạt tự tạo nhóm theo "Nhóm quan hệ", chuẩn hoá email, giới hạn số người đi cùng.
- **Gọi khách theo xưng hô:** trang thiệp, email và ảnh chia sẻ dùng "xưng hô + tên ưu tiên" (vd "Bố Minh").
- **Bảo mật:** link thiệp riêng (`?guestId=`) trước đây trả nguyên dữ liệu khách cho chính khách (SĐT, email, tiền mừng). Nay chỉ trả tên, xưng hô, lời mời, trạng thái; không lộ ghi chú hay mức ưu tiên ("Dự phòng") chủ thiệp ghi.
- Kiểm thử: 88/88 (thêm 11 kịch bản).

## Cập nhật 18/10/2026 (2): theo sơ đồ xmind

Deploy cùng web khách mới. Không cần cài thêm thư viện. Biến môi trường:
- `FAL_KEY` (đã có, dùng cho tạo ảnh AI). Không có thì nút AI báo "chưa cấu hình".
- `AI_CARD_LIMIT_PER_DAY` (không bắt buộc, mặc định 20 lượt/tài khoản/ngày).

**Sửa lỗi**
- Lưu thiệp có khối hình bị từ chối (model chỉ nhận phần tử chữ/ảnh) từ đợt 14/10. Nay nhận `shape`.
- Tạo/sửa thiệp bắt buộc gửi `slug`. Nay không bắt buộc: thiệp có trường `name` giữ nguyên chữ khách đặt; đường dẫn tự tạo từ tên, trùng thì -2, -3 (trước đây trả 409). Đổi tên không đổi đường dẫn.

**Mới**
- Thiệp: `name`, `folder` (thư mục dự án), `design.customFonts` (font riêng dùng trong thiệp), `reactions.hearts`.
- `PATCH /api/invitations/:id/folder`; `GET /api/invitations?summary=1` (danh sách rút gọn).
- `POST /api/users/me/upload-audio` (mp3, m4a, ogg, wav, flac, webm ≤ 15MB), `POST /api/users/me/upload-font` (ttf, otf, woff, woff2 ≤ 5MB, tối đa 50 font/tài khoản), `GET /api/users/me/fonts`. Máy chủ nhận dạng tệp theo nội dung, tệp đổi đuôi bị từ chối.
- `POST /api/wishes/public/:id/heart`: thả tim, mỗi khách/trình duyệt 1 lần, giới hạn 30 lượt/phút/IP; danh sách người thả không trả ra ngoài.
- `POST /api/ai/card-art`: tạo 2 ảnh nền thiệp (fal.ai flux schnell, bật lọc nội dung), lưu R2 dạng webp; cần đăng nhập, giới hạn lượt/ngày, cách nhau ≥ 8 giây.
- Kiểm thử: 42/42 (thư mục kiểm thử tạm với MongoDB tạm, R2 và fal.ai giả).

## Cập nhật 19/10/2026
- Model thiệp nhận phần tử bảng (`type: 'table'`: rows, cols, cells, màu viền/nền/chữ...) do công cụ "Bảng" mới của trình thiết kế tạo. Nét vẽ tay/chữ ký là `shape` (shapeType `path`, thêm `viewBoxW/viewBoxH`, `drawKind`); ghi chú dán là `text` có `boxBackground/boxPadding/boxRadius/minBoxHeight` — model đã `strict: false` nên lưu được, không cần đổi.
- Kiểm thử: 46/46 (thêm lưu bảng, chữ ký, ghi chú dán, admin nhận bảng).

## Cập nhật 19/10/2026 (2)
- **Watermark:** dữ liệu thiệp công khai (`/invitations/public/:id`, `/invitations/slug/:slug`) và thiệp của chủ (`GET /invitations/:id`) có thêm `watermark: true` khi thiệp làm từ mẫu giá 0đ (hoặc mẫu không còn). Web khách vẽ dấu iCards.com.vn theo cờ này.
- **Đánh giá của khách (mới):** model `Review` (collection `reviews`, dùng chung với backend admin), mỗi tài khoản 1 đánh giá.
  - `GET /api/reviews/public?limit=` — đánh giá đã duyệt + `stats { average, count }`, không lộ tài khoản.
  - `GET /api/reviews/me`, `POST /api/reviews` (cần đăng nhập): 1–5 sao, nội dung 10–500 ký tự, bỏ thẻ HTML; tạo/sửa đều về trạng thái chờ duyệt; tối đa 5 lần gửi/giờ/tài khoản.
- Kiểm thử: 67/67.

## Cập nhật 20/10/2026: SEO Blog (Tin tức)
**Trang máy chủ trả về (`src/services/blogSeo.service.js`, `src/services/blog.service.js`)**
- **URL danh mục / chủ đề sạch:** `/page/danh-muc/<slug>` và `/page/chu-de/<slug>` (slug tạo từ TÊN, vì slug trong DB có dấu cách / đuôi mã ngẫu nhiên như `huong dan lam thiep`, `trepoti54`). Ví dụ `/page/danh-muc/kien-thuc-van-hoa-thiep`. Danh mục cha gồm cả bài của danh mục con. Phân trang `?trang=2` (12 bài/trang, canonical riêng từng trang). Không có -> 404 thật; viết hoa/có dấu -> 301 về URL chuẩn; dưới 2 bài -> `noindex, follow` (trang mỏng).
- **Link cũ** `/page?category=<id>` và `/page?topic=<id>` -> 301 sang URL sạch. `/page?search=` -> `noindex, follow`.
- **Dữ liệu cấu trúc:** `/page` có `Blog` (10 bài mới) + `BreadcrumbList`; danh mục / chủ đề có `CollectionPage` + `ItemList` + `BreadcrumbList`; bài viết `BlogPosting` (tác giả thật nếu có, chuyên mục, từ khoá, số từ, `inLanguage: vi-VN`, `isPartOf: Blog`), breadcrumb đủ cấp danh mục. Trang tĩnh (điều khoản, chính sách) dùng `WebPage`, không gắn là bài blog.
- **Thẻ bài viết:** `article:published_time`, `article:modified_time`, `article:section`, `article:tag`, `author`; robots `max-image-preview:large, max-snippet:-1` (ảnh lớn trên Google / Discover).
- **Nội dung dựng sẵn:** máy chủ chèn `<div id="ssr-content">` sau `#root` (H1, ngày, tác giả, thời gian đọc, toàn bộ bài, bài liên quan, danh sách bài + phân trang, menu danh mục) để Google, Cốc Cốc, Bing, Zalo đọc được ngay không cần JavaScript. React gỡ khối này khi khởi động và hiển thị đúng nội dung đó. Nội dung bài được lọc `script`, `on*=`, `javascript:` trước khi dựng.
- **RSS:** `/rss.xml` (30 bài mới), thẻ `<link rel="alternate" type="application/rss+xml">` trên các trang blog. Nên khai báo trong Google Search Console / Cốc Cốc Webmaster.
- **Sitemap:** thêm trang danh mục / chủ đề đủ bài, `lastmod` cho `/page`, ảnh đại diện bài viết và mẫu thiệp (`image:image`).

**API**
- `GET /api/pages`: trả danh sách RÚT GỌN (bỏ nội dung đầy đủ, thêm `excerpt`, `readingMinutes`, `author`) và tôn trọng `?isBlog=true|false`. Trước đây trả cả nội dung mọi bài: **~2,1 MB mỗi lần mở trang Tin tức, nay ~32 KB**.
- `GET /api/pages/:slug`: thêm `author.name` (tên thật của tài khoản; trước đây luôn trống vì đọc trường `name` không tồn tại), `readingMinutes`, `wordCount`, `categoryTrail` (breadcrumb danh mục), `related.relatedPosts` (4 bài cùng danh mục / chủ đề).
- Bộ nhớ đệm 60 giây cho dữ liệu blog: bài mới đăng ở admin hiện trên web / sitemap / RSS sau tối đa 1 phút.
- Kiểm thử: 42/42 kịch bản SEO blog (`itest/blog-seo.js`) + 67/67 kịch bản cũ.
