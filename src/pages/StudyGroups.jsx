import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { portalCall, firebaseGroupSignup } from '../lib/api.js';
import { EmptyState, Notice } from '../components/PortalShell.jsx';
import Skeleton from '../components/Skeleton.jsx';
import Icon from '../components/Icon.jsx';
import { chatTime, chatDate, initials, mergeMessages, messageStatus, visibleMessageRect } from '../lib/chat.js';

const useFirebaseSignup = import.meta.env.VITE_FIREBASE_GROUP_SIGNUP === 'true';

const fetchGroupPlan = classId => useFirebaseSignup
  ? firebaseGroupSignup({ action: 'plan', classId })
  : portalCall('getGroupPlan', { classId });

const accessDenied = error => ['GROUP_ACCESS_DENIED', 'NOT_ENROLLED', 'UNAUTHENTICATED', 'PERMISSION_DENIED'].includes(error.code)
  || /không còn thuộc nhóm này|chưa được ghi danh|Phiên đăng nhập hết hạn/.test(error.message);

function validatePlan(plan) {
  if (!Array.isArray(plan?.groups) || !Array.isArray(plan?.students)) throw Error('Máy chủ trả danh sách nhóm không hợp lệ.');
  return plan;
}

export default function StudyGroups({ classId, visible = true, onClose, pushAction }) {
  const [plan,setPlan]=useState(null),[groupId,setGroupId]=useState(''),[messages,setMessages]=useState([]),[loadingPlan,setLoadingPlan]=useState(true),[loadingChat,setLoadingChat]=useState(false);
  const [text,setText]=useState(''),[file,setFile]=useState(null),[error,setError]=useState(''),[sending,setSending]=useState(false),[reading,setReading]=useState(false),[downloadId,setDownloadId]=useState(''),[older,setOlder]=useState(null),[paging,setPaging]=useState(false),[outbox,setOutbox]=useState(null),[showMembers,setShowMembers]=useState(false),[newCount,setNewCount]=useState(0),[syncError,setSyncError]=useState('');
  const pending=useRef(null),viewport=useRef(null),input=useRef(null),generation=useRef(0),nearBottom=useRef(true),tracking=useRef(false),readIds=useRef(new Set()),acknowledged=useRef(new Set()),ackBusy=useRef(false),refreshChat=useRef(null);
  const knownIds=useRef(new Set());
  const [signup,setSignup]=useState(null);
  const signupRequest=useRef(0);
  const [choosingGroup, setChoosingGroup] = useState(false);
  const [signupError, setSignupError] = useState('');
  const fileReader=useRef(null);
  const [membershipChange,setMembershipChange]=useState('');
  const blocked=useRef(false), latest=useRef(null);
  const adoptPlan=useCallback(next=>{
    generation.current++;
    blocked.current=false;
    tracking.current=false;
    nearBottom.current=true;
    setMembershipChange('');
    setMessages([]);
    setShowMembers(false);
    setOlder(null);
    setNewCount(0);
    setPaging(false);
    setDownloadId('');
    setSyncError('');
    setError('');
    setPlan(next);
    setGroupId(next.groups[0]?.id||'');
  },[]);
  const suspendChat=useCallback(reason=>{
    blocked.current=true;
    tracking.current=false;
    setMessages([]);
    setShowMembers(false);
    setMembershipChange(reason);
  },[]);
  const loadSignup=useCallback(async()=>{
    const request=++signupRequest.current;
    try {
      const next = useFirebaseSignup
        ? await firebaseGroupSignup({ action: 'status', classId })
        : await portalCall('getGroupSignupSheet', { classId });
      if(request===signupRequest.current)setSignup(next);
    }catch { /* Keep the last known registration state until the next refresh. */ }
  },[classId]);
  const loadPlan=useCallback(async()=>{
    const epoch=++generation.current;blocked.current=true;pending.current=null;setMembershipChange('');setSending(false);fileReader.current?.abort();fileReader.current=null;setReading(false);setFile(null);setText('');if(input.current)input.current.value='';setLoadingPlan(true);setError('');setMessages([]);setPlan(null);setGroupId('');setOutbox(null);setSignup(null);tracking.current=false;
    loadSignup();
    try { const p=validatePlan(await fetchGroupPlan(classId));if(epoch!==generation.current)return;blocked.current=false;setSyncError('');setShowMembers(false);setDownloadId('');setPaging(false);setPlan(p);setGroupId(p.groups[0]?.id||''); }
    catch(e){if(epoch===generation.current)setError(e.message);}finally{if(epoch===generation.current)setLoadingPlan(false);}
  },[classId,loadSignup]);
  useEffect(()=>{setSignupError('');loadPlan();return()=>{generation.current++;signupRequest.current++;fileReader.current?.abort();fileReader.current=null;};},[loadPlan]);
  useEffect(()=>{
    latest.current={plan,groupId,hasDraft:!!(text||file||reading||sending)};
  },[plan,groupId,text,file,reading,sending]);
  useEffect(()=>{
    let live=true, refreshing=false, refreshingSignup=false;
    async function refreshPlan(){
      if(document.hidden||!latest.current?.plan)return;
      if(!refreshingSignup){
        refreshingSignup=true;
        loadSignup().finally(()=>{refreshingSignup=false;});
      }
      if(refreshing)return;
      refreshing=true;
      const epoch=generation.current;
      try {
        const next=validatePlan(await fetchGroupPlan(classId));
        if(!live||epoch!==generation.current)return;
        const state=latest.current;
        if((next.groups[0]?.id||'')===state.groupId){
          if(!blocked.current)setPlan(next);
          return;
        }
        if(state.hasDraft||pending.current||fileReader.current||blocked.current){
          if(!blocked.current)suspendChat('Nhóm của bạn đã thay đổi. Hội thoại cũ đã được đóng.');
        }else adoptPlan(next);
      }catch(e){
        if(live&&epoch===generation.current&&accessDenied(e))suspendChat(`Quyền truy cập đã thay đổi. ${e.message}`);
      }finally{refreshing=false;}
    }
    const timer=setInterval(refreshPlan,15000);
    document.addEventListener('visibilitychange',refreshPlan);
    return()=>{live=false;clearInterval(timer);document.removeEventListener('visibilitychange',refreshPlan);};
  },[classId,adoptPlan,loadSignup,suspendChat]);
  const scrollEnd=useCallback(()=>{if(viewport.current)viewport.current.scrollTop=viewport.current.scrollHeight;nearBottom.current=true;setNewCount(0);},[]);
  const acknowledge=useCallback(async(ids,seen=false)=>{
    if(blocked.current||!tracking.current||!groupId||!ids.length)return;
    const receipts=acknowledged.current;
    const values=ids.filter(id=>!receipts.has(`${seen?'r':'d'}:${id}`)).slice(-50);if(!values.length)return;
    try { await portalCall('ackGroupMessages',{classId,groupId,deliveredIds:values,readIds:seen?values:[]});for(const id of values)receipts.add(`${seen?'r':'d'}:${id}`); }
    catch { /* Never infer delivery/read from a failed acknowledgement. */ }
  },[classId,groupId]);
  useEffect(()=>{
    if(!groupId||membershipChange)return;
    const epoch=generation.current;let live=true,first=true,polling=false;acknowledged.current=new Set();readIds.current=new Set();knownIds.current=new Set();setLoadingChat(true);setOlder(null);
    const read=async()=>{
      if(blocked.current||polling||document.hidden)return;polling=true;
      try {
        const r=await portalCall('getGroupMessages',{classId,groupId});if(blocked.current||!live||epoch!==generation.current)return;
        tracking.current=r.receiptTracking===true;
        setMessages(old=>mergeMessages(old,r.messages));
        const fresh=r.messages.filter(m=>!knownIds.current.has(m.id));for(const m of r.messages)knownIds.current.add(m.id);
        if(!first&&!nearBottom.current&&fresh.length)setNewCount(n=>n+fresh.length);
        if(first)setOlder(r.older);first=false;setLoadingChat(false);setSyncError('');
        await acknowledge(r.messages.filter(m=>!m.mine).map(m=>m.id));
      } catch(e) {if(live&&epoch===generation.current&&!blocked.current){setSyncError(e.message);setLoadingChat(false);if(accessDenied(e))suspendChat(e.message);}}
      finally{polling=false;}
    };
    refreshChat.current=read;read();const timer=setInterval(read,10000);const resume=()=>{if(!document.hidden)read();};document.addEventListener('visibilitychange',resume);
    const push = ({ detail }) => { if (detail?.classId === classId && detail.groupId === groupId) read(); };
    window.addEventListener('fap-group-push', push);
    return()=>{live=false;clearInterval(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('fap-group-push', push);refreshChat.current=null;};
  },[classId,groupId,acknowledge,membershipChange,suspendChat]);
  useEffect(()=>{if(visible&&nearBottom.current)scrollEnd();},[visible,messages.length,outbox?.id,scrollEnd]);
  useEffect(()=>{
    if(!visible||!viewport.current||typeof IntersectionObserver==='undefined')return;
    const observer=new IntersectionObserver(entries=>{for(const e of entries){const id=e.target.dataset.messageId;if(e.isIntersecting)readIds.current.add(id);else readIds.current.delete(id);}},{root:viewport.current,threshold:0.6});
    for(const node of viewport.current.querySelectorAll('[data-message-id][data-mine="false"]'))observer.observe(node);
    const flush=setInterval(async()=>{if(ackBusy.current||document.hidden||!document.hasFocus()||!readIds.current.size)return;const top=document.querySelector('.topbar')?.getBoundingClientRect().bottom||0;const visible=[...viewport.current.querySelectorAll('[data-message-id][data-mine="false"]')].filter(node=>readIds.current.has(node.dataset.messageId)&&visibleMessageRect(node.getBoundingClientRect(),window.innerHeight,top)).map(node=>node.dataset.messageId);if(!visible.length)return;ackBusy.current=true;try{await acknowledge(visible,true);}finally{ackBusy.current=false;}},2000);
    return()=>{observer.disconnect();clearInterval(flush);readIds.current.clear();};
  },[visible,messages,acknowledge]);
  async function chooseFile(e){
    if(blocked.current||sending||reading||pending.current)return;
    const chosen=e.target.files[0];setError('');if(!chosen)return;
    if(chosen.size>512000||chosen.size===0||chosen.name.length>120||/[\x00-\x1f\\/]/.test(chosen.name)||!/\.(pdf|txt|png|jpe?g|xlsx|docx|csv)$/i.test(chosen.name)){setError('Chọn PDF, ảnh, Word, Excel, TXT hoặc CSV có nội dung, tối đa 500 KB; tên tối đa 120 ký tự.');e.target.value='';return;}
    setReading(true);const epoch=generation.current,reader=new FileReader();fileReader.current=reader;
    reader.onload=()=>{if(epoch===generation.current&&fileReader.current===reader){setFile({name:chosen.name,base64:String(reader.result).split(',')[1],size:chosen.size});setReading(false);fileReader.current=null;}};
    reader.onerror=()=>{if(epoch===generation.current&&fileReader.current===reader){setError('Không đọc được tệp. Chọn lại tệp đã tải về máy.');setReading(false);fileReader.current=null;if(input.current)input.current.value='';}};
    reader.readAsDataURL(chosen);
  }
  async function send(e){
    e?.preventDefault();if(blocked.current||sending||reading||(!pending.current&&!text.trim()&&!file))return;
    setSending(true);setError('');const epoch=generation.current;
    pending.current||={classId,groupId,text:text.trim(),...(file?{file:{name:file.name,base64:file.base64}}:{}),requestKey:crypto.randomUUID()};
    const payload=pending.current;setOutbox({id:payload.requestKey,text:payload.text,mine:true,hasFile:!!payload.file,fileName:payload.file?.name,localState:'sending'});nearBottom.current=true;
    try{
      const r=await portalCall('sendGroupMessage',payload);if(epoch!==generation.current)return;
      if(!blocked.current&&r.createdAt)setMessages(old=>mergeMessages(old,[{id:r.id,text:payload.text,mine:true,sender:plan.viewerId,senderName:'Bạn',createdAt:r.createdAt,hasFile:!!payload.file,fileName:payload.file?.name,size:file?.size||0}]));
      pending.current=null;setOutbox(null);setText('');setFile(null);if(input.current)input.current.value='';await refreshChat.current?.();
    }catch(e){if(epoch===generation.current){
      if(accessDenied(e))suspendChat(e.message);
      else setError(`${e.message} Tin nhắn được giữ để thử lại cùng mã gửi.`);
      setOutbox(m=>m?{...m,localState:'uncertain'}:m);
    }}
    finally{if(epoch===generation.current)setSending(false);}
  }
  async function download(m){
    if(blocked.current||downloadId)return;setDownloadId(m.id);setError('');const epoch=generation.current;
    try{const f=await portalCall('downloadGroupFile',{classId,groupId,messageId:m.id});if(blocked.current||epoch!==generation.current)return;const bytes=Uint8Array.from(atob(f.base64),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'})),a=document.createElement('a');a.href=url;a.download=f.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    catch(e){if(epoch===generation.current){if(accessDenied(e))suspendChat(e.message);else setError(e.message);}}finally{if(epoch===generation.current)setDownloadId('');}
  }
  async function previous(){
    if(blocked.current||paging||!older)return;setPaging(true);const pane=viewport.current,oldHeight=pane?.scrollHeight||0,epoch=generation.current;
    try{const r=await portalCall('getGroupMessages',{classId,groupId,before:older});if(blocked.current||epoch!==generation.current)return;nearBottom.current=false;setMessages(m=>mergeMessages(r.messages,m));setOlder(r.older);requestAnimationFrame(()=>{if(pane)pane.scrollTop+=pane.scrollHeight-oldHeight;});await acknowledge(r.messages.filter(m=>!m.mine).map(m=>m.id));}
    catch(e){if(epoch===generation.current){if(accessDenied(e))suspendChat(e.message);else setError(e.message);}}finally{if(epoch===generation.current)setPaging(false);}
  }
  const group=membershipChange?null:plan?.groups.find(g=>g.id===groupId),members=group?(plan?.students||[]):[],display=[...messages,...(outbox?[outbox]:[])];
  async function chooseGroup(event) {
    const selected = event.currentTarget.value;
    if (!selected || choosingGroup || latest.current?.hasDraft || pending.current) return;
    const currentGeneration = generation.current;
    const request = ++signupRequest.current;
    setChoosingGroup(true);
    setSignupError('');
    try {
      const next = await firebaseGroupSignup({ action: 'choose', classId, roundId: signup.roundId, groupId: selected });
      if (generation.current !== currentGeneration) return;
      if (request === signupRequest.current) setSignup(next);
      await loadPlan();
    } catch (cause) {
      if (generation.current === currentGeneration) {
        setSignupError(cause.message);
        await loadSignup();
      }
    } finally {
      setChoosingGroup(false);
    }
  }
  const canChooseGroup = useFirebaseSignup && signup?.state === 'OPEN' && Array.isArray(signup.groups);
  const signupUrl=!useFirebaseSignup&&signup?.state==='OPEN'&&/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]+\/edit#gid=\d+$/.test(signup.url)?signup.url:null;
  return <section className="card group-workspace chat-workspace" aria-label="Nhóm học tập">
    <header className="chat-heading"><div className="chat-group-avatar"><Icon name="school" size={27}/></div><div className="chat-heading-text"><span className="eyebrow">NHÓM HỌC TẬP</span><h2>{group?.name||'Nhóm học tập của tôi'}</h2><button className="members-toggle" onClick={()=>setShowMembers(s=>!s)} disabled={!group} aria-expanded={showMembers}>{members.length} thành viên <Icon name="chevron" size={14}/></button></div><button className="icon-button" aria-label="Tải lại nhóm" title="Tải lại nhóm" disabled={sending||!!pending.current} onClick={()=>{if((text||file||reading)&&!window.confirm('Bỏ tin nhắn và tệp chưa gửi để tải lại nhóm?'))return;loadPlan();}}><Icon name="refresh"/></button>
      {onClose && <button type="button" className="icon-button chat-minimize" aria-label="Thu gọn cửa sổ chat" title="Thu gọn cửa sổ chat" onClick={onClose}><Icon name="close" /></button>}
    </header>
    {pushAction}
    {showMembers&&group&&<div className="chat-members">{members.map(s=><div key={s.studentId}><span className="avatar">{initials(s.fullName)}</span><span><strong>{s.fullName}</strong><small>{s.studentCode}</small></span></div>)}</div>}
    {error&&<div className="chat-notice"><Notice>{error}</Notice></div>}
    {canChooseGroup && <div className="group-signup-banner">
      <div><strong>Đang mở đăng ký nhóm</strong><p>Chọn nhóm của bạn. Lựa chọn được lưu ngay cho lớp.</p></div>
      <label>Nhóm của bạn <select aria-label="Chọn nhóm" value={signup.selectedGroupId || ''} onChange={chooseGroup}
        disabled={choosingGroup || sending || reading || Boolean(text || file || outbox)}>
        <option value="" disabled>Chọn nhóm</option>
        {signup.groups.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select></label>
    </div>}
    {signupError && <p role="alert">{signupError}</p>}
    {signupUrl&&<div className="group-signup-banner" role="status"><div><strong>Đang mở đăng ký nhóm</strong><p>Chọn nhóm ở dòng MSSV của bạn trên Google Sheets. Chờ cột Đồng bộ xác nhận. Nhóm sẽ tự cập nhật khi bạn quay lại.</p></div><a href={signupUrl} target="_blank" rel="noreferrer">Chọn nhóm trên Google Sheets <Icon name="arrow" size={16}/></a></div>}
    {pending.current&&!sending&&!membershipChange&&<button className="pending-discard" type="button" onClick={()=>{if(!window.confirm('Tin nhắn có thể đã được máy chủ nhận. Bỏ bản chờ và kiểm tra lịch sử trước khi gửi mới?'))return;pending.current=null;setOutbox(null);setText('');setFile(null);loadPlan();}}>Bỏ bản gửi đang chờ và kiểm tra lại</button>}
    {loadingPlan?<Skeleton kind="chat" label="Đang tải nhóm…"/> :membershipChange?<div className="chat-notice">
      <Notice>{membershipChange}</Notice>
      {(text||file||reading||pending.current)&&<><p>Bản nháp hoặc lượt gửi chưa xác nhận vẫn được giữ. Kiểm tra nội dung trước khi chuyển nhóm.</p>{text&&<p className="preserve-text">{text}</p>}{file&&<p>Tệp: {file.name}</p>}</>}
      <button type="button" disabled={sending} onClick={()=>{
        if((text||file||reading||pending.current)&&!window.confirm('Bỏ bản nháp hoặc lượt gửi chưa xác nhận và tải nhóm hiện tại?'))return;
        loadPlan();
      }}>Kiểm tra và tải nhóm hiện tại</button>
    </div>:!group?<EmptyState icon="school" title={error?'Chưa tải được nhóm':(canChooseGroup||signupUrl)?'Chọn nhóm để bắt đầu':'Bạn chưa được xếp nhóm'}>{error?'Bấm tải lại để kiểm tra nhóm của bạn.':canChooseGroup?'Chọn nhóm ở ô đăng ký phía trên.':signupUrl?'Mở Sheet đăng ký phía trên, chọn nhóm và đợi xác nhận đồng bộ.':'Giảng viên chưa xếp bạn vào nhóm. Nhóm sẽ tự cập nhật khi có thay đổi.'}</EmptyState>:<>
      <div className="chat-toolbar"><span><Icon name="shield" size={14}/> Chỉ thành viên nhóm và giảng viên có quyền truy cập</span><span className={syncError?'chat-connection error':'chat-connection'}><i/>{syncError?'Chưa đồng bộ':'Cập nhật mỗi 10 giây'}</span></div>
      {syncError&&<div className="chat-sync-error" role="alert">{syncError}<button onClick={()=>refreshChat.current?.()}>Thử lại</button></div>}
      <div className="conversation" ref={viewport} aria-label="Tin nhắn nhóm" aria-busy={loadingChat} onScroll={()=>{const p=viewport.current;nearBottom.current=p.scrollHeight-p.scrollTop-p.clientHeight<80;if(nearBottom.current)setNewCount(0);}}>
        {loadingChat?<Skeleton kind="chat" label="Đang tải tin nhắn…"/>:<>{older&&<button className="older-messages" disabled={paging} onClick={previous}>{paging?'Đang tải…':'Tin nhắn cũ hơn'}</button>}{!display.length&&!syncError&&<div className="chat-empty"><Icon name="chat" size={40}/><h3>Câu chuyện của nhóm bắt đầu ở đây</h3><p>Gửi lời chào hoặc chia sẻ tài liệu với các thành viên.</p></div>}
          {display.map((m,i)=>{const mine=m.mine===true||!!(m.sender&&m.sender===plan.viewerId),day=chatDate(m.createdAt),newDay=day&&day!==chatDate(display[i-1]?.createdAt),status=messageStatus(m);return <Fragment key={m.id}>{newDay&&<div className="chat-day"><span>{day}</span></div>}<article data-message-id={m.id} data-mine={mine?'true':'false'} className={`message-row ${mine?'own':'incoming'}`}>{!mine&&<span className="message-avatar" aria-hidden="true">{initials(m.senderName)}</span>}<div className="message-content">{!mine&&<strong className="message-author">{m.senderName}</strong>}<div className="message-bubble"><p className="preserve-text">{m.text}</p>{m.hasFile&&<button className="chat-file" disabled={!!downloadId||!!m.localState} onClick={()=>download(m)}><span className="file-icon"><Icon name="document" size={23}/></span><span><strong>{m.fileName}</strong><small>{downloadId===m.id?'Đang tải tệp…':m.size?`${Math.ceil(m.size/1024)} KB · Tải xuống`:'Tệp đính kèm'}</small></span><Icon name="download" size={18}/></button>}<div className="message-meta">{m.createdAt&&<time dateTime={m.createdAt} title={`${chatDate(m.createdAt)} · giờ Việt Nam`}>{chatTime(m.createdAt)}</time>}{mine&&<span className={`message-status ${status.kind}`} title={status.detail}><Icon name={status.kind==='read'?'double-check':status.kind==='pending'?'clock':status.kind==='uncertain'?'info':'check'} size={13}/>{status.label}</span>}</div></div></div></article></Fragment>;})}
        </>}
      </div>
      {newCount>0&&<button className="new-messages" onClick={scrollEnd}>Có tin nhắn mới <Icon name="download" size={14}/></button>}
      <form className="chat-composer" onSubmit={send}><label className="sr-only" htmlFor="group-message">Tin nhắn cho nhóm</label>{file&&<div className="attachment-preview"><Icon name="document"/><span><strong>{file.name}</strong><small>{Math.ceil(file.size/1024)} KB · Sẵn sàng gửi</small></span><button type="button" className="icon-button" aria-label="Bỏ tệp đính kèm" disabled={sending||!!pending.current} onClick={()=>{setFile(null);if(input.current)input.current.value='';}}><Icon name="close" size={16}/></button></div>}
        <textarea id="group-message" value={text} maxLength={2000} rows={2} disabled={sending||!!pending.current} placeholder="Nhắn tin cho nhóm của bạn…" onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send();}}}/>
        <div className="composer-actions"><input ref={input} className="sr-only" aria-label="Tệp đính kèm nhóm" type="file" accept=".pdf,.txt,.png,.jpg,.jpeg,.xlsx,.docx,.csv" disabled={sending||reading||!!pending.current} onChange={chooseFile}/><button type="button" className="refresh-button attach-button" title="Đính kèm tệp" aria-label="Đính kèm tệp" disabled={sending||reading||!!pending.current} onClick={()=>input.current?.click()}><Icon name="attach"/><span>{file?'Đổi file':'Gửi file'}</span></button><span className="composer-hint">{reading?'Đang đọc tệp…':`${text.length}/2000 · Enter để gửi, Shift + Enter xuống dòng`}</span><button className="primary send-message" disabled={sending||reading||(!text.trim()&&!file)}><Icon name="send" size={17}/>{sending?'Đang gửi…':pending.current?'Thử gửi lại':file?'Gửi kèm file':'Gửi tin nhắn'}</button></div><p className="attachment-hint">PDF, ảnh, Word, Excel, TXT, CSV · 1 tệp/tin · Tối đa 500 KB/tệp</p>
      </form>
    </>}
  </section>;
}
