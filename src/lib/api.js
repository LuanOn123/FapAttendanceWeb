import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from '../firebase.js';

export const portalEndpoint = import.meta.env.VITE_FIREBASE_SHARED_API_URL || 'https://asia-southeast1-fap-attendance-88920.cloudfunctions.net/sharedApi';
const messages = {
  PROFILE_NOT_REGISTERED: 'Email chưa có trong danh sách sinh viên. Liên hệ giảng viên cập nhật danh sách lớp.',
  SHARED_BACKEND_SETUP_REQUIRED: 'Backend chưa được cấu hình cho cổng sinh viên.',
  NOT_ENROLLED: 'Bạn chưa được ghi danh vào lớp này.',
  PERMISSION_DENIED: 'Bạn không có quyền thực hiện thao tác này.',
  UNAUTHENTICATED: 'Phiên đăng nhập hết hạn. Hãy đăng nhập lại.',
  EMAIL_NOT_VERIFIED: 'Tài khoản cần xác minh email.',
  LEAVE_TOO_LATE: 'Đã đến giờ học hoặc đơn không còn được phép hủy.',
  LEAVE_DUPLICATE: 'Bạn đã có đơn chờ duyệt hoặc được duyệt cho buổi học này.',
  OCCURRENCE_CHANGED: 'Lịch học đã thay đổi. Hãy tải lại danh sách buổi học.',
  VERSION_CONFLICT: 'Dữ liệu đã thay đổi. Hãy tải lại trước khi thao tác.',
  RATE_LIMITED: 'Bạn thao tác quá nhanh. Hãy chờ một lát rồi thử lại.',
  INVALID_REASON: 'Lý do xin nghỉ cần từ 10 đến 1000 ký tự.',
  GROUP_ACCESS_DENIED: 'Bạn không còn thuộc nhóm này. Hãy tải lại nhóm.',
  GROUP_TASKS_SETUP_REQUIRED: 'Giảng viên cần cập nhật backend để bật thông báo giao việc.',
  INVALID_CURSOR: 'Danh sách đã thay đổi. Hãy tải lại thông báo.',
  GROUP_FILES_NOT_CONFIGURED: 'Giảng viên cần cấu hình thư mục tệp nhóm trên backend.',
  GROUP_FOLDER_MUST_BE_PRIVATE: 'Thư mục tệp nhóm phải được đặt riêng tư.',
  FILE_TOO_LARGE: 'Tệp đính kèm tối đa 500 KB.',
  INVALID_FILE: 'Tệp đính kèm không hợp lệ hoặc không được hỗ trợ.',
  INVALID_MESSAGE: 'Tin nhắn cần nội dung hoặc tệp, tối đa 2000 ký tự.',
  GROUP_PUSH_SETUP_REQUIRED: 'Quản trị viên chưa bật Firebase Messaging cho chat nhóm.',
};

export async function portalCall(method, data = {}) {
  if (portalEndpoint !== 'https://asia-southeast1-fap-attendance-88920.cloudfunctions.net/sharedApi') throw new Error('Cấu hình Firebase API chưa hợp lệ.');
  const user = auth.currentUser;
  if (!user) throw new Error(messages.UNAUTHENTICATED);
  const idToken = await user.getIdToken();
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(portalEndpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
      body: JSON.stringify({ action: 'portalCall', firebaseAuth: true, method, data }),
      signal: controller.signal, redirect: 'error', credentials: 'omit',
    });
    if (!response.ok) throw new Error('Không kết nối được máy chủ. Hãy thử lại.');
    const result = await response.json();
    if (result.ok !== true) {
      const error = new Error(messages[result.error] || result.error || 'Yêu cầu thất bại.');
      error.code = result.error;
      throw error;
    }
    return result.data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Máy chủ phản hồi chậm. Hãy tải lại để kiểm tra kết quả trước khi gửi lại.');
    throw e;
  } finally { clearTimeout(timeout); }
}
export async function firebaseGroupSignup(data) {
  const signup = httpsCallable(getFunctions(auth.app, 'asia-southeast1'), 'sharedGroupSignup', { timeout: 35000 });
  try {
    return (await signup(data)).data;
  } catch (cause) {
    const code = cause.details?.code || cause.message;
    const signupMessages = {
      GROUP_SIGNUP_NOT_OPEN: 'Đợt đăng ký nhóm đã kết thúc. Hãy tải lại.',
      INVALID_GROUPS: 'Nhóm này đã thay đổi. Hãy tải lại.',
      SERVER_ERROR: 'Chưa xác nhận được lựa chọn. Hãy tải lại để kiểm tra.',
    };
    const error = new Error(messages[code] || signupMessages[code] || 'Chưa tải được đăng ký nhóm. Hãy thử lại.');
    error.code = code;
    throw error;
  }
}
export const leaveStatuses = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', CANCELLED: 'Đã hủy' };
export function vietnamDate() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
