# Chat và skeleton - 02/11/2026

UI mới có bubble trái/phải, avatar, chia ngày, giờ Việt Nam, số người nhận/xem và giờ xác nhận, file preview/bỏ tệp, Enter gửi, Shift+Enter xuống dòng. Skeleton theo request ở bootstrap, lớp, điểm, xin nghỉ và nhóm/chat; hỗ trợ reduced motion. Poll 10 giây, không dùng socket.

## Cập nhật bản đã deploy

1. Giải nén `C:/PRM/lecture_mobile/artifacts/lab3-chat-receipts-backend-2026-11-02.zip`, đồng bộ các file vào Apps Script hiện tại.
2. Chạy `setupStudyGroups()` để bổ sung `PortalGroupReceipts`. Không xóa sheet cũ.
3. Deploy > Manage deployments > Edit > New version > Deploy, giữ URL hiện tại.
4. PowerShell:

```powershell
cd C:\PRM\fu-grade-web
npm run deploy
```

Script chỉ deploy target `student` của project `fap-attendance-88920`, map site `fap-sinhvien`. Không deploy site QR mặc định.

## Nghiệm thu với hai tài khoản test

- Cùng nhóm: A gửi, B tải tin -> A thấy số người nhận; B cuộn tới tin và focus -> A thấy số người xem cùng giờ server.
- Khi B ẩn tab hoặc chưa cuộn tới tin, không tự ghi đã xem. Mobile/desktop cũ chưa phát read receipt, không suy ra đã xem từ tên thành viên.
- Mất mạng khi gửi: giữ bản gửi chưa xác định; thử lại giữ cùng request key để không nhân đôi.
- Tải nhóm lỗi: skeleton kết thúc, có báo lỗi và thử lại; khi mất quyền nhóm, nội dung cũ được xóa khỏi màn hình.
- Kiểm màn hình điện thoại, tệp rỗng/quá 500 KB, bàn phím tiếng Việt và Shift+Enter.

Kết quả local: 13 UI + 4 migration tests pass; Vite production build pass. Ảnh `.visual-qa/chat-desktop-lab3.png` và `.visual-qa/chat-mobile-lab3.png` dùng dữ liệu mẫu, không là bằng chứng cloud. Bản Hosting và Apps Script chưa được publish trong đợt cải tiến này.
