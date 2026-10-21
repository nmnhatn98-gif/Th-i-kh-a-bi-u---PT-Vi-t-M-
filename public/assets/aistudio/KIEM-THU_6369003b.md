# Kiểm thử bản nền 1.0

## Đã xác nhận bằng kiểm thử tự động

- Khung gốc: 17 lớp, 45 tiết, 289 ô cố định, giờ bắt đầu/kết thúc đúng nguồn.
- Thêm/đổi môn và giáo viên mà không cần bản ghi phân công hoặc định mức.
- Không cho trùng giáo viên giữa các lớp cùng tiết; ô chưa chọn giáo viên không bị báo trùng giả.
- Lịch nhập có trùng được phát hiện và không được chốt.
- Ô khóa không sửa/xóa trước khi mở khóa.
- Xóa lớp không tự sinh lại lớp mẫu khi tải bản sao lưu.
- Không xóa giáo viên đang được dùng trong lịch.
- Snapshot bản đã chốt không bị thay đổi khi sửa bản đang xếp; gỡ chốt không tự phục hồi sau tải lại.
- Khôi phục phiên bản có kèm danh mục.
- Từ chối JSON sai, snapshot hỏng, tham chiếu không tồn tại hoặc nhiều tiết trong một ô.
- Chuyển dữ liệu app cũ giữ ô lịch và bỏ phân công/định mức.
- Xuất CSV có đủ hàng, giữ tiếng Việt, escape nội dung nguy cơ công thức.

17 kiểm thử logic đạt. Build website tĩnh và kiểm tra cú pháp JavaScript thành công. Không cần cài thư viện ngoài.

## Đã kiểm tra bằng Chrome

- Ma trận có đúng 45 hàng tiết và 17 cột lớp.
- Thêm giáo viên qua biểu mẫu danh mục.
- Xếp Toán/giáo viên vào ô 6A1 thứ Hai sáng tiết 2.
- Cùng giáo viên tại 6A2 cùng tiết bị chặn, biểu mẫu hiển thị lỗi.
- Tải lại trang giữ ô lịch và giáo viên vừa thêm.
- Lọc khối 6 còn đúng 3 lớp.
- Giao diện desktop 1600px và điện thoại 390px đã chụp và kiểm tra.
- Không ghi nhận lỗi JavaScript trong các luồng trên.
- File `MO-APP.html` mở trực tiếp được trên Chrome; đã kiểm tra lưu phiên bản, chốt bản chỉ đọc, gỡ chốt rồi tải lại, khóa/mở khóa ô.

Kiểm tra giao diện dùng tài nguyên tĩnh của app trong trình duyệt, không cần truy cập Firebase thật.

## Chưa xác nhận trên môi trường thực

Chưa nhập vào Google AI Studio, chưa kiểm tra Firebase thật, chưa nghiệm thu bản in trên máy in vật lý hoặc nhiều trình duyệt khác nhau. Dữ liệu thời khóa biểu thật của trường chưa được nhập.

## Nghiệm thu thủ công sau khi mở app

1. Mở ma trận: thấy 17 cột lớp và 45 hàng tiết; cuộn ngang/dọc vẫn đọc được đầu cột và thông tin thứ/buổi/tiết/giờ.
2. Vào Danh mục → thêm GV01/Nguyễn An; không có trường nhập số tiết.
3. Trên ma trận, chọn ô 6A1 thứ Hai sáng tiết 2 → chọn Toán và Nguyễn An → lưu.
4. Chọn cùng giáo viên cho 6A2 cùng tiết: phải báo trùng và giữ hộp sửa để điều chỉnh.
5. Khóa/mở khóa/xóa ô; hoàn tác và làm lại.
6. Lưu phiên bản, sửa một ô, khôi phục phiên bản rồi kiểm tra cả danh mục và ô.
7. Chốt lịch, sửa bản đang xếp, xem bản đã chốt vẫn giữ lịch trước; gỡ chốt và tải lại trang.
8. Sao lưu JSON, nhập lại JSON, kiểm tra tệp sai không thay thế dữ liệu.
9. Lọc khối 6, rọi sáng giáo viên, tìm môn; in thử A3 ngang hoặc lưu PDF.
10. Mở cửa sổ rộng 390px: các nút dùng được, cuộn ma trận trong khung, không tràn ngang toàn trang.
