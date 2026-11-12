import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from './firebase.js';
import Student from './pages/Student.jsx';
import Icon, { GoogleIcon } from './components/Icon.jsx';
import { Brand, Notice } from './components/PortalShell.jsx';
import { PortalSkeleton } from './components/Skeleton.jsx';
import { disableGroupPush, groupPushConfigured } from './lib/groupPush.js';

export default function App() {
  const [user, setUser] = useState(undefined), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => onAuthStateChanged(auth, next => { setUser(next); setError(''); }), []);
  async function login() {
    setError(''); setBusy(true);
    try { await signInWithPopup(auth, googleProvider); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function logout() {
    setError(''); setBusy(true);
    try {
      if (groupPushConfigured && user) {
        let timeout;
        try {
          await Promise.race([
            disableGroupPush(user.uid).catch(() => {}),
            new Promise(resolve => { timeout = setTimeout(resolve, 3500); }),
          ]);
        } finally { clearTimeout(timeout); }
      }
      await signOut(auth);
    } catch { setError('Chưa đăng xuất được. Vui lòng thử lại.'); } finally { setBusy(false); }
  }
  if (user === undefined) return <PortalSkeleton />;
  if (!user) return <div className="login-page">
    <div className="login-top"><Brand /><span className="login-top-label">Không gian dành cho sinh viên</span></div>
    <main className="login-layout">
      <section className="login-intro"><span className="eyebrow">CHỦ ĐỘNG TRONG MỖI BUỔI HỌC</span><h1>Điểm số rõ ràng.<br /><span>Xin nghỉ thuận tiện.</span></h1>
        <p>Xem kết quả học tập và gửi lời nhắn xin nghỉ đến giảng viên. Mọi thông tin cần thiết, trong cùng một không gian.</p>
        <div className="login-features"><div><span className="feature-icon"><Icon name="book" size={24} /></span><span><strong>Theo dõi điểm của bạn</strong><small>Cập nhật khi giảng viên công bố.</small></span></div><div><span className="feature-icon"><Icon name="calendar" size={24} /></span><span><strong>Chủ động xin nghỉ trước</strong><small>Gửi đơn và theo dõi kết quả xét duyệt.</small></span></div></div>
        <div className="login-note"><span className="note-dots" aria-hidden="true"><i/><i/><i/></span><span>Kết nối cùng giảng viên, theo cách đơn giản hơn.</span></div>
      </section>
      <section className="card login-card"><span className="login-card-icon"><Icon name="school" size={30} /></span><span className="eyebrow">CHÀO MỪNG BẠN TRỞ LẠI</span><h2>Đăng nhập để tiếp tục</h2><p>Dùng email Google đã được giảng viên đăng ký trong danh sách lớp.</p>
        <button className="primary google-button" onClick={login} disabled={busy}><span className="google-mark"><GoogleIcon /></span>{busy ? 'Đang đăng nhập…' : 'Đăng nhập với Google'}<Icon name="arrow" /></button>
        {error && <Notice>{error}</Notice>}
        <div className="login-privacy"><Icon name="shield" size={22} /><span><strong>Thông tin dành riêng cho bạn</strong><small>Đăng nhập để xem điểm và quản lý đơn của chính mình.</small></span></div>
        <p className="login-help">Chưa thấy lớp sau khi đăng nhập? Hãy nhờ giảng viên kiểm tra email trong danh sách lớp.</p>
      </section>
    </main><footer className="login-footer">FAP Attendance <span>·</span> Đồng hành cùng mỗi buổi học</footer>
  </div>;
  return <Student key={user.uid} user={user} onLogout={logout} logoutBusy={busy} logoutError={error} />;
}
