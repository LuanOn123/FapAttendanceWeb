import Icon from './Icon.jsx';

export function Brand() {
  return <div className="brand"><span className="brand-mark"><Icon name="school" size={26} /></span><span><strong>FAP Attendance</strong><small>CỔNG SINH VIÊN</small></span></div>;
}
export function PortalShell({ user, onLogout, logoutBusy = false, children }) {
  const name = user.displayName || user.email || 'Sinh viên';
  const initials = name.split(/\s+/).filter(Boolean).map(s => s[0]).slice(-2).join('').toUpperCase();
  return <div className="app">
    <a className="skip-link" href="#main-content">Đến nội dung chính</a>
    <header className="topbar"><div className="topbar-inner"><Brand />
      <div className="user"><span className="avatar" aria-hidden="true">{initials}</span><span className="user-meta"><strong>{user.displayName || 'Tài khoản sinh viên'}</strong><span className="email" title={user.email}>{user.email}</span></span>
        <button className="logout-button" aria-label="Đăng xuất" onClick={onLogout} disabled={logoutBusy}><Icon name="logout" /><span>{logoutBusy ? 'Đang thoát…' : 'Đăng xuất'}</span></button>
      </div>
    </div></header>
    {children}
    <footer className="footer"><span>FAP Attendance <span aria-hidden="true">·</span> Cổng sinh viên</span><span>Chủ động học tập, kết nối cùng giảng viên.</span></footer>
  </div>;
}
export function Notice({ children, kind = 'error' }) {
  return <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}><Icon name={kind === 'success' ? 'check' : 'info'} /><div>{children}</div></div>;
}
export function EmptyState({ icon = 'document', title, children }) {
  return <div className="empty-state"><div className="empty-art" aria-hidden="true"><span className="empty-art-dot"/><Icon name={icon} size={44} /><span className="empty-art-small"><Icon name="clock" size={20} /></span></div><h3>{title}</h3>{children && <p>{children}</p>}</div>;
}
