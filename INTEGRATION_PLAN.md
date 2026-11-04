# Kế hoạch tích hợp xin nghỉ và công bố điểm

Ngày phân tích: 24/10/2026. Phạm vi lần này: khảo sát mã nguồn và lập kế hoạch; chưa sửa chức năng, chưa triển khai backend hoặc Firebase.

> Cập nhật ở lượt triển khai tiếp theo: các luồng MVP đã có trong mã nguồn. Xem `IMPLEMENTATION.md` để biết phạm vi thực tế, các giới hạn và các bước cấu hình/deploy còn cần thực hiện. Nội dung bên dưới giữ vai trò kế hoạch gốc.

## 1. Mục tiêu và phân chia trách nhiệm

- **Web sinh viên (`C:/PRM/fu-grade-web`)**: đăng nhập, xem các lớp đang học, chọn buổi học tương lai để xin nghỉ, theo dõi trạng thái đơn và xem điểm đã được công bố.
- **Desktop giảng viên (`C:/PRM/FAP-Attendance-Desktop-System`)**: quản lý đơn, thấy đơn khi mở đúng buổi điểm danh, duyệt/từ chối, quản lý điểm và công bố điểm lên web.
- **Backend dùng chung (`C:/PRM/lecture_mobile/backend/apps_script`)**: xác thực, phân quyền, kiểm tra lịch và danh sách lớp, lưu dữ liệu, quyết định dữ liệu nào được trả về.
- **Mobile hiện có**: tiếp tục dùng backend chung; chưa đưa màn hình xin nghỉ/điểm vào phạm vi nâng cấp này. Các thay đổi backend phải giữ tương thích với mobile.

Đây là cổng bổ sung cho hệ thống của nhóm. Không mặc định xem công bố điểm trên cổng này là cập nhật điểm hay trạng thái nghỉ lên FAP chính thức.

## 2. Hiện trạng đã kiểm tra

| Thành phần | Đã có trong mã nguồn | Khoảng trống so với yêu cầu |
| --- | --- | --- |
| Web React/Vite | Firebase Authentication, Firestore, nhập `.fg` và Excel, giảng viên sửa điểm, sinh viên xem/sửa các cột được mở quyền | Chưa có đơn nghỉ; chưa có trạng thái nháp/công bố; chưa kết nối dữ liệu lớp/lịch của desktop |
| Desktop Flutter Windows | OAuth giảng viên, lớp, lịch, nhập danh sách sinh viên, điểm danh và báo cáo | Chưa có module quản lý điểm và công bố; chưa có đơn xin nghỉ |
| Backend chung | Students, Classes, Enrollments, Sessions, Attendance; lịch có ngoại lệ; xác thực Google/Firebase | Chưa có mô hình và API cho đơn nghỉ, bảng điểm, phiên bản công bố |
| Điểm danh | Mô hình hỗ trợ `EXCUSED`; backend có audit sửa điểm danh | Chưa tự liên kết `EXCUSED` với một đơn được duyệt |

Các căn cứ trong mã nguồn:

- Web: `src/lib/store.js`, `src/pages/Student.jsx`, `src/pages/Admin.jsx`, `firestore.rules`, `FEATURES.md`.
- Desktop: `lib/services/markbook_reader.dart`, `lib/models/roster.dart`, `lib/repositories/attendance_repository.dart`, `lib/features/attendance/attendance_screen.dart`, `lib/models/attendance_record.dart`.
- Backend chung: `Code.gs`, `Lab2Free.gs`, `ScheduleAttendance.gs`, `AttendanceSafety.gs`.

`MarkbookReader` hiện phục vụ nhập danh sách sinh viên từ XLSX/ODS; không nên coi đây là chức năng nhập và quản lý điểm đã hoàn thành. Web hiện cho sinh viên sửa điểm ở một số cột, trong khi yêu cầu mới chỉ nêu xem điểm sau công bố: luồng mới nên mặc định chỉ đọc.

Lưu ý khi bắt đầu code: repo desktop đang có nhiều thay đổi chưa commit. Phải giữ nguyên phần việc hiện có, rà soát diff trước khi sửa. README desktop chỉ rõ dùng backend chung trong `lecture_mobile`, tránh deploy bản `Code.gs` độc lập của desktop đè lên backend đang phục vụ mobile.

## 3. Kiến trúc đề xuất

```text
Web React (sinh viên) ───────┐
                            ├── API Apps Script dùng chung ── Google Sheets
Desktop Flutter (giảng viên)┤       xác thực + phân quyền       lớp / lịch
Mobile hiện có ─────────────┘                                  đơn / điểm

Firebase Hosting: phục vụ web
Firebase Authentication: đăng nhập web
Firestore hiện tại: dữ liệu điểm cũ trong giai đoạn chuyển đổi
```

Đề xuất dùng **Sheets qua API chung làm nguồn dữ liệu chính cho hai tính năng mới**, bởi lớp, danh sách sinh viên, quyền sở hữu lớp và buổi học đã nằm ở đây. Không cho web tự ghi đơn vào Firestore rồi để desktop đọc Sheets: cách đó cần thêm đồng bộ và có thể tạo hai trạng thái khác nhau cho cùng một đơn.

Giữ React/Vite và Firebase Hosting của web. Tạo lớp API cho web, dùng Firebase ID token được backend kiểm tra. Desktop tiếp tục gửi Google ID token qua `GoogleSheetService`. Backend hiện có đường xác thực Firebase cho sinh viên, nhưng cần kiểm tra cấu hình project thực tế trước khi tái sử dụng; không mặc định Firebase của hai ứng dụng đã trùng nhau.

Mỗi loại token cần đường xác minh riêng, kiểm tra issuer/audience/expiry/email_verified đúng loại. Không truyền Firebase ID token vào đường xác minh Google OAuth token chỉ vì cùng được gọi là `idToken`. Giữ nguyên hợp đồng xác thực hiện có cho mobile.

**Điểm đánh đổi:** hướng này cần chuyển phần truy cập điểm của web sang API chung. Nếu muốn tiếp tục lưu điểm ở Firestore, phải thiết kế thêm quyền giảng viên theo lớp và lớp tích hợp desktop/Firestore; không nên làm cả hai nguồn chính trong cùng đợt đầu. Khả năng đáp ứng tải và quota Sheets/Apps Script phải đo bằng số lớp, số sinh viên và tần suất sử dụng thực tế trước khi mở rộng.

## 4. Định danh dùng chung

- Dùng `classId`, `studentId`, quan hệ `Enrollments` của backend cho mọi thao tác mới.
- Email đăng nhập đã xác minh dùng để tìm sinh viên; không tin `studentCode`, email hoặc vai trò do client tự gửi.
- Khớp dữ liệu web cũ bằng học kỳ + mã môn + mã lớp, sau đó mã sinh viên và email. Không dùng riêng tên lớp vì lớp có thể lặp giữa học kỳ/môn.
- Backend hiện có `occurrenceId` trong `ScheduleAttendance.gs`, tạo từ lịch, ngày và ngoại lệ. Dùng định danh buổi học này cho đơn nghỉ, đồng thời lưu `classId`, ngày, slot và giờ để hiển thị, đối chiếu lịch.
- Không phụ thuộc `sessionId` lúc nộp đơn: sinh viên cần xin trước khi thầy tạo phiên. Khi phiên được tạo/reset, liên kết lại theo buổi học, tránh mất đơn.
- Với lịch đổi/hủy sau lúc nộp: giữ lịch sử đơn, đánh dấu cần rà soát và không tự áp đơn sang buổi khác. Nếu chỉnh giờ mà định danh không đổi, so sánh thêm thông tin buổi đã lưu trong đơn.

## 5. Feature xin nghỉ

### Luồng sinh viên

1. Đăng nhập → lấy các lớp từ Enrollments, kể cả lớp chưa có điểm.
2. Mở **Xin nghỉ** → chọn lớp → chọn buổi học hợp lệ trong tương lai do backend trả về, có xử lý học bù/đổi lịch/hủy lịch.
3. Nhập lý do, xem lại môn/lớp/ngày/slot/giờ → gửi đơn.
4. Xem lịch sử và kết quả: chờ duyệt, đã duyệt, từ chối, đã hủy.
5. Có thể hủy đơn đang chờ trước giờ học. Sau khi bị từ chối có thể nộp đơn mới trước hạn, nhưng không được có nhiều đơn đang chờ/đã duyệt cho cùng sinh viên và buổi.

Không dùng checkbox đơn lẻ để lập tức chuyển điểm danh thành nghỉ có phép. Nếu giao diện dùng checkbox “Xin nghỉ”, thao tác đó mở form/xác nhận; kết quả gửi ban đầu vẫn là **chờ duyệt**.

### Luồng giảng viên

1. Có trang **Đơn xin nghỉ** lọc theo lớp, ngày, trạng thái.
2. Mở một slot điểm danh → hiện số đơn và danh sách sinh viên đã gửi cho đúng buổi đó, kể cả đơn chưa được duyệt.
3. Xem lý do, thời gian gửi → duyệt/từ chối; có thể ghi nhận xét, bắt buộc lý do khi từ chối.
4. Khi chốt phiên: sinh viên chưa điểm danh và có đơn hợp lệ đã duyệt được ghi `EXCUSED`; sinh viên chưa có đơn duyệt được xử lý vắng theo luồng hiện tại.
5. Không tự ghi đè `PRESENT`, `LATE` hoặc kết quả đã được giảng viên sửa thủ công. Nếu đơn được duyệt sau khi phiên đã chốt, hiển thị thao tác cập nhật rõ ràng qua cơ chế sửa điểm danh có audit.

### Quy tắc nghiệp vụ đề xuất

- Nộp/hủy trước giờ bắt đầu buổi học; dùng giờ máy chủ theo `Asia/Ho_Chi_Minh`.
- Kiểm tra sinh viên đang thuộc lớp và buổi học tồn tại; không cho nộp cho buổi bị hủy.
- Đề xuất lý do dài 10–1000 ký tự. MVP chưa cần file minh chứng.
- Chuyển trạng thái: `PENDING → APPROVED | REJECTED | CANCELLED`. Không cho client tự đặt trạng thái duyệt.
- Giảng viên chỉ xử lý lớp thuộc quyền của mình; sinh viên chỉ đọc đơn của chính mình.
- Gửi/duyệt phải chống nhấn hai lần và yêu cầu đồng thời bằng idempotency key, version và script lock.
- `EXCUSED` có tính vào tỷ lệ vắng hay không phải theo quy định thầy chốt. Backend đã có cấu hình liên quan trong `AttendanceSafety.gs`; cần tái sử dụng và kiểm tra báo cáo, không tự đặt chính sách mới.
- Export sang FAP: kiểm tra riêng vì mã hiện có có đường quy đổi `EXCUSED` sang `ABSENT`; không giả định FAP hỗ trợ nghỉ có phép như ứng dụng nội bộ.

### Bảng dữ liệu đề xuất: LeaveRequests

`requestId, classId, studentId, occurrenceId, scheduleId, exceptionId, sessionDate, slot, scheduledStartTime, scheduledEndTime, reason, status, submittedAt, reviewedAt, reviewedBy, reviewNote, cancelledAt, version, idempotencyKey`

Thêm bảng audit chỉ ghi nối tiếp: người thao tác, thời điểm, trạng thái trước/sau, lý do. Tên và email hiển thị lấy từ hồ sơ được backend kiểm tra, không dùng dữ liệu người gửi tự khai làm căn cứ phân quyền.

## 6. Feature quản lý và công bố điểm

### Desktop giảng viên

1. Mở **Quản lý điểm** → chọn học kỳ, lớp/môn thuộc quyền giảng viên.
2. Tạo cột điểm, xác định thang điểm và trọng số nếu có; nhập/sửa từng ô trong bản nháp.
3. Hỗ trợ nhập dữ liệu từ file sau khi có bản xem trước và báo lỗi theo sinh viên/cột. Có thể triển khai nhập tay trước, import `.fg`/Excel ở đợt sau.
4. Nhấn **Xem trước công bố** → thấy số sinh viên, cột được công bố, ô trống và thay đổi so với phiên bản trước.
5. Nhấn **Công bố** → tạo một phiên bản bất biến gồm dữ liệu của các cột đã chọn.
6. Sửa tiếp bản nháp không làm thay đổi điểm sinh viên đang thấy. Muốn cập nhật phải công bố phiên bản mới. Có thao tác thu hồi bản công bố, lưu audit.

MVP đề xuất công bố theo lớp với tập cột được chọn. Chỉ tính tổng kết khi đã xác định công thức, quy tắc làm tròn và cách xử lý điểm thiếu. Chưa suy diễn các quy định này từ tên cột.

### Web sinh viên

- Chọn học kỳ/lớp → backend chỉ trả snapshot của bản công bố đang hiệu lực và chỉ hàng của sinh viên đăng nhập.
- Hiển thị cột điểm, giá trị, thời gian công bố và nhận xét đã được chọn công bố.
- Lớp chưa có bản công bố: hiển thị “Giảng viên chưa công bố điểm”.
- Không có chức năng sửa điểm trong luồng mới; không tải cả lớp về trình duyệt rồi lọc.
- Nếu thu hồi: các lần đọc mới không trả điểm đã thu hồi. Dữ liệu sinh viên đã xem trước đó không thể bị thu hồi khỏi ảnh chụp hoặc bản sao cá nhân.

### Mô hình dữ liệu đề xuất

| Bảng | Trường cốt lõi |
| --- | --- |
| GradeComponents | componentId, classId, name, maxScore, weight, order, active |
| GradeDrafts | gradeId, classId, studentId, componentId, value, comment, updatedAt, updatedBy, version |
| GradePublications | publicationId, classId, version, componentIds, status, publishedAt, publishedBy, revokedAt |
| PublishedGradeItems | itemId, publicationId, studentId, componentId, componentName, maxScore, weight, order, value, comment |
| GradePublicationState | classId, activePublicationId, version, updatedAt, updatedBy |
| GradeAudit | auditId, classId, studentId, componentId, actorId, action, beforeValue, afterValue, changedAt |

Snapshot lưu cả tên/thang/trọng số/thứ tự cột để sửa cấu hình bản nháp không làm biến đổi bản công bố cũ. `GradePublicationState` là con trỏ bản đang hiệu lực; chỉ chuyển sau khi snapshot hoàn chỉnh. Mỗi lớp có tối đa một bản đang hiệu lực.

Validate điểm là số hữu hạn trong thang đã cấu hình; phân biệt `0` với chưa nhập. Giữ giá trị chính xác để tính, chỉ làm tròn theo quy tắc đã chốt. Từ chối cập nhật khi version cũ để tránh giảng viên ghi đè thay đổi mới.

## 7. Hợp đồng API dự kiến

Tên dưới đây là đề xuất mới, chưa tồn tại trong hệ thống. Giữ envelope `{ok, data}` / `{ok:false, error}` và cách xử lý lỗi tương thích với client hiện có. Không thêm endpoint công khai bỏ qua xác thực.

| Nhóm | Thao tác | Quyền |
| --- | --- | --- |
| Lớp/lịch | studentListClasses, studentListOccurrences | Sinh viên: chỉ lớp đã ghi danh |
| Đơn nghỉ | submitLeaveRequest, cancelLeaveRequest, listMyLeaveRequests | Sinh viên: chỉ bản thân |
| Duyệt đơn | listClassLeaveRequests, reviewLeaveRequest | Giảng viên: lớp sở hữu |
| Điểm nháp | getGradebook, saveGradeComponents, saveGradeDrafts | Giảng viên: lớp sở hữu |
| Công bố | previewGradePublication, publishGrades, revokeGradePublication | Giảng viên: lớp sở hữu |
| Xem điểm | getMyPublishedGrades | Sinh viên: bản thân, bản đang hiệu lực |

API đọc đơn theo slot nhận định danh buổi học; khi nhận `sessionId`, backend phải xác minh quyền và tự suy ra lớp/ngày/slot. Các API ghi nhận version/idempotency key; identity lấy từ token. Đề xuất lỗi có mã ổn định như `NOT_ENROLLED`, `OCCURRENCE_CHANGED`, `LEAVE_TOO_LATE`, `LEAVE_DUPLICATE`, `VERSION_CONFLICT`, `GRADES_NOT_PUBLISHED`.

Các ghi snapshot, con trỏ công bố và audit phải theo một thiết kế nhất quán: dùng Sheets API batch atomic khi vừa giới hạn payload; nếu cần chia lô, ghi bản ở trạng thái chuẩn bị rồi chỉ kích hoạt khi đủ toàn bộ dữ liệu. Thất bại giữa chừng không được lộ bản công bố thiếu hàng.

## 8. Phân quyền và chuyển đổi dữ liệu cũ

Web hiện dùng teacher allowlist toàn hệ thống; Rules cho giảng viên đọc/ghi rộng và cho sinh viên đọc bản ghi điểm của mình bất kể đã công bố. Vì vậy, **chỉ thêm cờ `published` lên giao diện không đáp ứng yêu cầu mới**.

Lộ trình chuyển đổi:

1. Sao lưu dữ liệu cũ; thống kê học kỳ/lớp/sinh viên và lỗi khớp danh tính. Không sửa file `.fg` gốc.
2. Tạo mapping từ ID Firestore cũ sang `classId`/`studentId` backend; mọi trường hợp thiếu hoặc trùng phải được rà soát trước import.
3. Import điểm cũ vào bản nháp, giữ nguồn import để truy vết; không tự công bố.
4. Chuyển luồng web mới sang API; loại bỏ khả năng tự cập nhật điểm khỏi luồng mới.
5. Khi chuyển sang dùng chính thức, siết Firestore Rules để sinh viên không còn đọc/sửa kho điểm nháp cũ. Tắt hoặc cô lập trang nhập/sửa cũ theo kế hoạch chuyển đổi đã xác nhận.
6. Kiểm tra bằng tài khoản sinh viên qua cả giao diện và truy cập trực tiếp: không đọc được kho cũ lẫn API nháp.

Không thể thu hồi những điểm đã từng được sinh viên xem ở hệ thống cũ. Nếu vẫn vận hành song song web cũ, cần phân biệt rõ dữ liệu cũ với dữ liệu mới; không tuyên bố đã bảo đảm “chỉ xem sau công bố” khi Rules cũ vẫn mở đường đọc cùng dữ liệu đó.

## 9. Các khu vực cần sửa khi triển khai

| Repo | File/khu vực hiện có | Bổ sung dự kiến |
| --- | --- | --- |
| fu-grade-web | src/App.jsx, src/pages/Student.jsx | Điều hướng lớp, xin nghỉ, điểm đã công bố |
| fu-grade-web | src/lib/store.js, src/pages/Admin.jsx, firestore.rules | Kế hoạch chuyển đổi và đóng đường đọc/sửa điểm cũ |
| fu-grade-web | Chưa có | src/lib/api.js, trang đơn nghỉ, lớp học và điểm công bố |
| Desktop | lib/features/schedule/schedule_screen.dart | Điểm vào các module mới theo cấu trúc điều hướng hiện có |
| Desktop | lib/features/attendance/attendance_screen.dart, lib/repositories/attendance_repository.dart | Hiển thị đơn đúng buổi, phối hợp khi chốt phiên |
| Desktop | Chưa có | Model/repository/screen cho leave_requests và grades, demo adapter |
| Backend chung | Code.gs, Lab2Free.gs, ScheduleAttendance.gs, AttendanceSafety.gs | Router/xác thực, truy xuất buổi học cho sinh viên, xử lý chốt phiên nghỉ có phép |
| Backend chung | Chưa có | LeaveRequests.gs, Grades.gs, initializer bảng mới, tests |

Danh sách này là vùng tích hợp, chưa phải diff đã thực hiện. Không thay schema của bảng cũ một cách âm thầm: bộ đọc hiện đối chiếu header chặt chẽ, nên ưu tiên bảng mới và initializer riêng có kiểm tra.

## 10. Thứ tự thực hiện và nghiệm thu

### Đợt 1 — Nền tảng và hợp đồng

- Xác nhận Firebase project và Apps Script deployment dùng chung; rà soát định danh, quyền sở hữu lớp, email sinh viên.
- Thêm bảng và API lớp/buổi học cho sinh viên, tests xác thực/phân quyền; kiểm tra tương thích mobile và desktop.
- Nghiệm thu: sinh viên thấy đúng lớp/lịch, không xem lớp người khác, không cần có điểm hay phiên điểm danh mới xem được lớp.

### Đợt 2 — Xin nghỉ xuyên suốt

- Backend nộp/duyệt/hủy/audit → web sinh viên → desktop danh sách và hiển thị tại slot → phối hợp chốt phiên.
- Nghiệm thu: đơn nộp trước khi tạo phiên vẫn hiện đúng slot; reset phiên không mất đơn; đơn chờ không tự thành `EXCUSED`; lịch đổi/hủy được xử lý rõ ràng.

### Đợt 3 — Điểm và công bố

- Backend nháp/snapshot → desktop nhập tay/xem trước/công bố → web chỉ đọc bản công bố.
- Chuyển đổi dữ liệu cũ và Rules theo lộ trình; import file điểm có thể làm sau luồng nhập tay.
- Nghiệm thu: sửa nháp không đổi điểm đang công bố; sinh viên không đọc được nháp qua API trực tiếp; điểm 0 hiển thị đúng; thu hồi và công bố lại có lịch sử.

### Đợt 4 — Hồi quy và bàn giao

- Chạy tests hiện có của backend chung, desktop và web; bổ sung tests cho quy tắc nghiệp vụ mới.
- Kiểm tra ít nhất hai lớp, hai sinh viên và hai giảng viên để bắt lỗi truy cập chéo; kiểm tra lớp cùng tên ở hai học kỳ.
- Kiểm tra yêu cầu đồng thời, retry mạng, stale version, hết hạn token và công bố bị ngắt giữa chừng.
- Đo tải khi mở slot và tra cứu điểm; dùng refresh có giới hạn, tránh đọc toàn bộ Sheets liên tục.
- Bàn giao hướng dẫn khởi tạo bảng, cấu hình, tạo version deployment, sao lưu và rollback. Chỉ ghi nhận vận hành thật sau khi thử với backend/tài khoản thực tế.

## 11. Những quyết định cần chốt trước lúc code

Các mặc định ở trên đủ để lập kế hoạch; cần thống nhất khi bắt đầu triển khai:

1. Hạn nộp đơn: ngay trước giờ học hay trước một khoảng thời gian cố định? Có cho giảng viên duyệt sau giờ học không?
2. Nghỉ có phép có tính vào tỷ lệ vắng và cách xuất sang FAP như thế nào?
3. Công bố theo lớp/tập cột như đề xuất hay cần công bố riêng từng sinh viên?
4. Thang điểm, trọng số, công thức tổng kết và làm tròn; phạm vi cần hỗ trợ file `.fg`, XLSX/ODS.
5. Firebase project nào được tin cậy và phương án chuyển dữ liệu điểm cũ; web cũ có cần tiếp tục hoạt động song song không?

Ưu tiên khuyến nghị: hoàn thành xin nghỉ xuyên suốt trước, sau đó quản lý và công bố điểm. Hai feature dùng chung định danh/quyền nhưng có thể phát hành theo đợt để kiểm tra dễ hơn.
