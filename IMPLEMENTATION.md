# Triển khai cổng sinh viên và desktop

> Cập nhật giao diện 30/10/2026: web đã đồng bộ AppPalette desktop (cam #E65C00, cam đậm #AA4100, nền #FFF9F5, chữ #29231F, viền #EDE2DA), font Segoe UI và thẻ bo góc. Làm mới trang đăng nhập, chọn lớp, bảng điểm, đơn nghỉ và các trạng thái tải/rỗng/lỗi. Bố cục được kiểm tra trên desktop và các độ rộng điện thoại 390px/320px. Không thay API hoặc mô hình dữ liệu trong lần chỉnh giao diện này. Để đưa giao diện lên Hosting cần build/deploy frontend; chưa chạy deploy trong lượt này.

Ngày thực hiện: 24/10/2026. Thay đổi gồm ba repo: web sinh viên, desktop Flutter và backend chung trong lecture_mobile. Chưa cập nhật deployment hoặc dữ liệu thật.

## Chức năng đã có trong mã nguồn

- Web đăng nhập bằng Firebase project hiện có `fu-grade-fptu`, lấy lớp từ Enrollments của backend chung. Không phụ thuộc vào việc lớp đã có điểm.
- Sinh viên chọn ngày/buổi học tương lai, gửi lý do 10–1000 ký tự, theo dõi đơn và hủy đơn đang chờ trước giờ học.
- Desktop có hai mục **Xin nghỉ** và **Điểm số**; khung đơn nghỉ hiển thị trong phiên điểm danh đúng lớp/ngày/slot. Có duyệt/từ chối, bộ lọc trạng thái và tải lại.
- Đơn đã duyệt gắn với buổi học, không gắn với mã phiên QR, nên reset phiên không làm mất đơn. Lịch đổi/hủy được cảnh báo và không tự áp sang buổi khác.
- Khi chốt phiên QR, sinh viên chưa có kết quả và có đơn hợp lệ đã duyệt được ghi EXCUSED. Không ghi đè kết quả đã có. Duyệt muộn không sửa âm thầm: tại phiên đã đóng, bấm **Cập nhật nghỉ có phép**; kết quả đã sửa thủ công phải dùng luồng sửa điểm danh hiện có.
- Desktop tạo/sửa/xóa cột, nhập điểm và nhận xét, lưu nháp, xem trước công bố, công bố hoặc thu hồi. Nháp dùng version để chống ghi đè dữ liệu mới.
- Công bố tạo snapshot bất biến của toàn bộ các cột hiện có và nhận xét, tối đa 400 sinh viên × 30 cột/lớp; snapshot và con trỏ bản hiệu lực được ghi trong cùng Sheets API batch. Điểm 0 khác với ô chưa nhập.
- Web chỉ nhận điểm của sinh viên đăng nhập trong bản đang hiệu lực, không nhận bản nháp hay điểm cả lớp. Sửa nháp không thay đổi điểm đã công bố.
- Có công cụ chuẩn bị import `.fg`/JSON và màn hình desktop xem trước nhập điểm vào nháp; chưa tự công bố dữ liệu nhập.
- Firestore Rules mới chặn sinh viên đọc/sửa kho điểm cũ. Trang quản trị Firestore cũ đã bỏ khỏi điều hướng của bản mới; file nguồn cũ được giữ để tham khảo/migration.

## 1. Cập nhật backend dùng chung

1. Sao lưu spreadsheet và phiên bản Apps Script đang chạy.
2. Cập nhật bộ mã trong **C:/PRM/lecture_mobile/backend/apps_script** vào đúng Apps Script project đang phục vụ desktop/mobile. Bao gồm Code.gs, Lab2Free.gs, ScheduleAttendance.gs, AttendanceSafety.gs, SubjectInsights.gs, ClassTools.gs và file mới **StudentPortal.gs**. Giữ manifest hiện có; không tạo thêm doPost.
3. Không deploy riêng `backend/apps_script/Code.gs` của repo desktop đè lên backend chung.
4. Thêm hai Script Properties riêng cho web điểm:

   | Property | Giá trị |
   | --- | --- |
   | PORTAL_FIREBASE_PROJECT_ID | fu-grade-fptu |
   | PORTAL_FIREBASE_API_KEY | apiKey của project fu-grade-fptu, lấy từ src/firebaseConfig.js |

5. Giữ nguyên LAB2_FIREBASE_PROJECT_ID, LAB2_FIREBASE_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_MOBILE_CLIENT_ID và các property đang dùng cho mobile/desktop. Token Firebase web được xác minh riêng, không thay project mobile.
6. Nếu backend chung chưa được khởi tạo, làm hướng dẫn setup hiện có trước. Chạy **setupStudentPortal()** thủ công trong editor với quyền chủ sở hữu. Hàm tạo và kiểm tra sáu bảng Portal*, không thay header của bảng cũ.
7. Deploy một version mới vào deployment `/exec` dùng chung, sau khi kiểm thử/staging. Desktop và web phải trỏ cùng deployment. Danh tính sinh viên phải khớp duy nhất Students.schoolEmail; giảng viên phải khớp Lecturers và sở hữu lớp.

Các bảng mới: PortalLeaveRequests, PortalGradebooks, PortalGradeDrafts, PortalPublications, PortalPublishedGrades, PortalAudit. Không chia sẻ spreadsheet công khai để web đọc trực tiếp.

## 2. Chạy web

Máy hiện tại đã tạo `.env.local` từ APPS_SCRIPT_URL trong cấu hình desktop; file này bị Git bỏ qua. Máy khác:

```powershell
Copy-Item .env.example .env.local
# Điền VITE_PORTAL_API_URL bằng URL /exec của backend chung.
npm ci
npm run dev
```

Nếu backend chưa được cập nhật/khởi tạo, web sẽ báo lỗi thay vì tự quay về kho điểm cũ. Cấu hình Vite được đọc khi khởi động/build; đổi `.env.local` thì chạy lại dev server hoặc build lại.

Firebase Authentication cần bật Google và cho phép domain web thực tế. Firebase của web vẫn giữ nguyên trong src/firebaseConfig.js.

## 3. Chạy desktop

Tại C:/PRM/FAP-Attendance-Desktop-System:

```powershell
flutter run -d windows --dart-define-from-file=config/local.json
```

Đăng nhập giảng viên đã có trong Lecturers. Nhập lớp/danh sách sinh viên bằng chức năng Lớp học hiện có trước; sau đó dùng **Xin nghỉ** và **Điểm số**. Bản exe cũ cần build lại để có menu mới.

Demo offline có bảng điểm mẫu lưu trong bộ nhớ, hiển thị nhãn DEMO và không gửi dữ liệu lên web.

## 4. Chuyển dữ liệu điểm cũ

Không có tác vụ tự động đọc hoặc sửa Firestore production. Có thể dùng `.fg` gốc, JSON đã giải mã dạng SubjectClassGrades, hoặc JSON chuẩn hóa `{semester, classes:[{subject,className,components,students:[{roll,grades,comment}]}]}`.

Tại repo web:

```powershell
node tools/prepare-portal-import.mjs D:/data/FA26.fg D:/data/FA26.portal.json
```

File `.fg` có mật khẩu: công cụ đọc biến môi trường FG_PASSWORD. Không ghi mật khẩu vào mã nguồn hay commit file dữ liệu. Công cụ sử dụng bộ giải mã hiện có của project, không gửi file lên mạng và không ghi đè file output đã tồn tại.

Các cột chuyển đổi mặc định thang 10; công cụ dừng nếu có điểm ngoài thang, không tự cắt điểm hoặc đổi thang. Sau khi kiểm tra quy định môn, có thể chuẩn bị JSON portal với maxScore đúng và nhập vào desktop.

Trên desktop: **Điểm số → chọn đúng học kỳ/môn/lớp → Nhập điểm từ JSON → xem trước → Đưa vào bảng nháp → kiểm tra → Lưu bản nháp**. Import yêu cầu danh sách MSSV khớp đầy đủ, không tự tạo lớp hoặc đoán danh tính. Cần công bố riêng sau khi kiểm tra.

Nếu dữ liệu mới nhất chỉ nằm trên Firestore, giảng viên cần xuất/sao lưu dữ liệu đó sang định dạng chuẩn hóa trước, tránh dùng `.fg` cũ làm mất các sửa đổi sau lần import trước.

## 5. Khi đưa lên dùng thật

1. Hoàn tất backend và thử với lớp kiểm thử, hai tài khoản sinh viên và hai giảng viên.
2. Chuyển điểm cũ vào nháp, kiểm tra mapping. Chưa cần công bố ngay.
3. Build web bằng đúng endpoint. Deploy **cả Rules và Hosting** trong cùng đợt chuyển đổi; không chỉ đổi giao diện trong khi Rules cũ vẫn cho đọc điểm nháp.

```powershell
npm run build
firebase deploy --only firestore:rules,hosting
```

Các lệnh deploy ở đây là hướng dẫn, chưa được chạy trong phiên triển khai. Sau deploy phải kiểm tra truy cập trực tiếp kho cũ bằng tài khoản sinh viên bị chặn, nháp không đọc được, công bố/thu hồi hoạt động qua API.

Rollback: giữ snapshot backend/spreadsheet và bản build web trước. Không tự khôi phục Rules cho phép sinh viên đọc nháp trong khi vẫn sử dụng mô hình công bố mới. Không xóa các bản công bố/audit để rollback giao diện.

## 6. Kiểm thử

Web:

```powershell
npm test
npm run test:rules
npm run build
```

`test:rules` dùng Firebase CLI và Java với project emulator demo-fu-portal, không dùng dữ liệu thật.

Backend chung:

```powershell
node --test backend/test/auth.test.cjs backend/test/lab2-free.test.cjs backend/test/student-portal.test.cjs
```

Desktop:

```powershell
flutter analyze --no-pub
flutter test --no-pub
```

Tests backend dùng Sheets/Google mocks; tests giao diện dùng dữ liệu giả. Cần thử đăng nhập, quota và đường mạng thực tế sau khi cập nhật deployment. Không coi build/test local là đã xác nhận production.

Kết quả kiểm tra local ngày 24/10/2026:

| Kiểm tra | Kết quả |
| --- | --- |
| Backend chung, gồm hồi quy mobile/điểm danh | 96 tests qua |
| Toàn bộ Flutter desktop | 51 tests qua |
| Web UI + công cụ chuyển dữ liệu | 8 tests qua |
| Firestore Rules trên emulator | 3 tests qua |
| Flutter analyzer | Không có lỗi/cảnh báo |
| Web production build | Thành công, thư mục dist |
| Windows release build, dùng config/local.json hiện có | Thành công |

Bản desktop mới ở `C:/PRM/FAP-Attendance-Desktop-System/build/windows/x64/runner/Release/fap_attendance.exe`. Khi phân phối phải giữ toàn bộ thư mục Release, gồm DLL và data; cấu hình backend được nhúng lúc build. Không chạy app trong bước build này và chưa xác nhận kết nối production.

## 7. Giới hạn nghiệp vụ

- MVP công bố toàn bộ cột của lớp, chưa chọn riêng từng cột, chưa tính tổng kết/trọng số/làm tròn.
- Chưa có upload minh chứng nghỉ, thông báo email hoặc tự cập nhật kết quả lên FAP.
- Chính sách EXCUSED trong tỷ lệ vắng tiếp tục theo cấu hình AttendanceSafety hiện có; không tự thay quy định môn học.
- Luồng điểm danh nhanh của mobile chưa thêm giao diện đơn nghỉ. Tự áp EXCUSED trong đợt này dành cho chốt phiên QR; thao tác điểm danh nhanh vẫn là quyết định của giảng viên theo luồng hiện có.
- Dữ liệu đã được xem/copy trước khi thu hồi không thể bị xóa khỏi bản sao cá nhân.
# Nhóm học tập - 02/11/2026

Thêm tab Nhóm học tập: xem nhóm do giảng viên chia, thành viên, chat polling 10s và gửi/tải tệp riêng tư tối đa 500 KB. Cần cập nhật shared Apps Script với StudyGroups.gs, StudentPortal.gs, Lab2Free.gs, Code.gs, manifest và chạy setupStudyGroups() trước. Hướng dẫn đầy đủ: `C:/PRM/lecture_mobile/docs/LAB3_GROUPS_IMPLEMENTATION.md`. Không mở thêm Firestore rules cho chat; hai Firebase project mobile/web giữ nguyên. Retry cùng request key trong màn hiện tại, không có outbox qua restart. Nhóm không phải bản sao đầy đủ EduNext.

