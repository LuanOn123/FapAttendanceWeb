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

## File trong chat

Nhóm học tập → **Gửi file** → chọn tệp → **Gửi kèm file**. Có thể gửi không kèm chữ, bỏ/đổi tệp trước khi gửi. Hỗ trợ PDF, PNG/JPG/JPEG, DOCX, XLSX, TXT, CSV; một tệp/tin, tối đa 500 KB, tên tối đa 120 ký tự, không nhận tệp rỗng. Người nhận bấm thẻ file để tải xuống sau khi backend kiểm quyền nhóm. Thử lại sau lỗi mạng dùng cùng mã gửi và file đã chọn.

Backend cần cấu hình Drive riêng tư bằng `setupStudyGroups()`/`GROUP_FILES_FOLDER_ID`. Không đưa service account hoặc link chia sẻ công khai vào client. Đổi lớp/unmount sẽ hủy lần đọc file đang chờ; tải lại nhóm khi còn nháp sẽ hỏi trước khi bỏ nháp. Phần này đang ở local, chưa deploy.

## Tự chọn nhóm bằng Google Sheets

Khi giảng viên mở đăng ký, màn Nhóm học tập hiện **Chọn nhóm trên Google Sheets**, kể cả sinh viên chưa có nhóm. Link chỉ chấp nhận domain docs.google.com với đường dẫn Spreadsheet hợp lệ. Mở đúng email trường và sửa ô chọn nhóm của bản thân; chờ cột Đồng bộ xác nhận rồi bấm Tải lại nhóm trên web.

Backend dùng module `GroupSignupSheets.gs` và API `getGroupSignupSheet`; owner chạy `setupGroupSignupSheets()` và triển khai đầy đủ gói backend mobile trước khi sử dụng. Bảng đăng ký là file Google riêng theo lớp; API nhóm hiện hành vẫn kiểm enrollment/membership. Chưa triển khai phần này lên web đang chạy.
