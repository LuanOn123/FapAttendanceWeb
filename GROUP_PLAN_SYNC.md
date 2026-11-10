# Tự cập nhật nhóm và ngưỡng FE/PE

Student Web kiểm tra group plan mỗi 15 giây khi tab hiển thị và lúc quay lại tab. Link đăng ký Sheets cũng được kiểm tra lại. API lỗi không làm mất nhóm/bản nháp; lần kiểm tra tiếp theo tự thử lại.

Khi đổi nhóm, nếu không có bản nháp, web tự chuyển nhóm và nạp hội thoại. Nếu có nội dung soạn, tệp đính kèm, tệp đang đọc hoặc lượt gửi chưa rõ kết quả, web giữ bản nháp, ẩn hội thoại cũ và khóa gửi. Bấm **Kiểm tra và tải nhóm hiện tại** rồi xác nhận để bỏ nháp và tải lại. Hủy xác nhận sẽ giữ bản nháp. Web bỏ qua phản hồi từ lớp trước khi người dùng đổi lớp. Backend kiểm tra quyền thành viên trên từng yêu cầu.

Công cụ Tính điểm FE/PE cho phép nhập ngưỡng tối thiểu FE/PE từ đề cương. Mặc định 0 bỏ ngưỡng riêng. Gợi ý phải thỏa cả tổng >5 và ngưỡng đã nhập; PE thấp hơn ngưỡng không tạo cặp gợi ý hợp lệ. Không tự suy đoán chính sách môn/chuyên cần, không ghi vào điểm chính thức.

Đã có test cho thay đổi nhóm, bảo toàn text/file, response cũ, thu hồi quyền và tính ngưỡng. Chức năng được quản lý trên nhánh main của repo Student Web. Cần deploy Hosting mới để website đang chạy có chức năng này; lần sửa này chưa deploy.
