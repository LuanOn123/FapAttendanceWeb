import { useEffect, useRef, useState } from 'react';
import { leaveStatuses, portalCall, portalEndpoint, vietnamDate } from '../lib/api.js';
import Icon from '../components/Icon.jsx';
import StudyGroups from './StudyGroups.jsx';
import TaskNotifications, { TaskBell, useTaskNotifications } from './TaskNotifications.jsx';
import Skeleton from '../components/Skeleton.jsx';
import GradeForecast from './GradeForecast.jsx';
import { EmptyState, Notice, PortalShell } from '../components/PortalShell.jsx';
import { enableGroupPush, groupPushConfigured, wantsGroupPush } from '../lib/groupPush.js';

const localTime = value => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
const classViews = [
  { id: 'grades', icon: 'book', label: 'Điểm đã công bố' },
  { id: 'leave', icon: 'calendar', label: 'Xin nghỉ' },
  { id: 'forecast', icon: 'spark', label: 'Tính điểm FE/PE' },
];

export default function Student({ user, onLogout, logoutBusy, logoutError }) {
  const [chatClass, setChatClass] = useState(() => new URLSearchParams(window.location.search).get('chatClass'));
  const [classes, setClasses] = useState([]), [selected, setSelected] = useState(chatClass || '');
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [tab, setTab] = useState('grades'), [revision, setRevision] = useState(0);
  const [showTasks, setShowTasks] = useState(() => window.location.hash === '#tasks');
  const [chatPush, setChatPush] = useState(''), [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    if (!wantsGroupPush(user.uid)) return;
    let live = true;
    enableGroupPush(user.uid).then(() => { if (live) setChatPush('Đã bật thông báo chat'); }).catch(() => {});
    return () => { live = false; };
  }, [user.uid]);
  async function requestChatPush() {
    setPushBusy(true);
    try {
      await enableGroupPush(user.uid, { ask: true });
      setChatPush('Đã bật thông báo chat');
    } catch (e) { setChatPush(e.message); }
    finally { setPushBusy(false); }
  }
  const inbox = useTaskNotifications(user.uid);
  const selectTab = value => {
    if (value !== 'tasks') setTab(value);
    setShowTasks(value === 'tasks');
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${value === 'tasks' ? '#tasks' : ''}`);
  };
  useEffect(() => {
    const openTasks = () => { if (window.location.hash === '#tasks') setShowTasks(true); };
    window.addEventListener('hashchange', openTasks);
    return () => window.removeEventListener('hashchange', openTasks);
  }, []);
  useEffect(() => {
    let live = true; setLoading(true); setError('');
    portalCall('listClasses').then(rows => {
      if (live) { setClasses(rows); setSelected(current => rows.some(r => r.classId === current) ? current : rows[0]?.classId || ''); }
    }).catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [user.uid, revision]);
  const cls = classes.find(c => c.classId === selected);
  const classKey = `${user.uid}/${selected}`;
  return <PortalShell user={user} onLogout={onLogout} logoutBusy={logoutBusy}
    headerAction={<TaskBell inbox={inbox} active={showTasks} onClick={() => selectTab(showTasks ? tab : 'tasks')} />}>
    <main className="wrap" id="main-content">
      {logoutError && <Notice>{logoutError}</Notice>}
      <section className="page-intro student-intro"><div><span className="eyebrow">CỔNG SINH VIÊN</span><h1>Không gian học tập</h1><p>Xem điểm, gửi đơn xin nghỉ và theo dõi thông báo.</p></div>
        <div className="class-stat"><span className="stat-icon"><Icon name="layers" size={25} /></span><div><strong>{loading ? '—' : error && !classes.length ? '—' : String(classes.length).padStart(2, '0')}</strong><span>Lớp học của bạn</span></div></div>
      </section>
      {!portalEndpoint && <Notice>Quản trị viên cần kết nối cổng sinh viên với backend chung trước khi sử dụng.</Notice>}
      <div className="student-layout">
        <nav className="card student-sidebar" aria-label="Thông tin lớp học">
          <span className="eyebrow">LỚP HỌC</span>
          {classViews.map(({ id, icon, label }) => <button key={id} type="button" className="tab"
            aria-pressed={!showTasks && tab === id} onClick={() => selectTab(id)}>
            <Icon name={icon} /><span>{label}</span>
          </button>)}
        </nav>
        <div className="student-content">
          {showTasks ? <TaskNotifications inbox={inbox} /> : <>
            {error && <Notice><strong>Chưa tải được lớp học</strong><p>{error}</p></Notice>}
            <section className="card class-picker"><div className="class-picker-label"><span className="feature-icon"><Icon name="school" size={24} /></span><div><label htmlFor="class-select">Lớp học</label><p>Chọn lớp để xem thông tin</p></div></div>
              {classes.length > 0 ? <select id="class-select" value={selected} disabled={loading} onChange={e => { setChatClass(null); setSelected(e.target.value); }}>{classes.map(c => <option key={c.classId} value={c.classId}>{c.subjectCode} · {c.classCode} · {c.semester}</option>)}</select> : <span className="muted picker-placeholder">{loading ? 'Đang tải danh sách lớp…' : 'Chưa có dữ liệu lớp'}</span>}
              <button onClick={() => setRevision(r => r + 1)} disabled={loading} className="refresh-button"><Icon name="refresh" className={loading ? 'spin' : ''} /><span>Tải lại lớp</span></button>
            </section>
            {loading && <section className="card"><Skeleton label="Đang tải lớp học…"/></section>}
            {!loading && !error && !cls && <section className="card"><EmptyState icon="school" title="Lớp học của bạn sẽ xuất hiện tại đây">Chưa có lớp học. Hãy nhờ giảng viên kiểm tra email và danh sách lớp của bạn.</EmptyState></section>}
            {!loading && cls && <>
              <div className="student-class-context"><span className="class-context"><span className="term-badge">{cls.semester}</span>{cls.classCode}</span></div>
              {tab === 'grades' && <PublishedGrades key={classKey} classId={selected} />}
              {tab === 'leave' && <LeaveRequests key={classKey} classId={selected} />}
              {tab === 'forecast' && <GradeForecast key={classKey} />}
            </>}
          </>}
        </div>
      </div>
      {cls && <GroupChat key={classKey} classId={selected} startOpen={chatClass === selected}
        pushAction={groupPushConfigured ? <div className="chat-toolbar">
          <span role="status">{chatPush}</span>
          {chatPush !== 'Đã bật thông báo chat' && <button type="button" onClick={requestChatPush} disabled={pushBusy}>Bật thông báo chat</button>}
        </div> : null} />}
    </main>
  </PortalShell>;
}

function GroupChat({ classId, startOpen, pushAction }) {
  const [open, setOpen] = useState(startOpen), [started, setStarted] = useState(startOpen);
  const panel = useRef(null), launcher = useRef(null);
  useEffect(() => { if (open) panel.current?.focus(); }, [open]);

  function close() {
    setOpen(false);
    launcher.current?.focus();
  }

  return <div className="group-chat-widget">
    <div id="group-chat-panel" className="group-chat-panel" ref={panel} hidden={!open}
      role="dialog" aria-label="Chat nhóm học tập" tabIndex={-1}
      onKeyDown={event => { if (event.key === 'Escape') close(); }}>
      {started && <StudyGroups classId={classId} visible={open} onClose={close} pushAction={pushAction} />}
    </div>
    <button type="button" className="group-chat-launcher" ref={launcher}
      title={open ? 'Thu gọn chat nhóm' : 'Mở chat nhóm học tập'}
      aria-label={open ? 'Thu gọn chat nhóm' : 'Mở chat nhóm học tập'} aria-expanded={open} aria-controls="group-chat-panel"
      onClick={() => { if (open) close(); else { setStarted(true); setOpen(true); } }}>
      <Icon name={open ? 'chevron' : 'chat'} size={25} />
    </button>
  </div>;
}

function PublishedGrades({ classId }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true; setData(null); setError('');
    portalCall('getMyPublishedGrades', { classId }).then(r => { if (live) setData(r); }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [classId, revision]);
  return <div className="content-grid"><section className="card grade-card"><div className="card-heading"><div><span className="eyebrow">KẾT QUẢ HỌC TẬP</span><h2>Điểm của tôi</h2></div><button className="refresh-button" onClick={() => setRevision(r => r + 1)}><Icon name="refresh" /><span>Tải lại điểm</span></button></div>
    {error ? <Notice>{error}</Notice> : !data ? <Skeleton kind="grades" label="Đang tải điểm…"/> : !data.published ? <EmptyState icon="book" title="Giảng viên chưa công bố điểm.">Kết quả học tập sẽ xuất hiện tại đây khi giảng viên công bố. Bạn có thể quay lại hoặc tải lại điểm sau.</EmptyState> : <>
      <div className="publication-meta"><span className="status-badge approved"><Icon name="check" size={14} />Đã công bố</span><span><Icon name="clock" size={15} />{localTime(data.publishedAt)}</span><small>Phiên bản {data.version}</small></div>
      <div className="table-scroll"><table className="grades"><thead><tr><th>Cột điểm</th><th>Điểm</th><th>Thang điểm</th></tr></thead><tbody>{data.components.map(c => {
        const missing = data.grades[c.id] === '' || data.grades[c.id] == null;
        return <tr key={c.id}><td><div className="component-name"><span><Icon name="document" size={18} /></span>{c.name}</div></td><td><span className={missing ? 'grade-number missing-grade' : 'grade-number'}>{missing ? '—' : data.grades[c.id]}</span></td><td className="grade-scale">{c.maxScore}</td></tr>;
      })}</tbody></table></div>
      {data.comment && <div className="teacher-comment"><Icon name="document" /><div><h3>Nhận xét của giảng viên</h3><p className="preserve-text">{data.comment}</p></div></div>}
      <div className="table-footnote"><Icon name="shield" size={16} /><span>Điểm được hiển thị theo bản công bố của giảng viên.</span></div>
    </>}
  </section><aside className="side-column"><section className="card guidance-card"><span className="guidance-icon"><Icon name="shield" size={24} /></span><h2>Thông tin dành riêng cho bạn</h2><p>Bạn chỉ xem kết quả của tài khoản đang đăng nhập.</p><div className="guidance-divider"/><div className="info-row"><Icon name="check" /><div><strong>Điểm đã được công bố</strong><p>Điểm nháp của giảng viên chưa hiển thị tại đây.</p></div></div><div className="info-row"><Icon name="refresh" /><div><strong>Cập nhật khi cần</strong><p>Bấm tải lại để nhận bản công bố mới nhất.</p></div></div></section>
    <div className="soft-note"><Icon name="info" size={22} /><div><strong>Cần trao đổi về điểm?</strong><p>Liên hệ giảng viên phụ trách để được kiểm tra và giải đáp.</p></div></div>
  </aside></div>;
}

function LeaveRequests({ classId }) {
  const [date, setDate] = useState(vietnamDate), [occurrences, setOccurrences] = useState([]), [occurrenceId, setOccurrenceId] = useState('');
  const [reason, setReason] = useState(''), [requests, setRequests] = useState([]), [revision, setRevision] = useState(0);
  const [error, setError] = useState(''), [success, setSuccess] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const requestKey = useRef(null);
  useEffect(() => {
    let live = true; setLoading(true); setError(''); setOccurrences([]); setOccurrenceId('');
    Promise.all([date ? portalCall('listOccurrences', { classId, date }) : Promise.resolve([]), portalCall('listMyLeaveRequests')]).then(([slots, rows]) => {
      if (live) { setOccurrences(slots); setOccurrenceId(slots[0]?.occurrenceId || ''); setRequests(rows.filter(r => r.classId === classId)); }
    }).catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [classId, date, revision]);
  const submit = async e => {
    e.preventDefault(); if (busy) return; setBusy(true); setError(''); setSuccess('');
    try {
      if (!occurrences.some(o => o.occurrenceId === occurrenceId)) throw new Error('Hãy chọn buổi học hợp lệ.');
      requestKey.current ||= crypto.randomUUID();
      await portalCall('submitLeaveRequest', { classId, sessionDate: date, occurrenceId, reason, requestKey: requestKey.current });
      requestKey.current = null; setReason(''); setSuccess('Đã gửi đơn. Vui lòng chờ giảng viên duyệt.'); setRevision(r => r + 1);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const cancel = async r => {
    setBusy(true); setError(''); setSuccess('');
    try { await portalCall('cancelLeaveRequest', { id: r.id, version: r.version }); setSuccess('Đã hủy đơn.'); setRevision(r => r + 1); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <><div className="content-grid leave-grid"><section className="card request-card"><div className="card-heading"><div><span className="eyebrow">CHỦ ĐỘNG SẮP XẾP LỊCH HỌC</span><h2>Gửi đơn xin nghỉ</h2></div><span className="heading-icon"><Icon name="calendar" size={26} /></span></div><p className="card-description">Gửi trước giờ học để giảng viên có thể xem xét yêu cầu của bạn.</p>
    <form onSubmit={submit}><div className="form-grid"><div className="field"><label htmlFor="leave-date">Ngày học</label><input id="leave-date" type="date" required min={vietnamDate()} value={date} disabled={busy} onChange={e => { setDate(e.target.value); requestKey.current = null; }} /></div>
      <div className="field"><label htmlFor="leave-occurrence">Buổi học</label><select id="leave-occurrence" value={occurrenceId} required disabled={busy || loading} onChange={e => { setOccurrenceId(e.target.value); requestKey.current = null; }}>
        {!occurrences.length && <option value="">Không có buổi học có thể xin nghỉ</option>}{occurrences.map(o => <option key={o.occurrenceId} value={o.occurrenceId}>Slot {o.slot} · {o.scheduledStartTime}–{o.scheduledEndTime}{o.room ? ` · ${o.room}` : ''}</option>)}
      </select></div></div>
      <div className="field reason-field"><div className="field-heading"><label htmlFor="leave-reason">Lý do xin nghỉ</label><span className="character-count">{reason.length}/1000</span></div><textarea id="leave-reason" aria-describedby="reason-help" required minLength={10} maxLength={1000} rows={5} value={reason} disabled={busy} placeholder="Chia sẻ lý do xin nghỉ để giảng viên xem xét…" onChange={e => { setReason(e.target.value); requestKey.current = null; }} /><small id="reason-help">Nhập ít nhất 10 ký tự. Bạn có thể nêu thêm thông tin cần thiết cho giảng viên.</small></div>
      {error && <Notice>{error}</Notice>}{success && <Notice kind="success">{success}</Notice>}
      <div className="form-footer"><span><Icon name="clock" size={17} />Đơn sẽ được gửi ở trạng thái chờ duyệt.</span><button className="primary" disabled={busy || loading || !occurrenceId || reason.trim().length < 10}><Icon name="send" />{busy ? 'Đang xử lý…' : 'Gửi đơn xin nghỉ'}</button></div>
    </form>
  </section><aside className="side-column"><section className="card guidance-card"><span className="guidance-icon"><Icon name="calendar" size={24} /></span><h2>Một vài bước đơn giản</h2><ol className="request-steps"><li><span>01</span><div><strong>Chọn đúng buổi học</strong><p>Kiểm tra ngày, slot và giờ trước khi gửi đơn.</p></div></li><li><span>02</span><div><strong>Chia sẻ lý do</strong><p>Trình bày rõ ràng để giảng viên xem xét.</p></div></li><li><span>03</span><div><strong>Theo dõi kết quả</strong><p>Xem trạng thái và phản hồi ngay bên dưới.</p></div></li></ol></section><div className="soft-note"><Icon name="info" size={22} /><div><strong>Gửi đơn trước giờ học</strong><p>Chỉ đơn được giảng viên duyệt mới được xem xét là nghỉ có phép.</p></div></div></aside></div>
    <section className="card history-card"><div className="card-heading"><div><span className="eyebrow">YÊU CẦU CỦA BẠN</span><h2>Lịch sử đơn {!loading && !error && <span className="count-badge">{requests.length}</span>}</h2></div><button className="refresh-button" disabled={busy || loading} onClick={() => setRevision(r => r + 1)}><Icon name="refresh" className={loading ? 'spin' : ''} /><span>Tải lại đơn</span></button></div>
      {loading ? <Skeleton label="Đang tải lịch sử đơn…"/> : !requests.length ? <EmptyState icon="calendar" title={error ? 'Chưa tải được lịch sử đơn' : 'Bạn chưa gửi đơn cho lớp này.'}>{error ? 'Vui lòng tải lại để kiểm tra các yêu cầu đã gửi.' : 'Các đơn xin nghỉ và phản hồi của giảng viên sẽ được lưu tại đây.'}</EmptyState> : requests.slice().sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map(r => <article className="leave-item" key={r.id}>
        <div className="date-tile" aria-hidden="true"><span>THG {Number(r.sessionDate.slice(5, 7))}</span><strong>{r.sessionDate.slice(8, 10)}</strong></div>
        <div className="leave-details"><div className="leave-title"><h3>{r.sessionDate} <span>· Slot {r.slot}</span></h3><span className={`status-badge ${r.status.toLowerCase()}`}><i aria-hidden="true" />{leaveStatuses[r.status] || r.status}</span></div><div className="leave-time"><Icon name="clock" size={15} />{r.startTime}–{r.endTime}</div>
          <p className="preserve-text leave-reason">{r.reason}</p>
          {r.scheduleChanged && <Notice>Lịch đã thay đổi. Liên hệ giảng viên để kiểm tra lại đơn.</Notice>}
          {r.reviewNote && <div className="review-note"><Icon name="document" size={17} /><div><strong>Phản hồi từ giảng viên</strong><p className="preserve-text">{r.reviewNote}</p></div></div>}
          <div className="leave-bottom"><small>Gửi lúc {localTime(r.submittedAt)}</small>{r.status === 'PENDING' && <button className="cancel-button" disabled={busy || Date.now() >= Date.parse(`${r.sessionDate}T${r.startTime}:00+07:00`)} onClick={() => cancel(r)}>Hủy đơn</button>}</div>
        </div>
      </article>)}
    </section>
  </>;
}
