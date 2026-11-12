import { useCallback, useEffect, useRef, useState } from 'react';
import { portalCall } from '../lib/api.js';
import Icon from '../components/Icon.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { EmptyState, Notice } from '../components/PortalShell.jsx';

export function taskTime(value) {
  return new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function TaskBell({ inbox, active, onClick }) {
  const { unread, rows } = inbox;
  const latest = rows.find(row => !row.readAt);
  const previous = useRef({ unread: 0, createdAt: '', id: '' });
  const [ring, setRing] = useState(0);
  const createdAt = latest?.createdAt || '', id = latest?.id || '';

  useEffect(() => {
    if (unread == null) return;
    const last = previous.current;
    if (unread > last.unread || (unread > 0 && id !== last.id && createdAt > last.createdAt)) {
      setRing(value => value + 1);
    }
    previous.current = { unread, createdAt, id };
  }, [unread, createdAt, id]);

  const hasUnread = unread > 0;
  return <button type="button" className={`task-bell${hasUnread ? ' has-unread' : ''}`}
    aria-label={hasUnread ? `Thông báo giao việc, ${unread} chưa đọc` : 'Thông báo giao việc'}
    title="Thông báo giao việc" aria-pressed={active} onClick={onClick}>
    <Icon key={ring} name="bell" size={22} className={hasUnread && ring ? 'bell-ring' : ''} />
    {hasUnread && <span className="task-bell-count" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
  </button>;
}

// Mounted once for the signed-in student so the badge updates on every class tab.
export function useTaskNotifications(uid) {
  const [state, setState] = useState({ rows: [], unread: null, older: null, loading: true, error: '', readError: '', reading: '' });
  const epoch = useRef(0), fetching = useRef(false), reading = useRef(new Set()), cursor = useRef(null), reconcile = useRef(false);
  const load = useCallback(async ({ previous = false, background = false } = {}) => {
    if (fetching.current || (previous && !cursor.current)) return;
    const generation = epoch.current;
    fetching.current = true;
    if (!background) setState(s => ({ ...s, loading: true, error: '' }));
    try {
      const result = await portalCall('listMyTaskNotifications', previous ? { before: cursor.current } : {});
      if (generation !== epoch.current) return;
      cursor.current = result.older;
      setState(s => ({ ...s, rows: previous ? [...new Map([...s.rows, ...result.notifications].map(n => [n.id, n])).values()] : result.notifications,
        unread: result.unreadCount, older: result.older, loading: false, error: '' }));
    } catch (e) {
      if (generation !== epoch.current) return;
      // Hide cached task bodies when permissions or membership can no longer be verified.
      cursor.current = null;
      setState(s => ({ ...s, rows: [], unread: null, older: null, loading: false, error: e.message }));
    } finally {
      if (generation === epoch.current) {
        fetching.current = false;
        if (reconcile.current) { reconcile.current = false; load({ background: true }); }
      }
    }
  }, []);

  useEffect(() => {
    epoch.current++; fetching.current = false; cursor.current = null; reading.current.clear(); reconcile.current = false;
    setState({ rows: [], unread: null, older: null, loading: true, error: '', readError: '', reading: '' });
    load();
    const refresh = () => { if (!document.hidden) load({ background: true }); };
    const timer = setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);
    return () => { epoch.current++; clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [uid, load]);

  const markRead = async row => {
    if (row.readAt || reading.current.has(row.id)) return;
    reading.current.add(row.id);
    const generation = epoch.current;
    setState(s => ({ ...s, reading: row.id, readError: '' }));
    try {
      const result = await portalCall('readTaskNotification', { notificationId: row.id });
      if (generation !== epoch.current) return;
      // A confirmed server acknowledgement is required, never infer read from listing.
      setState(s => {
        const unread = s.rows.some(n => n.id === row.id && !n.readAt);
        return { ...s, rows: s.rows.map(n => n.id === row.id ? { ...n, readAt: result.readAt || 'confirmed' } : n),
          unread: unread && s.unread != null ? Math.max(0, s.unread - 1) : s.unread };
      });
      // Reconcile a concurrent poll that might have returned a pre-acknowledgement snapshot.
      if (fetching.current) reconcile.current = true;
      else load({ background: true });
    } catch (e) {
      if (generation === epoch.current) setState(s => ['GROUP_ACCESS_DENIED', 'NOT_ENROLLED', 'UNAUTHENTICATED'].includes(e.code)
        ? { ...s, rows: [], unread: null, error: e.message }
        : { ...s, readError: 'Chưa lưu trạng thái đã đọc. Mở lại công việc để thử lại.' });
    } finally {
      if (generation === epoch.current) { reading.current.delete(row.id); setState(s => ({ ...s, reading: '' })); }
    }
  };
  return { ...state, load, markRead };
}

export default function TaskNotifications({ inbox }) {
  const [opened, setOpened] = useState(''), [onlyUnread, setOnlyUnread] = useState(false);
  const active = inbox.rows.find(n => n.id === opened);
  const rows = inbox.rows.filter(n => !onlyUnread || !n.readAt || n.id === opened);
  return <section className="card task-notifications" aria-label="Thông báo giao việc">
    <header className="card-heading"><div><span className="eyebrow">TỪ GIẢNG VIÊN</span><h2>Việc được giao <span className="count-badge">{inbox.unread == null ? '—' : inbox.unread} chưa đọc</span></h2></div>
      <button className="refresh-button" disabled={inbox.loading} onClick={() => inbox.load()}><Icon name="refresh" /><span>Tải lại thông báo</span></button></header>
    <p className="muted">Tất cả lớp · Cập nhật mỗi 30 giây khi trang đang mở · Giờ Việt Nam</p>
    <div className="task-filters" aria-label="Lọc thông báo"><button aria-pressed={!onlyUnread} onClick={() => setOnlyUnread(false)}>Tất cả</button><button aria-pressed={onlyUnread} onClick={() => setOnlyUnread(true)}>Chưa đọc</button></div>
    {inbox.error && <Notice>{inbox.error}</Notice>}
    {inbox.readError && <Notice>{inbox.readError}</Notice>}
    {inbox.loading && !inbox.rows.length ? <Skeleton label="Đang tải thông báo…" /> : !inbox.error && !rows.length ? <EmptyState icon="document" title={onlyUnread ? 'Không có thông báo chưa đọc' : 'Chưa có việc được giao'}>Khi giảng viên giao việc cho nhóm của bạn, thông báo sẽ xuất hiện tại đây và email trường được xếp hàng gửi.</EmptyState> : rows.map(n => <article key={n.id} className={`task-notification ${n.readAt ? 'is-read' : 'is-unread'}`}>
      <div className="task-notification-meta"><span className="term-badge">{n.task.groupName}</span><span>{[n.task.subjectCode, n.task.classCode].filter(Boolean).join(' · ')}</span><span>{n.readAt ? 'Đã đọc' : 'Chưa đọc'}</span><time dateTime={n.createdAt}>{taskTime(n.createdAt)}</time></div>
      <button className="task-open" aria-expanded={opened === n.id} aria-controls={`task-${n.id}`} onClick={() => { setOpened(n.id); inbox.markRead(n); }}><h3>{n.task.title}</h3><Icon name="chevron" /></button>
      <p className="task-deadline"><Icon name="clock" size={16} />Hạn: {taskTime(n.task.dueAt)}</p>
      {active?.id === n.id && <div id={`task-${n.id}`} className="task-body"><p className="preserve-text">{n.task.description}</p>
        {inbox.reading === n.id && <small role="status">Đang lưu trạng thái đã đọc…</small>}
        <button className="text-button" onClick={() => setOpened('')}>Thu gọn</button></div>}
    </article>)}
    {inbox.older && <button className="refresh-button" disabled={inbox.loading} onClick={() => inbox.load({ previous: true })}>{inbox.loading ? 'Đang tải…' : 'Thông báo cũ hơn'}</button>}
  </section>;
}
