# Tự cập nhật nhóm và ngưỡng FE/PE

Student Web kiểm tra group plan mỗi 15 giây khi tab hiển thị và lúc quay lại tab. Link đăng ký Sheets cũng được kiểm tra lại. API lỗi không làm mất nhóm/bản nháp; lần kiểm tra tiếp theo tự thử lại.

Không có nháp: tự đổi sang plan hiện tại và nạp lại chat. Có text/file/đọc file/lần gửi chưa rõ kết quả: giữ bản nháp, ẩn hội thoại cũ và khóa gửi. Bấm Kiểm tra nhóm mới, xác nhận rồi mới bỏ nháp và tải lại. Nếu chỉ hủy xác nhận, dữ liệu soạn vẫn còn. Response cũ sau đổi lớp không được áp dụng. Backend luôn kiểm membership mỗi request; poll không thay kiểm quyền.

Công cụ Tính điểm FE/PE cho phép nhập ngưỡng tối thiểu FE/PE từ đề cương. Mặc định 0 bỏ ngưỡng riêng. Gợi ý phải thỏa cả tổng >5 và ngưỡng đã nhập; PE thấp hơn ngưỡng không tạo cặp gợi ý hợp lệ. Không tự suy đoán chính sách môn/chuyên cần, không ghi vào điểm chính thức.

Đã có test cho thay đổi nhóm, bảo toàn text/file, response cũ, thu hồi quyền và tính ngưỡng. Chức năng được quản lý trên nhánh main của repo Student Web. Cần deploy Hosting mới để website đang chạy có chức năng này; lần sửa này chưa deploy.
