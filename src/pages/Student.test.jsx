import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const mocks = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock('../lib/api.js', () => ({ portalCall: mocks.call, portalEndpoint: 'https://script.google.com/macros/s/test/exec', vietnamDate: () => '2026-10-24', leaveStatuses: { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt' } }));
import Student from './Student.jsx';
const classes = [{ classId: 'c1', semester: 'FA26', subjectCode: 'PRM393', classCode: 'SE1' }];
const user = { uid: 'u1' };
const mockApi = fn => mocks.call.mockImplementation((method, data) => method === 'listMyTaskNotifications' ? Promise.resolve({ notifications: [], unreadCount: 0, older: null }) : fn(method, data));
afterEach(cleanup);
beforeEach(() => { mocks.call.mockReset(); window.history.replaceState(null, '', '/'); });
describe('student portal', () => {
  it('offers the student calculator without calling write APIs and resets inputs on class change', async () => {
    mockApi(async method => method === 'listClasses' ? [...classes, { ...classes[0], classId: 'c2', classCode: 'SE2' }] : { published: false });
    const events = userEvent.setup(); render(<Student user={user} />);
    await screen.findByText('Giảng viên chưa công bố điểm.');
    const calls = mocks.call.mock.calls.length;
    await events.click(screen.getByRole('button', { name: 'Tính điểm FE/PE' }));
    await events.type(screen.getByLabelText('Điểm cột 1 / 10'), '8,5');
    expect(mocks.call.mock.calls).toHaveLength(calls);
    await events.selectOptions(screen.getByRole('combobox', { name: 'Lớp học' }), 'c2');
    expect(screen.getByLabelText('Điểm cột 1 / 10').value).toBe('');
    expect(mocks.call.mock.calls).toHaveLength(calls);
  });
  it('shows a load error without incorrectly claiming the student has no classes', async () => {
    mocks.call.mockRejectedValue(new Error('Backend chưa được cấu hình cho cổng sinh viên.'));
    render(<Student user={user} />);
    expect(await screen.findByText('Chưa tải được lớp học')).toBeTruthy();
    expect(screen.queryByText('Chưa có lớp học. Hãy nhờ giảng viên kiểm tra email và danh sách lớp của bạn.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Tải lại lớp' }).disabled).toBe(false);
  });
  it('shows unpublished state and never requests a draft API', async () => {
    mockApi(async method => method === 'listClasses' ? classes : { published: false });
    render(<Student user={user} />);
    expect(await screen.findByText('Giảng viên chưa công bố điểm.')).toBeTruthy();
    expect(mocks.call.mock.calls.map(c => c[0])).toEqual(['listMyTaskNotifications', 'listClasses', 'getMyPublishedGrades']);
  });
  it('renders zero as a grade and only the returned student snapshot', async () => {
    mockApi(async method => method === 'listClasses' ? classes : { published: true, components: [{ id: 'p', name: 'PE', maxScore: 10 }], grades: { p: 0 }, publishedAt: '2026-10-24T01:00:00Z', version: 1 });
    render(<Student user={user} />);
    expect(await screen.findByRole('cell', { name: '0' })).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
  it('submits a future occurrence with an idempotency key and shows pending history', async () => {
    let submitted = false;
    mockApi(async (method, data) => {
      if (method === 'listClasses') return classes;
      if (method === 'getMyPublishedGrades') return { published: false };
      if (method === 'listOccurrences') return [{ occurrenceId: 'o1', slot: 1, scheduledStartTime: '09:00', scheduledEndTime: '10:30', room: 'A1' }];
      if (method === 'listMyLeaveRequests') return submitted ? [{ id: 'r1', classId: 'c1', sessionDate: '2026-10-24', slot: 1, startTime: '09:00', endTime: '10:30', reason: 'Khám bệnh theo lịch hẹn', status: 'PENDING', submittedAt: '2026-10-23T01:00:00Z', version: 1 }] : [];
      if (method === 'submitLeaveRequest') { expect(data.occurrenceId).toBe('o1'); expect(data.classId).toBe('c1'); expect(data.requestKey).toBeTruthy(); submitted = true; return { id: 'r1' }; }
      throw new Error(method);
    });
    const events = userEvent.setup(); render(<Student user={user} />);
    await screen.findByText('Giảng viên chưa công bố điểm.');
    await events.click(screen.getByRole('button', { name: 'Xin nghỉ' }));
    await screen.findByText('Bạn chưa gửi đơn cho lớp này.');
    await events.type(screen.getByRole('textbox', { name: 'Lý do xin nghỉ' }), 'Khám bệnh theo lịch hẹn');
    await events.click(screen.getByRole('button', { name: 'Gửi đơn xin nghỉ' }));
    expect(await screen.findByText('Chờ duyệt')).toBeTruthy();
    expect(mocks.call.mock.calls.filter(c => c[0] === 'submitLeaveRequest')).toHaveLength(1);
  });
  it('does not display a stale grade response after switching classes', async () => {
    let resolveOld;
    mockApi(async (method, data) => {
      if (method === 'listClasses') return [...classes, { ...classes[0], classId: 'c2', classCode: 'SE2' }];
      if (data.classId === 'c1') return new Promise(resolve => { resolveOld = resolve; });
      return { published: false };
    });
    const events = userEvent.setup(); render(<Student user={user} />);
    await waitFor(() => expect(resolveOld).toBeTypeOf('function'));
    await events.selectOptions(screen.getByRole('combobox', { name: 'Lớp học' }), 'c2');
    await screen.findByText('Giảng viên chưa công bố điểm.');
    resolveOld({ published: true, components: [{ id: 'p', name: 'STALE', maxScore: 10 }], grades: { p: 9 }, publishedAt: '2026-10-24T01:00:00Z', version: 1 });
    await waitFor(() => expect(screen.queryByText('STALE')).toBeNull());
  });
  it('opens chat from the launcher and preserves the draft when switching views and minimizing', async () => {
    mockApi(async method => {
      if (method === 'listClasses') return classes;
      if (method === 'getGroupPlan') return { groups: [{ id: 'g1', name: 'Nhóm 1' }], students: [] };
      if (method === 'getGroupMessages') return { messages: [], older: null };
      return { published: false };
    });
    const events = userEvent.setup(); render(<Student user={user} />);
    const launcher = await screen.findByRole('button', { name: 'Mở chat nhóm học tập' });
    expect(mocks.call.mock.calls.some(([method]) => method === 'getGroupPlan')).toBe(false);
    await events.click(launcher);
    await screen.findByRole('heading', { name: 'Nhóm 1' });
    await events.type(screen.getByRole('textbox', { name: 'Tin nhắn cho nhóm' }), 'Bản nháp');
    await events.click(screen.getByRole('button', { name: 'Tính điểm FE/PE' }));
    await events.click(screen.getByRole('button', { name: 'Thu gọn cửa sổ chat' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(launcher);
    await events.click(launcher);
    expect(screen.getByRole('textbox', { name: 'Tin nhắn cho nhóm' }).value).toBe('Bản nháp');
  });
});
