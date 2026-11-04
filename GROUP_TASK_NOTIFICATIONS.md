# Thông báo giao việc nhóm

Mục **Thông báo giao việc** dùng API Apps Script chung với mobile giảng viên. Có badge tổng chưa đọc cho mọi lớp, xem yêu cầu/hạn Việt Nam, lọc chưa đọc, phân trang và tải lại mỗi 30 giây khi trang đang mở. Mở nội dung mới gọi `readTaskNotification`; không tính đã đọc từ việc tải danh sách hoặc email.

Email trỏ tới `https://<student-host>/#tasks`. Firebase đăng nhập như hiện có; API xác minh email sinh viên và quyền nhóm. React render nội dung dưới dạng text; không dùng HTML từ yêu cầu giảng viên. Đổi tài khoản hoặc unmount bỏ response cũ; lỗi kiểm quyền ẩn dữ liệu đang hiển thị.

Backend cần source `GroupTasks.gs`, router và schema tương ứng trong repo `FeliCd/lecture_mobile`, chạy `setupGroupTasks()`, deploy new version. Email do worker Apps Script gửi, không gửi từ trình duyệt.

Đặt `.env.local`:

```dotenv
VITE_PORTAL_API_URL=https://script.google.com/macros/s/<deployment-id>/exec
```

```powershell
npm ci
npm test
npm run build
npm run dev -- --host 127.0.0.1
```

Deploy đã cấu hình bằng `npm run deploy` (Firebase project `fap-attendance-88920`, target `hosting:student`). Chỉ deploy sau khi backend đã có API mới; bản local này chưa được triển khai. Không thay Firestore rules hay site QR để bật thông báo.

Hướng dẫn owner/queue/quota nằm ở `docs/GROUP_TASK_NOTIFICATIONS.md` của repo mobile. Email bị lỗi không rõ kết quả cần owner kiểm tra; không suy ra email đã đọc từ trạng thái gửi.
