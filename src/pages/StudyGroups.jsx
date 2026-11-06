import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { portalCall } from '../lib/api.js';
import { EmptyState, Notice } from '../components/PortalShell.jsx';
import Skeleton from '../components/Skeleton.jsx';
import Icon from '../components/Icon.jsx';
import { chatTime, chatDate, initials, mergeMessages, messageStatus, visibleMessageRect } from '../lib/chat.js';

export default function StudyGroups({ classId }) {
  const [plan,setPlan]=useState(null),[groupId,setGroupId]=useState(''),[messages,setMessages]=useState([]),[loadingPlan,setLoadingPlan]=useState(true),[loadingChat,setLoadingChat]=useState(false);
  const [text,setText]=useState(''),[file,setFile]=useState(null),[error,setError]=useState(''),[sending,setSending]=useState(false),[reading,setReading]=useState(false),[downloadId,setDownloadId]=useState(''),[older,setOlder]=useState(null),[paging,setPaging]=useState(false),[outbox,setOutbox]=useState(null),[showMembers,setShowMembers]=useState(false),[newCount,setNewCount]=useState(0),[syncError,setSyncError]=useState('');
  const pending=useRef(null),viewport=useRef(null),input=useRef(null),generation=useRef(0),polling=useRef(false),nearBottom=useRef(true),tracking=useRef(false),readIds=useRef(new Set()),acknowledged=useRef(new Set()),ackBusy=useRef(false),refreshChat=useRef(null);
  const knownIds=useRef(new Set());
  const [signup,setSignup]=useState(null);
  const fileReader=useRef(null);
  const latest=useRef({}), planRequest=useRef(false), pendingPlan=useRef(null);
  const [planNotice,setPlanNotice]=useState(''),[planEpoch,setPlanEpoch]=useState(0);
  latest.current={plan,text,file,sending,reading,loadingPlan,downloadId,paging};
  const hasDraft=()=>!!(latest.current.text||latest.current.file||latest.current.sending||latest.current.reading||pending.current||fileReader.current||latest.current.downloadId||latest.current.paging);
  const applyPlan=p=>{
    generation.current++;pendingPlan.current=null;setPlanNotice('');setMessages([]);setOutbox(null);setOlder(null);setNewCount(0);tracking.current=false;
    setPlan(p);setGroupId(current=>p.groups.some(g=>g.id===current)?current:p.groups[0]?.id||'');setPlanEpoch(n=>n+1);
  };
  const loadPlan=useCallback(async()=>{
    const epoch=++generation.current;pendingPlan.current=null;setPlanNotice('');fileReader.current?.abort();fileReader.current=null;setReading(false);setFile(null);setText('');if(input.current)input.current.value='';setLoadingPlan(true);setError('');setMessages([]);setPlan(null);setGroupId('');setOutbox(null);setSignup(null);tracking.current=false;
    portalCall('getGroupSignupSheet',{classId}).then(r=>{if(epoch===generation.current)setSignup(r);}).catch(()=>{});
    try { const p=await portalCall('getGroupPlan',{classId});if(epoch!==generation.current)return;setPlan(p);setGroupId(p.groups[0]?.id||''); }
    catch(e){if(epoch===generation.current)setError(e.message);}finally{if(epoch===generation.current)setLoadingPlan(false);}
  },[classId]);
  useEffect(()=>{loadPlan();return()=>{generation.current++;fileReader.current?.abort();fileReader.current=null;};},[loadPlan]);
  useEffect(()=>{
    let live=true;
    const refresh=async()=>{
      if(!live||document.hidden||planRequest.current||latest.current.loadingPlan||!latest.current.plan)return;
      const epoch=generation.current;planRequest.current=true;
      try{
        const [p,s]=await Promise.all([portalCall('getGroupPlan',{classId}),portalCall('getGroupSignupSheet',{classId}).catch(()=>undefined)]);
        if(!live||epoch!==generation.current)return;
        if(!p||!Array.isArray(p.groups)||!Array.isArray(p.students))throw Error('Máy chủ trả danh sách nhóm không hợp lệ.');
        if(s!==undefined)setSignup(s);
        if(JSON.stringify(p)===JSON.stringify(latest.current.plan)){pendingPlan.current=null;setPlanNotice('');return;}
        // Never discard a draft or an uncertain request to adopt a new group.
        // Pause old chat immediately; the backend still checks current membership.
        if(hasDraft()){
          pendingPlan.current=p;setPlanNotice('Nhóm đã thay đổi. Bản nháp được giữ; kiểm tra trước khi chuyển nhóm.');setMessages([]);tracking.current=false;
        }else applyPlan(p);
      }catch(e){if(live&&epoch===generation.current){
        if(['NOT_ENROLLED','PERMISSION_DENIED','UNAUTHENTICATED','GROUP_ACCESS_DENIED','PROFILE_NOT_REGISTERED'].includes(e.code)){
          pendingPlan.current={groups:[],students:[]};setPlanNotice('Quyền truy cập đã thay đổi. Bản nháp được giữ; tải lại để kiểm tra.');setMessages([]);tracking.current=false;
        }else setSyncError('Chưa kiểm tra được cập nhật nhóm. Sẽ tự thử lại.');
      }}finally{planRequest.current=false;}
    };
    const timer=setInterval(refresh,15000),resume=()=>{if(!document.hidden)refresh();};
    document.addEventListener('visibilitychange',resume);
    return()=>{live=false;clearInterval(timer);document.removeEventListener('visibilitychange',resume);};
  },[classId]);
  const scrollEnd=useCallback(()=>{if(viewport.current)viewport.current.scrollTop=viewport.current.scrollHeight;nearBottom.current=true;setNewCount(0);},[]);
  const acknowledge=useCallback(async(ids,seen=false)=>{
    if(!tracking.current||!groupId||!ids.length||pendingPlan.current)return;
    const values=ids.filter(id=>!acknowledged.current.has(`${seen?'r':'d'}:${id}`)).slice(-50);if(!values.length)return;
    try { await portalCall('ackGroupMessages',{classId,groupId,deliveredIds:values,readIds:seen?values:[]});for(const id of values)acknowledged.current.add(`${seen?'r':'d'}:${id}`); }
    catch { /* Never infer delivery/read from a failed acknowledgement. */ }
  },[classId,groupId]);
  useEffect(()=>{
    if(!groupId)return;
    const epoch=generation.current;let live=true,first=true;acknowledged.current=new Set();readIds.current=new Set();knownIds.current=new Set();setLoadingChat(true);setOlder(null);
    const read=async()=>{
      if(polling.current||document.hidden||pendingPlan.current)return;polling.current=true;
      try {
        const r=await portalCall('getGroupMessages',{classId,groupId});if(!live||epoch!==generation.current||pendingPlan.current)return;
        tracking.current=r.receiptTracking===true;
        setMessages(old=>mergeMessages(old,r.messages));
        const fresh=r.messages.filter(m=>!knownIds.current.has(m.id));for(const m of r.messages)knownIds.current.add(m.id);
        if(!first&&!nearBottom.current&&fresh.length)setNewCount(n=>n+fresh.length);
        if(first)setOlder(r.older);first=false;setLoadingChat(false);setSyncError('');
        await acknowledge(r.messages.filter(m=>!m.mine).map(m=>m.id));
      } catch(e) {if(live){setSyncError(e.message);setLoadingChat(false);if(/nhóm này|GROUP_ACCESS_DENIED|NOT_ENROLLED|UNAUTHENTICATED/.test(e.message))setMessages([]);}}
      finally{polling.current=false;}
    };
    refreshChat.current=read;read();const timer=setInterval(read,10000);const resume=()=>{if(!document.hidden)read();};document.addEventListener('visibilitychange',resume);
    return()=>{live=false;clearInterval(timer);document.removeEventListener('visibilitychange',resume);refreshChat.current=null;};
  },[classId,groupId,acknowledge,planEpoch]);
  useEffect(()=>{if(nearBottom.current)scrollEnd();},[messages.length,outbox?.id,scrollEnd]);
  useEffect(()=>{
    if(!viewport.current||typeof IntersectionObserver==='undefined')return;
    const observer=new IntersectionObserver(entries=>{for(const e of entries){const id=e.target.dataset.messageId;if(e.isIntersecting)readIds.current.add(id);else readIds.current.delete(id);}},{root:viewport.current,threshold:0.6});
    for(const node of viewport.current.querySelectorAll('[data-message-id][data-mine="false"]'))observer.observe(node);
    const flush=setInterval(async()=>{if(ackBusy.current||document.hidden||!document.hasFocus()||!readIds.current.size)return;const top=document.querySelector('.topbar')?.getBoundingClientRect().bottom||0;const visible=[...viewport.current.querySelectorAll('[data-message-id][data-mine="false"]')].filter(node=>readIds.current.has(node.dataset.messageId)&&visibleMessageRect(node.getBoundingClientRect(),window.innerHeight,top)).map(node=>node.dataset.messageId);if(!visible.length)return;ackBusy.current=true;try{await acknowledge(visible,true);}finally{ackBusy.current=false;}},2000);
    return()=>{observer.disconnect();clearInterval(flush);readIds.current.clear();};
  },[messages,acknowledge]);
  async function chooseFile(e){
    if(sending||reading||pending.current||pendingPlan.current)return;
    const chosen=e.target.files[0];setError('');if(!chosen)return;
    if(chosen.size>512000||chosen.size===0||chosen.name.length>120||/[\x00-\x1f\\/]/.test(chosen.name)||!/\.(pdf|txt|png|jpe?g|xlsx|docx|csv)$/i.test(chosen.name)){setError('Chọn PDF, ảnh, Word, Excel, TXT hoặc CSV có nội dung, tối đa 500 KB; tên tối đa 120 ký tự.');e.target.value='';return;}
    setReading(true);const epoch=generation.current,reader=new FileReader();fileReader.current=reader;
    reader.onload=()=>{if(epoch===generation.current&&fileReader.current===reader){setFile({name:chosen.name,base64:String(reader.result).split(',')[1],size:chosen.size});setReading(false);fileReader.current=null;}};
    reader.onerror=()=>{if(epoch===generation.current&&fileReader.current===reader){setError('Không đọc được tệp. Chọn lại tệp đã tải về máy.');setReading(false);fileReader.current=null;if(input.current)input.current.value='';}};
    reader.readAsDataURL(chosen);
  }
  async function send(e){
    e?.preventDefault();if(sending||reading||pendingPlan.current||(!pending.current&&!text.trim()&&!file))return;
    setSending(true);setError('');const epoch=generation.current;
    pending.current||={classId,groupId,text:text.trim(),...(file?{file:{name:file.name,base64:file.base64}}:{}),requestKey:crypto.randomUUID()};
    const payload=pending.current;setOutbox({id:payload.requestKey,text:payload.text,mine:true,hasFile:!!payload.file,fileName:payload.file?.name,localState:'sending'});nearBottom.current=true;
    try{
      const r=await portalCall('sendGroupMessage',payload);if(epoch!==generation.current)return;
      if(r.createdAt)setMessages(old=>mergeMessages(old,[{id:r.id,text:payload.text,mine:true,sender:plan.viewerId,senderName:'Bạn',createdAt:r.createdAt,hasFile:!!payload.file,fileName:payload.file?.name,size:file?.size||0}]));
      pending.current=null;setOutbox(null);setText('');setFile(null);if(input.current)input.current.value='';await refreshChat.current?.();
    }catch(e){if(epoch===generation.current){setError(`${e.message} Tin nhắn được giữ để thử lại cùng mã gửi.`);setOutbox(m=>m?{...m,localState:'uncertain'}:m);}}
    finally{if(epoch===generation.current)setSending(false);}
  }
  async function download(m){
    if(downloadId||pendingPlan.current)return;setDownloadId(m.id);setError('');const epoch=generation.current;
    try{const f=await portalCall('downloadGroupFile',{classId,groupId,messageId:m.id});if(epoch!==generation.current||pendingPlan.current)return;const bytes=Uint8Array.from(atob(f.base64),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'})),a=document.createElement('a');a.href=url;a.download=f.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    catch(e){if(epoch===generation.current)setError(e.message);}finally{if(epoch===generation.current)setDownloadId('');}
  }
  async function previous(){
    if(paging||!older||pendingPlan.current)return;setPaging(true);const pane=viewport.current,oldHeight=pane?.scrollHeight||0,epoch=generation.current;
    try{const r=await portalCall('getGroupMessages',{classId,groupId,before:older});if(epoch!==generation.current||pendingPlan.current)return;nearBottom.current=false;setMessages(m=>mergeMessages(r.messages,m));setOlder(r.older);requestAnimationFrame(()=>{if(pane)pane.scrollTop+=pane.scrollHeight-oldHeight;});await acknowledge(r.messages.filter(m=>!m.mine).map(m=>m.id));}
    catch(e){if(epoch===generation.current)setError(e.message);}finally{if(epoch===generation.current)setPaging(false);}
  }
  const group=plan?.groups.find(g=>g.id===groupId),members=plan?.students||[],display=[...messages,...(outbox?[outbox]:[])];
  const signupUrl=signup?.state==='OPEN'&&/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]+\/edit#gid=\d+$/.test(signup.url)?signup.url:null;
  return <section className="card group-workspace chat-workspace" aria-label="Nhóm học tập">
    <header className="chat-heading"><div className="chat-group-avatar"><Icon name="school" size={27}/></div><div className="chat-heading-text"><span className="eyebrow">NHÓM HỌC TẬP</span><h2>{group?.name||'Nhóm học tập của tôi'}</h2><button className="members-toggle" onClick={()=>setShowMembers(s=>!s)} disabled={!group} aria-expanded={showMembers}>{members.length} thành viên <Icon name="chevron" size={14}/></button></div><button className="icon-button" aria-label="Tải lại nhóm" title="Tải lại nhóm" disabled={sending||!!pending.current} onClick={()=>{if((text||file||reading)&&!window.confirm('Bỏ tin nhắn và tệp chưa gửi để tải lại nhóm?'))return;loadPlan();}}><Icon name="refresh"/></button></header>
    {showMembers&&group&&!planNotice&&<div className="chat-members">{members.map(s=><div key={s.studentId}><span className="avatar">{initials(s.fullName)}</span><span><strong>{s.fullName}</strong><small>{s.studentCode}</small></span></div>)}</div>}
    {error&&<div className="chat-notice"><Notice>{error}</Notice></div>}
    {planNotice&&<div className="group-signup-banner" role="status"><p>{planNotice}</p><button disabled={sending} onClick={()=>{if(hasDraft()&&!window.confirm('Bỏ bản nháp/tệp hoặc lần gửi đang chờ để lấy nhóm hiện tại? Tin nhắn có thể đã được máy chủ nhận.'))return;pending.current=null;loadPlan();}}>Kiểm tra nhóm mới</button></div>}
    {signupUrl&&<div className="group-signup-banner" role="status"><div><strong>Đang mở đăng ký nhóm</strong><p>Chọn nhóm ở dòng MSSV của bạn trên Google Sheets. Chờ cột Đồng bộ xác nhận rồi bấm Tải lại nhóm.</p></div><a href={signupUrl} target="_blank" rel="noreferrer">Chọn nhóm trên Google Sheets <Icon name="arrow" size={16}/></a></div>}
    {pending.current&&!sending&&<button className="pending-discard" type="button" onClick={()=>{if(!window.confirm('Tin nhắn có thể đã được máy chủ nhận. Bỏ bản chờ và kiểm tra lịch sử trước khi gửi mới?'))return;pending.current=null;setOutbox(null);setText('');setFile(null);loadPlan();}}>Bỏ bản gửi đang chờ và kiểm tra lại</button>}
    {loadingPlan?<Skeleton kind="chat" label="Đang tải nhóm…"/>:!group?<EmptyState icon="school" title={error?'Chưa tải được nhóm':signupUrl?'Chọn nhóm để bắt đầu':'Bạn chưa được xếp nhóm'}>{error?'Bấm tải lại để kiểm tra nhóm của bạn.':signupUrl?'Mở Sheet đăng ký phía trên, chọn nhóm và đợi xác nhận đồng bộ.':'Giảng viên chưa xếp bạn vào nhóm. Hãy tải lại sau khi giảng viên chia nhóm.'}</EmptyState>:<>
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
        <div className="composer-actions"><input ref={input} className="sr-only" aria-label="Tệp đính kèm nhóm" type="file" accept=".pdf,.txt,.png,.jpg,.jpeg,.xlsx,.docx,.csv" disabled={sending||reading||!!pending.current||!!planNotice} onChange={chooseFile}/><button type="button" className="refresh-button attach-button" title="Đính kèm tệp" aria-label="Đính kèm tệp" disabled={sending||reading||!!pending.current||!!planNotice} onClick={()=>input.current?.click()}><Icon name="attach"/><span>{file?'Đổi file':'Gửi file'}</span></button><span className="composer-hint">{reading?'Đang đọc tệp…':`${text.length}/2000 · Enter để gửi, Shift + Enter xuống dòng`}</span><button className="primary send-message" disabled={sending||reading||!!planNotice||(!text.trim()&&!file)}><Icon name="send" size={17}/>{sending?'Đang gửi…':pending.current?'Thử gửi lại':file?'Gửi kèm file':'Gửi tin nhắn'}</button></div><p className="attachment-hint">PDF, ảnh, Word, Excel, TXT, CSV · 1 tệp/tin · Tối đa 500 KB/tệp</p>
      </form>
    </>}
  </section>;
}
