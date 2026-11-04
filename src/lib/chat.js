export const chatTime = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('vi-VN', { timeZone:'Asia/Ho_Chi_Minh', hour:'2-digit', minute:'2-digit' }).format(new Date(value)) : '';
export const chatDate = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('vi-VN', { timeZone:'Asia/Ho_Chi_Minh', day:'2-digit', month:'2-digit', year:'numeric' }).format(new Date(value)) : '';
export const initials = name => String(name || 'Thành viên').trim().split(/\s+/).slice(-2).map(s=>s[0]).join('').toUpperCase();
export function mergeMessages(before, incoming) { return [...new Map([...before,...incoming].map(m=>[m.id,m])).values()]; }
export function visibleMessageRect(rect, viewportHeight, coveredTop = 0) {
  if(!rect || rect.height<=0)return false;
  const overlap=Math.max(0,Math.min(rect.bottom,viewportHeight)-Math.max(rect.top,coveredTop));
  return overlap/rect.height>=0.6;
}
export function messageStatus(m) {
  if(m.localState==='sending') return {label:'Đang gửi…',detail:'Đang chờ máy chủ xác nhận',kind:'pending'};
  if(m.localState==='uncertain') return {label:'Chưa xác nhận',detail:'Có thể máy chủ đã nhận. Thử lại cùng tin nhắn để tránh gửi trùng.',kind:'uncertain'};
  const d=m.delivery;
  if(d?.readCount>0) return {label:`Đã xem ${chatTime(d.readAt)} · ${d.readCount}/${d.recipientCount}`,detail:`Xem lần đầu lúc ${chatTime(d.readAt)} ngày ${chatDate(d.readAt)}. Chỉ tính thành viên hiện tại đã xác nhận mở tin.`,kind:'read'};
  if(d?.deliveredCount>0) return {label:`Đã nhận ${chatTime(d.deliveredAt)} · ${d.deliveredCount}/${d.recipientCount}`,detail:`Nhận lần đầu lúc ${chatTime(d.deliveredAt)} ngày ${chatDate(d.deliveredAt)}. Thiết bị thành viên đã xác nhận tải tin.`,kind:'delivered'};
  return {label:'Đã gửi',detail:'Máy chủ đã lưu tin nhắn; chưa có xác nhận nhận hoặc xem.',kind:'sent'};
}
