# Deploy cổng sinh viên - project FAP ATTENDANCE

Source đã chuyển sang ứng dụng Web Student-Grade của `fap-attendance-88920` theo SDK config tải chính thức từ Firebase ngày 02/11/2026. Giữ nguyên Apps Script API và dữ liệu Sheets. Sau chuyển project, người dùng cần đăng nhập lại Google.

Project này đã có Hosting mặc định phục vụ trang QR check-in. Cổng sinh viên dùng target `student` để deploy riêng. Không deploy cổng này vào site mặc định. Cấu hình triển khai không còn bao gồm Firestore rules cũ của project fu-grade-fptu, tránh thay rules của mobile trong project chung. File rules và emulator tests cũ vẫn giữ để tham chiếu/migration.

## Một lần đầu tiên

Chọn tên site chưa có ai dùng, ví dụ `fap-sinhvien` (chưa kiểm tra tính khả dụng/chưa tạo). Chạy PowerShell:

```powershell
cd C:\PRM\fu-grade-web
firebase hosting:sites:create fap-sinhvien --project fap-attendance-88920
firebase target:apply hosting student fap-sinhvien --project fap-attendance-88920
```

Nếu tên bị trùng, thay `fap-sinhvien` trong cả hai lệnh bằng tên khác. Nếu site đã tạo thành công, không cần chạy lệnh create lại. Mapping target sẽ được lưu tự động vào `.firebaserc`.

Firebase Console -> Authentication -> Settings -> Authorized domains: thêm `fap-sinhvien.web.app` (hoặc hostname site bạn chọn), không nhập https://. Kiểm tra Google provider vẫn Enabled. `authDomain` trong code giữ `fap-attendance-88920.firebaseapp.com`.

Apps Script -> Project Settings -> Script Properties phải tương ứng:

```text
PORTAL_FIREBASE_PROJECT_ID = fap-attendance-88920
PORTAL_FIREBASE_API_KEY = apiKey trong src/firebaseConfig.js
```

Không thay Spreadsheet ID hoặc OAuth audiences/Google client ID. Kiểm tra `.env.local` có VITE_PORTAL_API_URL trỏ đúng backend `/exec` đã có StudentPortal.gs và StudyGroups.gs.

## Deploy

```powershell
npm run deploy
```

Script build `dist` rồi chỉ deploy `hosting:student`. Không cần firebase init, không deploy Firestore rules từ repo web này vào project chung. Domain dự kiến `https://fap-sinhvien.web.app` chỉ hoạt động sau khi site được tạo, mapping và deploy thành công.

Đổi tên site sau này: tạo site mới -> target:apply lại -> npm run deploy -> thêm Authorized domain tương ứng. Dữ liệu không chuyển sang Firebase project khác.

## Kiểm tra sau deploy

- Google login thành công bằng sinh viên test; lớp đúng enrollment trong Sheets.
- Điểm, xin nghỉ, nhóm gọi backend thành công; nếu UNAUTHENTICATED kiểm tra hai PORTAL_FIREBASE_* properties và đăng nhập lại.
- Trang QR cũ tại site mặc định vẫn hoạt động.
- Kiểm tra Hosting URL đúng site student trong output deploy.

Thông báo SHA-1 conflict Android trong ảnh Console là vấn đề Android OAuth riêng; không cần xử lý fingerprint để build/deploy web Hosting. Nếu CLI in UV_HANDLE_CLOSING sau lệnh thành công, kiểm tra trạng thái bằng hosting:sites:list trước khi lặp thao tác create; dùng Node LTS/Firebase CLI hiện hành nếu lỗi lặp lại.
