import React from 'react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const mocks=vi.hoisted(()=>({call:vi.fn()}));
vi.mock('../lib/api.js',()=>({portalCall:mocks.call}));
import StudyGroups from './StudyGroups.jsx';
import {chatTime,messageStatus,visibleMessageRect} from '../lib/chat.js';
afterEach(cleanup);
beforeEach(()=>{mocks.call.mockReset();});
const plan={groups:[{id:'g1',name:'Nhóm 1',memberIds:['s1']}],students:[{studentId:'s1',fullName:'Student one',studentCode:'SE1'}]};
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
