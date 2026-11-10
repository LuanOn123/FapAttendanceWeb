# Tính điểm FE/PE cho sinh viên

Vào Student Web → chọn lớp → **Tính điểm FE/PE**.

1. Nhập điểm Assignment, PT, Quiz… trên thang 10 và trọng số của từng cột theo syllabus. Thêm/xóa cột khi cần.
2. Giữ FE hoặc thêm PE, nhập trọng số, để trống điểm bài thi cần tính. Nếu đã có điểm một bài thi thì nhập để cố định điểm đó.
3. Nhập ngưỡng FE/PE tối thiểu từ đề cương nếu môn có điều kiện này; 0 nghĩa là không áp dụng ngưỡng riêng. Tổng trọng số phải đúng 100%. Nhấn **Tính điểm cần đạt**.

Không tự gán trọng số mẫu cho môn. Nhận dấu phẩy hoặc dấu chấm thập phân, tối đa hai chữ số thập phân. Điểm 0 là điểm hợp lệ; ô trống ở cột thường là lỗi, không tự coi là 0.

## Công thức

Tổng = Σ (điểm × trọng số / 100).

Theo yêu cầu, mục tiêu là **tổng > 5**, không phải ≥ 5. Không làm tròn tổng trước khi so sánh. Điểm thi đề xuất là mức nhỏ nhất theo bước 0,1 thỏa điều kiện này, trong khoảng 0–10.

Ví dụ: Assignment 5 (20%), PT 5 (20%), Quiz 5 (20%), FE 40%.
Điểm tích lũy quy đổi = 3; FE phải > 5. Công cụ gợi ý FE **5,1**, khi đó tổng **5,04**. FE 5 chỉ cho tổng 5, chưa vượt mục tiêu.

Nếu chưa có cả FE và PE, có vô số cặp điểm: công cụ gợi ý mức điểm bằng nhau cho hai bài và bảng giả định PE từ 0 đến 10, kèm FE tối thiểu tương ứng. Không hiểu hai mức điểm riêng lẻ như hai dự đoán độc lập. Nếu dù các bài còn lại đều 10 vẫn không vượt 5, hiển thị tổng tối đa và trạng thái không thể đạt bằng các phần thi còn lại.

Phép tính dùng số nguyên (điểm × 100, trọng số × 100) để tránh sai số dấu phẩy động ở ngưỡng 5 và tổng trọng số 100%.

## Vai trò và dữ liệu

- Đây là công cụ tự tính dành cho **sinh viên trên Student Web**. Mobile/Desktop vẫn dành cho giảng viên.
- Xét tổng >5 và điểm FE/PE >= ngưỡng do người dùng nhập từ đề cương. Không tự suy đoán ngưỡng môn, chuyên cần, chính sách làm tròn hay các điều kiện đậu khác; người dùng vẫn cần kiểm tra syllabus.
- Nhập liệu nằm trong bộ nhớ của màn hình; chuyển tab/lớp, đăng xuất hoặc tải lại sẽ mất bản thử. Không dùng localStorage, không gọi API ghi và không sửa snapshot điểm được giảng viên công bố từ Desktop/Mobile.
- Tính năng không cần thay đổi API hoặc deployment backend. Cần build/deploy Student Web mới để dùng trên website đang chạy; thay đổi hiện tại chỉ ở local.

## Kiểm tra

Test bao phủ ngưỡng >5, điểm 0, dấu phẩy, tổng trọng số thập phân, điểm ngoài thang, dữ liệu thiếu, tình huống FE/PE cùng chưa có điểm, điểm tối đa không đủ, trường hợp điểm đã biết đạt mục tiêu, làm tròn lên theo bước 0,1 và kiểm tra nhiều bộ đầu vào. Test UI kiểm tra nhập liệu, sửa dữ liệu xóa kết quả cũ, bảng hai bài thi, điều hướng theo lớp và không gọi API ghi.
