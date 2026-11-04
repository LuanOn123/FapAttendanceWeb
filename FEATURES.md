# Tính năng hệ thống — FU Grade Web

> Tài liệu bên dưới mô tả bản Firestore cũ. Bản mới đã chuyển sang cổng sinh viên dùng backend chung: xin nghỉ, theo dõi đơn và xem điểm đã công bố. Xem `README.md` và `IMPLEMENTATION.md` để chạy phiên bản hiện tại. Quyền sinh viên sửa điểm đã được đóng trong Rules mới.

Ứng dụng web giúp **sinh viên xem và cập nhật điểm**, dữ liệu nạp từ file `.fg`
(xuất từ công cụ FuGrade) và file Excel danh sách lớp. Deploy trên Firebase.

- 🌐 Website: <https://fu-grade-fptu.web.app>
- 💻 Mã nguồn: <https://github.com/phuonglhk070717/fu-grade-web>

---

## 1. Đăng nhập & phân quyền

- **Đăng nhập bằng Google** (Firebase Authentication) — dùng được cả email
  trường `@fpt.edu.vn` lẫn email cá nhân (gmail…) đã đăng ký với lớp.
- **Hai vai trò** tự nhận diện theo email:
  - **Giảng viên (quản trị):** quản trị gốc là `phuonglhk@fpt.edu.vn`; có thể
    thêm giảng viên khác vào danh sách cho phép.
  - **Sinh viên:** chỉ thấy phần điểm của chính mình.
- Phân quyền được **ép ở phía máy chủ** bằng Firestore Security Rules, không chỉ
  ẩn/hiện trên giao diện.

## 2. Nạp dữ liệu (giảng viên)

- **Giải mã file `.fg` ngay trên trình duyệt** (AES-256) — file không bị gửi đi
  đâu. Hỗ trợ file có hoặc không đặt mật khẩu.
- **Đọc nhiều file Excel danh sách lớp** cùng lúc để lấy **email** sinh viên,
  khớp với `.fg` theo **mã số sinh viên (Roll)**.
- Tự động tạo cấu trúc: **Học kỳ → Lớp/Môn → Cột điểm → Sinh viên**.
- **Báo cáo sau khi nạp:** tổng số sinh viên, số sinh viên đã khớp email, và
  danh sách sinh viên còn thiếu email.
- **Nạp lại không mất cấu hình:** khi nạp lại cùng học kỳ, các thiết lập "cho
  sinh viên tự sửa" của từng cột được giữ nguyên.
- Mỗi học kỳ chỉ cần lặp lại với file `.fg` + Excel mới.

## 3. Chấm điểm (giảng viên)

- Chọn **học kỳ → lớp**, xem bảng sinh viên với đầy đủ cột điểm của lớp.
- **Nhập/sửa điểm trực tiếp** trên bảng; tự lưu khi rời ô hoặc nhấn Enter.
- Hiển thị **email** từng sinh viên, cảnh báo đỏ sinh viên **thiếu email**.
- **Bật/tắt quyền cho từng cột điểm:** tick vào cột nào thì sinh viên được tự
  cập nhật cột đó; cột không tick thì sinh viên chỉ xem.

## 4. Xem & cập nhật điểm (sinh viên)

- Đăng nhập Google → hệ thống **tự tìm theo email** và hiển thị điểm của sinh
  viên ở **tất cả các lớp/môn** mình học.
- Mỗi lớp hiện thành một thẻ, liệt kê từng **cột điểm và điểm tương ứng**, kèm
  **nhận xét** (nếu có).
- Với các cột được giảng viên mở quyền: sinh viên **tự nhập/sửa và lưu** điểm.
- Các cột còn lại ở chế độ **chỉ xem**.

## 5. Quản lý giảng viên

- Trang **Giáo viên**: thêm/bớt email các giảng viên được quyền quản trị
  (mỗi email một dòng). Quản trị gốc `phuonglhk@fpt.edu.vn` luôn có quyền.

## 6. Bảo mật & riêng tư

- **Giải mã `.fg` phía trình duyệt**, không gửi file điểm lên máy chủ trung gian.
- **Firestore Security Rules:**
  - Sinh viên chỉ **đọc được bản ghi của chính mình** (khớp email).
  - Sinh viên chỉ **sửa được điểm ở các cột đang mở quyền**, không sửa được cột
    khác, không sửa bản ghi của người khác, không đổi email/tên.
  - Chỉ giảng viên trong danh sách cho phép mới ghi được dữ liệu lớp/điểm.
- Dữ liệu điểm **không nằm trong mã nguồn web** (tránh lộ khi xem mã trang).

## 7. Công nghệ & hạ tầng

- **Giao diện:** React + Vite, responsive (dùng được trên điện thoại).
- **Hạ tầng:** Firebase Hosting (web) + Firestore (dữ liệu) + Authentication
  (đăng nhập Google) — chạy trên **gói miễn phí (Spark)**.
- **Mô hình dữ liệu (Firestore):**

  ```
  config/app                        { teachers: [email, ...] }
  semesters/{semester}              { semester, login, updatedAt }
    classes/{subject__class}        { subject, className, components:[{name, studentEditable}] }
      students/{roll}               { roll, name, email, emailLower, comment,
                                      grades:{<cột>:<điểm>}, editableComponents:[...] }
  ```

## 8. Tiện ích dòng lệnh (tuỳ chọn)

- `tools/decode-fg.mjs`: giải mã nhanh một file `.fg` ra JSON để kiểm tra.

  ```bash
  node tools/decode-fg.mjs duongdan/file.fg "matkhau_neu_co"
  ```

---

## Hướng dẫn sử dụng nhanh

1. Giảng viên đăng nhập bằng `phuonglhk@fpt.edu.vn`.
2. Tab **Quản trị → Nạp dữ liệu**: chọn `.fg` (+ mật khẩu nếu có) và các file
   Excel danh sách lớp → **Nạp dữ liệu**.
3. Tab **Chấm điểm**: nhập điểm, tick các cột cho sinh viên tự cập nhật.
4. Sinh viên vào cùng link, đăng nhập Google để xem/sửa điểm.
