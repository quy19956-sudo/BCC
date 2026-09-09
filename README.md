# Bộ Công Cụ Y Khoa — BẢN CÔNG KHAI

Bản này dùng để đưa lên GitHub Pages công khai.

Đã loại khỏi giao diện và gói phát hành: Tính ngày lĩnh, Quản lý chuyển khoản, Đánh giá tăng trưởng trẻ em, Tính sữa & theo dõi bé, khu vực Sao lưu/Khôi phục.

Đã dọn các tệp trùng chính xác `kiem-tra-thu-thuat-372..375.html` và các bản `.bak` / `.pre_skip_saved`.

Mở `index.html` qua GitHub Pages.

## Giao diện máy tính

Bản này có thêm lớp giao diện responsive cho desktop/laptop (`desktop-theme.css` + `desktop-theme.js`).
- Từ 900px trở lên: trang chính tự mở rộng 3–4 cột, các công cụ tận dụng màn hình rộng, bảng/khối nhập liệu bố trí nhiều cột và iframe dùng trọn phần còn lại của cửa sổ.
- Dưới 900px: giữ nguyên giao diện điện thoại hiện có.
- Service Worker đã tăng cache version và đưa 2 tệp desktop vào cache ngoại tuyến.

## Win98 + MiSans + Layout Fix v2

- Toàn bộ trang dùng lớp `win98-theme.css` thống nhất phong cách Windows 98.
- Ưu tiên font MiSans nếu hệ điều hành/trình duyệt có sẵn; có fallback an toàn để không mất chữ.
- Đã chuẩn hóa chống tràn ngang và chống cắt chữ cho tiêu đề, nút, select, form, card, modal, bảng và thanh tab.
- Mobile: các khối tự co/xuống dòng theo chiều rộng màn hình; không ép chữ ra ngoài khung.
- Desktop: giữ bố cục responsive nhiều cột và mở rộng vùng làm việc.
- Cache Service Worker đã tăng phiên bản để nhận CSS mới ngay sau khi cập nhật.
