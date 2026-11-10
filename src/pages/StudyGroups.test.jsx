import React from 'react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const mocks=vi.hoisted(()=>({call:vi.fn()}));
vi.mock('../lib/api.js',()=>({portalCall:mocks.call}));
import StudyGroups from './StudyGroups.jsx';
import {chatTime,messageStatus,visibleMessageRect} from '../lib/chat.js';
afterEach(cleanup);
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
beforeEach(()=>{mocks.call.mockReset();});
const plan={groups:[{id:'g1',name:'Nhóm 1',memberIds:['s1']}],students:[{studentId:'s1',fullName:'Student one',studentCode:'SE1'}]};
const nextPlan={groups:[{id:'g2',name:'Nhóm 2',memberIds:['s1']}],students:[]};
it('picks up a first group on returning to the tab',async()=>{
 let current={groups:[],students:[]};
 let signup={state:'OPEN',url:'https://docs.google.com/spreadsheets/d/abc123/edit#gid=0'};
 mocks.call.mockImplementation(async method=>method==='getGroupPlan'?current:method==='getGroupSignupSheet'?signup:{messages:[],older:null});
 render(<StudyGroups classId="c1"/>);
 await screen.findByRole('link',{name:/Chọn nhóm trên Google Sheets/});
 current=nextPlan;
 signup={state:'CLOSED'};
 fireEvent(document,new Event('visibilitychange'));
 await screen.findByText('Nhóm 2');
 expect(screen.queryByRole('link',{name:/Chọn nhóm trên Google Sheets/})).toBeNull();
 await waitFor(()=>expect(mocks.call).toHaveBeenCalledWith('getGroupMessages',{classId:'c1',groupId:'g2'}));
});
it('hides the previous conversation on a group change and keeps a draft until confirmation',async()=>{
 let current=plan;
 mocks.call.mockImplementation(async (method,data)=>method==='getGroupPlan'?current:{
   messages:data?.groupId==='g1'?[{id:'old',mine:false,text:'Tin nhóm cũ'}]:[],older:null,
 });
 const events=userEvent.setup();
 render(<StudyGroups classId="c1"/>);
 await screen.findByText('Tin nhóm cũ');
 await events.type(screen.getByRole('textbox',{name:'Tin nhắn cho nhóm'}),'Bản nháp riêng');
 current=nextPlan;
 fireEvent(document,new Event('visibilitychange'));
 await screen.findByText('Bản nháp riêng');
 expect(screen.queryByText('Tin nhóm cũ')).toBeNull();
 expect(screen.queryByText('Nhóm 2')).toBeNull();
 const confirm=vi.spyOn(window,'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
 try {
   const change=screen.getByRole('button',{name:'Kiểm tra và tải nhóm hiện tại'});
   await events.click(change);
   expect(screen.getByText('Bản nháp riêng')).toBeTruthy();
   await events.click(change);
   await screen.findByText('Nhóm 2');
   expect(screen.queryByText('Bản nháp riêng')).toBeNull();
 } finally {confirm.mockRestore();}
});
it('shows assigned group and server-authorized members; never requests full roster',async()=>{
 mocks.call.mockImplementation(async method=>method==='getGroupPlan'?plan:{messages:[],older:null});
  const events=userEvent.setup();render(<StudyGroups classId="c1"/>);await screen.findByText('Nhóm 1');await events.click(screen.getByRole('button',{name:/1 thành viên/}));expect(screen.getByText('Student one')).toBeTruthy();expect(screen.getByText('SE1')).toBeTruthy();await waitFor(()=>expect(mocks.call).toHaveBeenCalledWith('getGroupMessages',{classId:'c1',groupId:'g1'}));
});
it('shows unassigned state without allowing message send',async()=>{
 mocks.call.mockResolvedValue({groups:[],students:[]});render(<StudyGroups classId="c1"/>);await screen.findByText(/Giảng viên chưa xếp bạn/);expect(screen.queryByRole('button',{name:'Gửi tin nhắn'})).toBeNull();
});
it('retains identical request receipt after uncertain network failure',async()=>{
 let attempt=0;
 mocks.call.mockImplementation(async method=>{
  if(method==='getGroupPlan')return plan;if(method==='getGroupMessages')return{messages:[],older:null};
  if(method==='sendGroupMessage'){attempt++;if(attempt===1)throw Error('timeout');return{saved:true};}
 });
 const events=userEvent.setup();render(<StudyGroups classId="c1"/>);await screen.findByText('Nhóm 1');await events.type(screen.getByRole('textbox',{name:'Tin nhắn cho nhóm'}),'Hello group');await events.click(screen.getByRole('button',{name:'Gửi tin nhắn'}));await screen.findByText(/Tin nhắn được giữ/);await events.click(screen.getByRole('button',{name:'Thử gửi lại'}));await waitFor(()=>expect(attempt).toBe(2));const calls=mocks.call.mock.calls.filter(c=>c[0]==='sendGroupMessage');expect(calls[0][1]).toEqual(calls[1][1]);expect(calls[0][1].requestKey).toBeTruthy();
});
it('clears messages on permission failure',async()=>{
 mocks.call.mockImplementation(async method=>{if(method==='getGroupPlan')return plan;throw Error('Bạn không còn thuộc nhóm này');});render(<StudyGroups classId="c1"/>);await screen.findByText('Bạn không còn thuộc nhóm này');expect(screen.queryByText('Tin bí mật')).toBeNull();
});
it('shows skeleton until the actual plan resolves and exits loading on failure',async()=>{
 let reject;mocks.call.mockImplementation(()=>new Promise((_,r)=>{reject=r;}));render(<StudyGroups classId="c1"/>);expect(screen.getByRole('status',{name:'Đang tải nhóm…'})).toBeTruthy();reject(Error('Network failed'));await screen.findByText('Chưa tải được nhóm');expect(screen.queryByRole('status',{name:'Đang tải nhóm…'})).toBeNull();
});
it('renders own and incoming bubbles with server timestamps and actual receipt count',async()=>{
 mocks.call.mockImplementation(async method=>method==='getGroupPlan'?{...plan,viewerId:'student-s1'}:{receiptTracking:false,messages:[{id:'a',sender:'student-s1',mine:true,text:'My message',createdAt:'2026-11-02T15:00:00Z',delivery:{readCount:1,recipientCount:2,readAt:'2026-11-02T15:02:00Z'}},{id:'b',sender:'student-s2',senderName:'Another student',mine:false,text:'Reply',createdAt:'2026-11-02T15:03:00Z'}],older:null});
 render(<StudyGroups classId="c1"/>);await screen.findByText('My message');expect(screen.getByText('My message').closest('article').dataset.mine).toBe('true');expect(screen.getByText('Reply').closest('article').dataset.mine).toBe('false');expect(screen.getByText('22:00')).toBeTruthy();expect(screen.getByText('Đã xem 22:02 · 1/2')).toBeTruthy();
});
it('does not claim delivery or read without confirmation and actual screen visibility',()=>{expect(messageStatus({delivery:{readCount:0,deliveredCount:0}}).label).toBe('Đã gửi');expect(messageStatus({localState:'uncertain'}).label).toBe('Chưa xác nhận');expect(chatTime('invalid')).toBe('');expect(visibleMessageRect({top:1200,bottom:1300,height:100},800,84)).toBe(false);expect(visibleMessageRect({top:0,bottom:100,height:100},800,84)).toBe(false);expect(visibleMessageRect({top:200,bottom:300,height:100},800,84)).toBe(true);});
it('acknowledges delivery only after messages arrive; does not infer read without visibility',async()=>{
 mocks.call.mockImplementation(async method=>{if(method==='getGroupPlan')return plan;if(method==='getGroupMessages')return{receiptTracking:true,messages:[{id:'msg1',mine:false,text:'Incoming',createdAt:'2026-11-02T15:00:00Z'}],older:null};return{saved:true};});render(<StudyGroups classId="c1"/>);await screen.findByText('Incoming');await waitFor(()=>expect(mocks.call).toHaveBeenCalledWith('ackGroupMessages',{classId:'c1',groupId:'g1',deliveredIds:['msg1'],readIds:[]}));expect(mocks.call.mock.calls.filter(c=>c[0]==='ackGroupMessages').every(c=>!c[1].readIds.length)).toBe(true);
});
it('sends a file without text and retries the identical attachment after uncertainty',async()=>{
 let attempts=0;
 mocks.call.mockImplementation(async method=>{
  if(method==='getGroupPlan')return {...plan,viewerId:'student-s1'};
  if(method==='getGroupMessages')return {messages:[],older:null};
  if(method==='sendGroupMessage'){attempts++;if(attempts===1)throw Error('timeout');return{saved:true,id:'file-message',createdAt:'2026-11-04T03:00:00Z'};}
 });
 const events=userEvent.setup();render(<StudyGroups classId="c1"/>);await screen.findByText('Nhóm 1');
 await events.upload(screen.getByLabelText('Tệp đính kèm nhóm'),new File(['abc'],'Bai-tap.pdf',{type:'application/pdf'}));
 await screen.findByRole('button',{name:'Gửi kèm file'});expect(attempts).toBe(0);
 await events.click(screen.getByRole('button',{name:'Gửi kèm file'}));await screen.findByText(/Tin nhắn được giữ/);
 expect(screen.getByRole('button',{name:'Bỏ tệp đính kèm'}).disabled).toBe(true);
 await events.click(screen.getByRole('button',{name:'Thử gửi lại'}));
 await waitFor(()=>expect(attempts).toBe(2));
 const writes=mocks.call.mock.calls.filter(c=>c[0]==='sendGroupMessage');
 expect(writes[0][1]).toEqual(writes[1][1]);expect(writes[0][1].file).toEqual({name:'Bai-tap.pdf',base64:'YWJj'});expect(writes[0][1].text).toBe('');
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Bỏ tệp đính kèm'})).toBeNull());
});
it('removes a selected file while retaining the message, and permits picking it again',async()=>{
 mocks.call.mockImplementation(async method=>method==='getGroupPlan'?plan:{messages:[],older:null});
 const events=userEvent.setup();render(<StudyGroups classId="c1"/>);await screen.findByText('Nhóm 1');
 await events.type(screen.getByRole('textbox',{name:'Tin nhắn cho nhóm'}),'Đọc tài liệu');
 const input=screen.getByLabelText('Tệp đính kèm nhóm'),file=new File(['abc'],'note.txt',{type:'text/plain'});
 await events.upload(input,file);await screen.findByText('note.txt');
 await events.click(screen.getByRole('button',{name:'Bỏ tệp đính kèm'}));
 expect(screen.queryByText('note.txt')).toBeNull();expect(screen.getByRole('textbox',{name:'Tin nhắn cho nhóm'}).value).toBe('Đọc tài liệu');
 await events.upload(input,file);expect(await screen.findByText('note.txt')).toBeTruthy();
});
it('rejects empty, oversized, unsupported and invalid-name files before calling the backend',async()=>{
 mocks.call.mockImplementation(async method=>method==='getGroupPlan'?plan:{messages:[],older:null});
 const events=userEvent.setup({applyAccept:false});render(<StudyGroups classId="c1"/>);await screen.findByText('Nhóm 1');
 for(const file of [new File([],'empty.txt'),new File([new Uint8Array(512001)],'big.pdf'),new File(['a'],'bad.exe'),new File(['a'],'a'.repeat(121)+'.pdf')]){
  await events.upload(screen.getByLabelText('Tệp đính kèm nhóm'),file);await screen.findByRole('alert');
  expect(screen.queryByRole('button',{name:'Gửi kèm file'})).toBeNull();
 }
 expect(mocks.call.mock.calls.some(c=>c[0]==='sendGroupMessage')).toBe(false);
});
it('unassigned students can open the actual restricted Google Sheet registration link',async()=>{
 mocks.call.mockImplementation(async method=>method==='getGroupSignupSheet'?{state:'OPEN',url:'https://docs.google.com/spreadsheets/d/doc-1/edit#gid=100'}:{groups:[],students:[]});
 render(<StudyGroups classId="c1"/>);
 const link=await screen.findByRole('link',{name:/Chọn nhóm trên Google Sheets/});
 expect(link.getAttribute('href')).toBe('https://docs.google.com/spreadsheets/d/doc-1/edit#gid=100');
 expect(link.getAttribute('rel')).toBe('noreferrer');expect(await screen.findByText('Chọn nhóm để bắt đầu')).toBeTruthy();
});
it('never presents a signup link pointing outside Google Sheets',async()=>{
 mocks.call.mockImplementation(async method=>method==='getGroupSignupSheet'?{state:'OPEN',url:'https://evil.test/'}:{groups:[],students:[]});
 render(<StudyGroups classId="c1"/>);await screen.findByText('Bạn chưa được xếp nhóm');
 expect(screen.queryByRole('link',{name:/Chọn nhóm trên Google Sheets/})).toBeNull();
});
it('automatically adopts a newly assigned group on the 15-second plan poll',async()=>{
 vi.useFakeTimers();vi.spyOn(document,'hidden','get').mockReturnValue(false);
 let current={version:1,groups:[],students:[]};
 mocks.call.mockImplementation(async method=>method==='getGroupPlan'?current:method==='getGroupSignupSheet'?null:{messages:[],older:null});
 await act(async()=>{render(<StudyGroups classId="c1"/>);});
 expect(screen.getByText('Bạn chưa được xếp nhóm')).toBeTruthy();
 current={...plan,version:2};
 await act(async()=>{vi.advanceTimersByTime(15000);});
 expect(screen.getByRole('heading',{name:'Nhóm 1'})).toBeTruthy();
 expect(mocks.call).toHaveBeenCalledWith('getGroupMessages',{classId:'c1',groupId:'g1'});
});
it('keeps text and attachment when a newer plan arrives, and blocks old-group sending',async()=>{
 vi.spyOn(document,'hidden','get').mockReturnValue(false);
 let current={...plan,version:1};
 mocks.call.mockImplementation(async method=>method==='getGroupPlan'?current:method==='getGroupSignupSheet'?null:{messages:[],older:null});
 const events=userEvent.setup();render(<StudyGroups classId="c1"/>);await screen.findByText('Nhóm 1');
 await events.type(screen.getByRole('textbox',{name:'Tin nhắn cho nhóm'}),'Giữ bản nháp');
 await events.upload(screen.getByLabelText('Tệp đính kèm nhóm'),new File(['abc'],'draft.pdf',{type:'application/pdf'}));await screen.findByText('draft.pdf');
 current={...plan,version:2,groups:[{...plan.groups[0],id:'g2',name:'Nhóm mới'}]};
 fireEvent(document,new Event('visibilitychange'));
 await screen.findByText(/Nhóm của bạn đã thay đổi/);
 expect(screen.getByText('Giữ bản nháp')).toBeTruthy();
 expect(screen.getByText('Tệp: draft.pdf')).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Gửi kèm file'})).toBeNull();
 expect(mocks.call.mock.calls.some(c=>c[0]==='sendGroupMessage')).toBe(false);
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
 const change=screen.getByRole('button',{name:'Kiểm tra và tải nhóm hiện tại'});
 await events.click(change);expect(confirm).toHaveBeenCalled();
 expect(screen.getByText('Tệp: draft.pdf')).toBeTruthy();
 confirm.mockReturnValue(true);await events.click(change);
 await screen.findByRole('heading',{name:'Nhóm mới'});expect(screen.queryByText(/draft\.pdf/)).toBeNull();
});
it('does not apply a stale plan response after switching classes',async()=>{
 vi.spyOn(document,'hidden','get').mockReturnValue(false);
 let pending,reads=0;
 mocks.call.mockImplementation(async(method,data)=>{
  if(method==='getGroupSignupSheet')return null;
  if(method==='getGroupPlan'){
   if(data.classId==='c2')return {...plan,version:3,groups:[{...plan.groups[0],id:'g2',name:'Lớp mới'}]};
   if(++reads===1)return {...plan,version:1};
   return new Promise(resolve=>{pending=resolve;});
  }return {messages:[],older:null};
 });
 const view=render(<StudyGroups classId="c1"/>);await screen.findByText('Nhóm 1');fireEvent(document,new Event('visibilitychange'));
 await waitFor(()=>expect(pending).toBeTypeOf('function'));view.rerender(<StudyGroups classId="c2"/>);await screen.findByText('Lớp mới');
 await act(async()=>pending({...plan,version:9,groups:[{...plan.groups[0],name:'Cũ'}]}));
 expect(screen.queryByText('Cũ')).toBeNull();expect(screen.getByRole('heading',{name:'Lớp mới'})).toBeTruthy();
});
it('hides old messages and visible member data after server revokes access while retaining the draft',async()=>{
 vi.spyOn(document,'hidden','get').mockReturnValue(false);let revoked=false;
 mocks.call.mockImplementation(async method=>{
  if(method==='getGroupPlan'){if(revoked)throw Object.assign(Error('Quyền đã thay đổi'),{code:'NOT_ENROLLED'});return {...plan,version:1};}
  if(method==='getGroupSignupSheet')return null;
  return {messages:[{id:'old',mine:false,text:'Tin cũ',senderName:'Bạn cũ'}],older:null};
 });
 const events=userEvent.setup();render(<StudyGroups classId="c1"/>);await screen.findByText('Tin cũ');
 await events.click(screen.getByRole('button',{name:/1 thành viên/}));expect(screen.getByText('Student one')).toBeTruthy();
 await events.type(screen.getByRole('textbox',{name:'Tin nhắn cho nhóm'}),'Bản nháp');revoked=true;
 fireEvent(document,new Event('visibilitychange'));await screen.findByText(/Quyền truy cập đã thay đổi/);
 expect(screen.queryByText('Tin cũ')).toBeNull();expect(screen.queryByText('Student one')).toBeNull();
 expect(screen.getByText('Bản nháp')).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Gửi tin nhắn'})).toBeNull();
});
