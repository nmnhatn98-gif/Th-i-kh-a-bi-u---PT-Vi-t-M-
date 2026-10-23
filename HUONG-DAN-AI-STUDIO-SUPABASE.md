# Google AI Studio — bản chính dùng Supabase

Đây là mã nguồn có thể chỉnh sửa trực tiếp, không nhúng iframe Render.
Chạy phát triển: npm ci rồi npm run dev. Giao diện Vite cổng 3000, API nội bộ cổng 3001.
Chạy công bố: npm run build rồi npm start. PORT do nơi chạy cung cấp.

Chỉ đặt các giá trị sau trong cấu hình bí mật MÁY CHỦ của AI Studio: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FIREBASE_PROJECT_ID, OWNER_EMAIL.
Không đặt khóa vào mã nguồn, prompt Gemini, VITE_* hay file tải công khai.
Không tạo database mới và không nhập lại lịch: dùng đúng dự án Supabase hiện tại.
Firebase Authentication chỉ đăng nhập; dữ liệu chính không dùng Firestore.
Render vẫn là đường dẫn dự phòng, dùng chung Supabase. Hai app dùng chung dữ liệu và cùng phát hiện xung đột phiên bản.

Kiểm tra trước khi công bố: đăng nhập quản trị, tải đủ 17 lớp/42 GV/39 môn/258 ô, đổi một thông tin thử có thể hoàn tác rồi tải lại kiểm chứng, không tự công bố lịch thật.
Giữ nguyên tên miền app hiện tại nếu có thể để không phải thêm quyền đăng nhập Google.
