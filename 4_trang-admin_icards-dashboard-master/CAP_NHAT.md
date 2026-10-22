# Cập nhật trang quản trị (admin.icards.com.vn)

Build lại (`npm ci`, `npm run build`) và deploy cùng backend admin mới.

## 10/10/2026
- `robots.txt` chặn Google (Disallow: /), thêm thẻ noindex; tiêu đề tab "Quản trị iCards"; manifest đúng tên và màu thương hiệu.
- Thêm `src/Utils/slugify.js` (bộ tạo slug chuẩn tiếng Việt dùng chung, chưa gắn vào form).

## 14/10/2026
- **Quản lý Banner > Trang chủ:**
  - Banner chính thành slider: nút "Thêm slide" (tối đa 6), xoá, đưa lên/xuống.
  - Mỗi banner có khung xem trước: kéo thả khung chữ, kéo góc để co giãn, chọn căn lề, màu chữ, cỡ chữ, "Đặt lại vị trí".
  - Thanh "Độ tối lớp phủ" (mặc định 0%). Banner HTML tự sinh không còn lớp phủ đen 60%.
  - Ô "Đường dẫn khi bấm vào ảnh banner".
  - 2 banner phụ có ô "Tiêu đề và mô tả bên dưới banner" (tiêu đề, một dòng mô tả, chữ link).
- **Giá:** form mẫu thiệp và form sản phẩm/dịch vụ có Giá niêm yết, Giá bán sau giảm, ô "Miễn phí", xem trước cách hiển thị và chặn giá niêm yết nhỏ hơn giá bán.
- **Trình thiết kế mẫu:** công cụ "Khối hình" giống trình thiết kế của khách (8 hình, màu nền/viền, độ dày, kiểu viền, bo góc); ảnh đại diện mẫu tạo khi lưu có cả khối hình.
- Sửa lỗi kéo thả trong danh sách mẫu của khối trang chủ (thuộc tính `style` bị ghi đè nên không thấy hiệu ứng kéo).

## 18/10/2026
- Đồng bộ `src/Utils/shapes.js` và `components/ShapeSvg` với web khách (thêm đường kẻ, mũi tên, biểu tượng vector; khối hình cũ không đổi).
- Trình thiết kế mẫu trong admin chưa có các công cụ mới của web khách (khung ảnh, hiệu ứng, chuyển động, biểu tượng): cần làm tiếp nếu admin muốn dùng trong mẫu.

## 19/10/2026
- Đồng bộ lại `src/Utils/shapes.js` với web khách (nét vẽ tay/chữ ký dùng khung gốc chữ nhật `viewBoxW/viewBoxH`).
- Chưa vẽ được phần tử bảng (`type: 'table'`) và nền khung chữ (ghi chú dán) của web khách trong trình thiết kế mẫu / xem thiệp của admin.

## 19/10/2026 (2)
- Trang mới **"Đánh giá của khách"** (menu trái, quyền admin/marketing): lọc Chờ duyệt / Đã duyệt / Đã ẩn / Tất cả, tìm theo tên/nội dung, Duyệt (hiện ở trang chủ), Ẩn, Xoá hẳn. Khách sửa đánh giá thì quay về Chờ duyệt.

## 21/10/2026
- **Giao diện chung:** menu trái chia nhóm (Tổng quan · Thiệp & sản phẩm · Thư viện thiết kế · Nội dung website · Hệ thống), thứ tự **Danh mục → Mẫu thiệp → Sản phẩm**; thanh trên cùng có đường dẫn trang, nút "Xem website", tên và vai trò người đăng nhập; nhớ trạng thái thu gọn menu. Mục đang mở vẫn sáng khi vào trang con (sửa bài, thiết kế mẫu). Màu, nút, bảng, ô nhập, hộp thoại thống nhất theo màu thương hiệu #27548A trong `AdminTheme.css` (nạp sau `AdminDashboard.css`, chỉ đổi màu/khoảng cách/chữ). Menu dùng chung ở `adminNav.js`.
- **Bảng điều khiển** (`DashboardHome.js`, `.css`) dùng số liệu thật; bỏ số giả trong `auth.service.js` (lượt truy cập 3.490/ngày, 5 sản phẩm "hot" bịa). Có: thiệp khách tạo (so với tuần trước), khách hàng (không tính tài khoản nhân viên), mẫu đang hiện/ẩn, khách mời và tỉ lệ phản hồi, lượt xem mẫu, lời chúc, bài viết, đánh giá, thư viện; biểu đồ 7/30/90 ngày; mẫu dùng nhiều nhất (theo số thiệp thật) và xem nhiều nhất; mẫu theo danh mục; thiệp và khách hàng mới; "Việc cần xử lý"; "Công cụ" (thao tác nhanh theo vai trò, Search Console, Analytics, PageSpeed, sitemap, robots.txt). Designer/marketing không thấy tên, email khách. Ghi rõ web chưa có công cụ đo lượt truy cập.
- **Font chữ:** thêm một font hay nhiều font đều kiểm tra trùng tên (không phân biệt hoa thường) trước khi cài; hộp thoại liệt kê từng font trùng, xem trước chữ font cũ và file mới, chọn Ghi đè / Bỏ qua (hoặc tất cả), rồi cài tiếp phần còn lại; Huỷ cài đặt thì không đổi gì. Ghi đè giữ nguyên tên và loại font. Cài theo đợt 15 file (trước đây gửi một lần, quá 200 file là lỗi), có thanh tiến độ và bảng kết quả (cài mới / ghi đè / bỏ qua / lỗi). Chặn hai file cùng tên trong một lần cài. Xem trước font chỉ tải khi dòng hiện trên màn hình (trước đây tải cả ~540 file font một lúc). Thêm cột "Loại" bị thiếu trong bảng thêm hàng loạt.
- `api.js`: request có `skipErrorToast: true` thì không hiện thông báo lỗi chung (màn hình tự báo).
- Cần deploy cùng backend admin mới (API `/admin/dashboard` trả thêm số liệu). Build: `npm ci` (cài cả `leaflet` theo package-lock) rồi `npm run build`.
