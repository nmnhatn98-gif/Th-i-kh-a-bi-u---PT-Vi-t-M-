# Đưa app mới vào Google AI Studio

## Trạng thái

Mã nguồn và gói ZIP đã chuẩn bị xong. Chưa đẩy GitHub hoặc nhập app vào tài khoản Google AI Studio vì phiên làm việc chưa có quyền ghi GitHub và trình duyệt tự động không khởi động được. App cũ chưa bị sửa.

## Đường đi qua GitHub

Tài liệu chính thức Google: https://ai.google.dev/gemini-api/docs/aistudio-build-mode

1. Tạo một repository mới, ví dụ `thoikhoabieu-moi`, trong tài khoản GitHub của bạn. Mở gói ZIP, vào thư mục `tkb-smart-new`, đưa **nội dung bên trong** lên thư mục gốc của repo. `package.json`, `index.html`, `server.mjs` và `src/` cần nằm ngay ở gốc, không lồng thêm thư mục.
2. Vào Google AI Studio → **Build** → dấu **+ / Add files** → **Import from GitHub**.
3. Cấp quyền cho repository mới và chọn repo đó. Không thay thế app cũ trước khi đã nghiệm thu bản mới.
4. Khi AI Studio mở dự án, yêu cầu chạy `npm run dev`. Máy chủ đọc `PORT` từ môi trường; mặc định 3000. Không cần khóa Gemini hoặc cấu hình Firebase cho bản 1.0.
5. Dán nội dung trong `PROMPT-AI-STUDIO.txt` để giữ nguyên phạm vi sản phẩm khi AI Studio điều chỉnh cách khởi chạy.
6. Mở Preview, thêm một giáo viên, đặt vào một ô môn học, kiểm tra lưu/tải lại và thử xếp giáo viên đó ở lớp khác cùng tiết: app phải báo trùng.
7. Vào **Thông tin & dữ liệu** để nhập JSON từ bản cũ nếu có. Xuất JSON riêng trước khi đổi sang địa chỉ triển khai thật.

Google có hỗ trợ đồng bộ GitHub hai chiều trong Settings → GitHub. Sau khi app hoạt động, dùng cùng repo mới cho các lần nâng cấp và kéo thay đổi vào AI Studio; kiểm tra thay đổi trước khi ghi đè nếu có xung đột.

## Nếu chưa kết nối GitHub

Có thể dùng tab Code của một app mới để tạo/cập nhật từng file đúng như gói mã nguồn, nhưng ưu tiên Import from GitHub để giữ đầy đủ dự án. Không coi ZIP là định dạng nhập được hỗ trợ nếu giao diện AI Studio của bạn không cung cấp chức năng đó.

## Sau khi nhập thành công

- Xác nhận đúng ma trận 17 lớp, đủ 45 hàng tiết.
- Không có mục phân công chuyên môn và không có ô nhập định mức giáo viên.
- Nhập dữ liệu thật từ JSON và đối chiếu từng lớp với bản cũ.
- Dữ liệu lưu theo trình duyệt và địa chỉ website; bản này chưa có đồng bộ nhiều người.
- Sau khi xác nhận xong mới chia sẻ/triển khai bằng các chức năng của AI Studio. Triển khai Cloud Run có thể phát sinh phí theo tài khoản Google Cloud.
