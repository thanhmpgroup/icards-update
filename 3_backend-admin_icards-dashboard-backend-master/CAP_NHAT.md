# Cập nhật 13/10/2026: backend admin (adminapi.icards.com.vn)

Đã chạy thử trên MongoDB tạm với 60 kịch bản kiểm thử, tất cả đạt. Không thêm thư viện mới.

## Deploy

1. Sao lưu thư mục cũ trên máy chủ.
2. Chép code mới đè lên (giữ nguyên file `.env`), khởi động lại tiến trình Node (pm2 restart ...).
3. Deploy cùng lúc với backend công khai (icards-backend), vì ảnh đại diện mặc định `https://icards.com.vn/default-avatar.svg` nằm ở đó.
4. Kiểm tra: đăng nhập admin bình thường; mở `https://adminapi.icards.com.vn/api/v1/pages?status=false` phải KHÔNG còn bài nháp.

Sau khi deploy: tài khoản khách hàng của icards.com.vn không đăng nhập được trang quản trị nữa (đúng ý đồ). Nhân viên đăng nhập như cũ.

## Bảo mật (nghiêm trọng)

| Lỗi | Đã sửa |
|---|---|
| `/api/v1/pages`: thêm/sửa/xóa bài viết, danh mục, tải ảnh lên **không cần đăng nhập**; xem được cả bài nháp | Chỉ còn đọc bài đã xuất bản. Admin dùng `/api/v1/admin/pages` (cần đăng nhập) |
| Tài khoản khách hàng của icards.com.vn (bảng users dùng chung) đăng nhập được API admin | Chỉ admin, designer, marketing đăng nhập được |
| `/auth/register` mở: ai cũng tự tạo tài khoản | Tắt; tài khoản nhân viên do admin tạo |
| Mọi tài khoản đăng nhập được đều xem, sửa, xóa người dùng, **tự nâng quyền admin**; phản hồi tạo user chứa hash mật khẩu | Chỉ admin; không trả mật khẩu, mã reset; admin không tự hạ quyền hoặc tự xóa mình |
| Khối trang chủ (`/admin/template-blocks`) không kiểm tra vai trò | Chỉ nhân viên |
| `/invitation-templates/reorder`, `/bulk-import` không cần đăng nhập; `/seed` là hàm rỗng làm request treo | Đã gỡ (bản có kiểm tra quyền vẫn ở `/admin/templates/...`) |
| `/design-assets/seed` không cần đăng nhập và **xóa toàn bộ tài sản thiết kế** | Chỉ admin, và không bao giờ xóa dữ liệu đang có |
| Không chống dò mật khẩu | Tối đa 10 lần thử / 15 phút mỗi tài khoản, 50 lần / IP |
| Cookie `SameSite=None`: trang lạ có thể gửi form giả mạo kèm cookie admin (CSRF) | `SameSite=Lax` + chặn yêu cầu ghi từ Origin lạ |
| Nhận JSON tới 500 MB trước khi kiểm tra đăng nhập (làm tràn RAM) | 20 MB |
| "Quên mật khẩu" tiết lộ email nào có tài khoản; đặt lại mật khẩu không kiểm tra độ dài | Trả cùng một câu; mật khẩu tối thiểu 8 ký tự |
| Header lộ `X-Powered-By: Express` | Đã ẩn |

## Lỗi chức năng

- **Nút "Published/Draft" trong danh sách bài viết** đổi bài thành Page, xóa danh mục, chủ đề, SEO. Nay chỉ đổi trạng thái xuất bản.
- Lưu form sửa bài viết luôn xóa chủ đề (form không gửi trường này). Nay giữ nguyên.
- Slug xóa chữ có dấu ("Thiệp chúc mừng" → `thip-chc-mng`) ở bài viết, danh mục, chủ đề, mẫu thiệp, nhập Excel. Nay ra `thiep-chuc-mung`; trùng thì thêm `-2`.
- Slug danh mục bị gắn UUID dài (`thiep-moi-cuoi-1908fd58-d356-...`). Danh mục tạo/sửa từ nay bỏ đuôi này.
- Nhập mẫu thiệp từ Excel: dòng thiếu tiêu đề làm lỗi 500; mẫu nhập vào hiện ngay lên web. Nay bỏ dòng trống, mặc định ẩn nếu cột `isActive` để trống.
- "Đồng bộ chủ đề từ danh mục" mất quan hệ cha-con và chép slug lỗi. Đã sửa.
- Tìm kiếm với ký tự như `(` gây lỗi 500 (bài viết, mẫu thiệp). Đã sửa.
- Đăng nhập bằng email chữ hoa thất bại. Đã sửa.
- Đăng xuất lỗi khi phiên đã hết hạn. Đã sửa.
- Lỗi `user is not defined` ở đăng nhập mạng xã hội.
- Lỗi xác thực dữ liệu trả về "Hệ thống đang gặp sự cố" (500) thay vì thông báo cụ thể (400).
- Database mới tinh không tạo được cài đặt mặc định; link xem trước mặc định trỏ nhầm `baotrithangmay.vn`.
- Ảnh đại diện mặc định là ảnh người thật từ pravatar.cc.

## Chưa xử lý

- Trang Media trả toàn bộ ảnh một lần (cần sửa cùng trang admin).
- `config/passport.js` có callback Google trỏ tới địa chỉ trycloudflare tạm (chưa dùng vì chưa gắn route).
- Designer thấy menu "Tài sản Thiết kế" nhưng backend chỉ cho admin thêm/xóa: cần chủ web quyết định.
- `readme.md` chứa SQL của dự án khác; thư mục `src/features/blog` là code React để nhầm chỗ.

## Cập nhật 14/10/2026

- **Banner:** thêm `placement` (hero = slide banner chính, secondary = 2 banner phụ), `overlayOpacity` (độ tối lớp phủ, mặc định 0), `textBox` (vị trí x/y, bề rộng %, căn lề, màu, cỡ chữ), `captionTitle/captionText/captionLinkText` (chữ dưới banner phụ). Giá trị ngoài khoảng bị từ chối (400).
- File banner gửi theo mã banner (`bannerid__<id>__imageUrl`), thêm/xoá/sắp xếp slide không làm lệch ảnh. Vẫn nhận kiểu cũ theo thứ tự.
- **Giá:** mẫu thiệp có `price`, `originalPrice` (sửa được trong admin, cột giá trong file nhập hàng loạt); sản phẩm cho phép giá 0 (Miễn phí) và có `originalPrice` (phải ≥ giá bán).
- `CORS_EXTRA_ORIGINS` trong `.env`: thêm tên miền được gọi API (máy chủ thử nghiệm...), cách nhau bằng dấu phẩy.
- Kiểm thử: 71/71 (thêm 11 kịch bản).

## Cập nhật 18/10/2026 (2)
- Model thiệp (`invitation.model.js`) nhận phần tử khối hình (`type: 'shape'`), giống backend công khai.

## Cập nhật 19/10/2026
- Model thiệp nhận phần tử bảng (`type: 'table'`), giống backend công khai.

## Cập nhật 19/10/2026 (2)
- Duyệt đánh giá của khách (admin, marketing): `GET /api/v1/admin/reviews?status=&q=&page=`, `PUT /api/v1/admin/reviews/:id` `{ status: pending|approved|hidden }`, `DELETE /api/v1/admin/reviews/:id`. Model `Review` dùng chung collection với backend công khai.

## Cập nhật 21/10/2026
- `GET /api/v1/admin/dashboard?days=7|30|90` (mặc định 30) trả số liệu thật, tính theo giờ Việt Nam: `kpis` (thiệp, khách hàng không tính nhân viên, mẫu hiện/ẩn/miễn phí/lượt xem, sản phẩm, khách mời theo trạng thái và lời chúc, bài viết đã đăng/nháp/thiếu mô tả SEO, đánh giá chờ duyệt/điểm trung bình, số font/tài sản/ảnh), `series` (thiệp mới và khách hàng mới mỗi ngày, đủ cả ngày bằng 0), `templatesByCategory`, `topUsedTemplates` (theo số thiệp đã tạo), `topViewedTemplates`, `recentInvitations`, `recentCustomers`. Vẫn giữ các trường cũ (`stats`, `hotTemplates`, `hotProducts`, `lowStockProducts`). Bỏ tham số không dùng (`startDate`, `endDate`, `role`, `category`).
- Tên, email khách hàng trong phản hồi chỉ trả cho admin; designer/marketing nhận danh sách rỗng.
- Đã chạy thử trên MongoDB tạm (dữ liệu mẫu thiệp, font chép từ web công khai; khách hàng, thiệp là dữ liệu thử).
