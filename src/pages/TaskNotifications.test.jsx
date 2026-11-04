import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const mocks = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock('../lib/api.js', () => ({ portalCall: mocks.call, portalEndpoint: 'configured', vietnamDate: () => '2026-11-04', leaveStatuses: {} }));
import TaskNotifications, { useTaskNotifications, taskTime } from './TaskNotifications.jsx';
import Student from './Student.jsx';
function Harness({ uid = 'u1' }) { const inbox = useTaskNotifications(uid); return <TaskNotifications inbox={inbox} />; }
const notification = (id = 'n1') => ({ id, readAt: '', createdAt: '2026-11-04T03:00:00Z', task: { id: 't1', classId: 'c1', groupId: 'g1', groupName: 'Nhóm 1', title: 'Hoàn thành lab', description: 'Viết báo cáo và chuẩn bị demo.', dueAt: '2026-11-05T16:59:00.000Z' } });
const page = (notifications = [notification()], extra = {}) => ({ notifications, unreadCount: notifications.filter(n => !n.readAt).length, older: null, ...extra });
beforeEach(() => { mocks.call.mockReset(); window.history.replaceState(null, '', '/'); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('requires opening a task before acknowledging, and confirms actual read state', async () => {
  let read = false;
  mocks.call.mockImplementation(async method => {
    if (method === 'readTaskNotification') { read = true; return { saved: true, readAt: '2026-11-04T04:00:00Z' }; }
    return page([{ ...notification(), readAt: read ? '2026-11-04T04:00:00Z' : '' }]);
  });
  const events = userEvent.setup(); render(<Harness />);
  const open = await screen.findByRole('button', { name: 'Hoàn thành lab' });
  expect(screen.queryByText('Viết báo cáo và chuẩn bị demo.')).toBeNull();
  expect(mocks.call.mock.calls.some(c => c[0] === 'readTaskNotification')).toBe(false);
  await events.click(open);
  expect(await screen.findByText('Viết báo cáo và chuẩn bị demo.')).toBeTruthy();
  await screen.findByText('0 chưa đọc');
  expect(mocks.call).toHaveBeenCalledWith('readTaskNotification', { notificationId: 'n1' });
  await events.click(open);
  expect(mocks.call.mock.calls.filter(c => c[0] === 'readTaskNotification')).toHaveLength(1);
  expect(taskTime(notification().task.dueAt)).toContain('23:59');
});

it('keeps unread after an acknowledgement failure and allows a retry', async () => {
  let attempts = 0;
  mocks.call.mockImplementation(async method => {
    if (method === 'readTaskNotification') { attempts++; throw Error('offline'); }
    return page();
  });
  const events = userEvent.setup(); render(<Harness />);
  const open = await screen.findByRole('button', { name: 'Hoàn thành lab' });
  await events.click(open); await screen.findByText(/Chưa lưu trạng thái đã đọc/);
  expect(screen.getByText('1 chưa đọc')).toBeTruthy();
  await events.click(open); expect(attempts).toBe(2);
});

it('hides cached tasks when refresh cannot verify current membership', async () => {
  mocks.call.mockResolvedValue(page()); const events = userEvent.setup(); render(<Harness />);
  await screen.findByRole('button', { name: 'Hoàn thành lab' });
  mocks.call.mockRejectedValue(Error('Không còn thuộc nhóm'));
  await events.click(screen.getByRole('button', { name: 'Tải lại thông báo' }));
  await screen.findByRole('alert'); expect(screen.queryByRole('button', { name: 'Hoàn thành lab' })).toBeNull();
  expect(screen.queryByText('Chưa có việc được giao')).toBeNull();
});

it('discards a late notification response after switching accounts', async () => {
  let resolveOld;
  mocks.call.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValue(page([]));
  const view = render(<Harness uid="old" />);
  view.rerender(<Harness uid="new" />); await screen.findByText('Chưa có việc được giao');
  await act(async () => { resolveOld(page()); });
  expect(screen.queryByRole('button', { name: 'Hoàn thành lab' })).toBeNull();
});

it('paginates by server cursor and renders task content as text', async () => {
  const first = notification(); first.task.title = '<img src=x onerror=bad()>';
  mocks.call.mockImplementation(async (method, data) => data.before ? page([notification('n2')]) : page([first], { older: 'n1' }));
  const events = userEvent.setup(); render(<Harness />);
  await screen.findByRole('button', { name: first.task.title });
  expect(document.querySelector('img')).toBeNull();
  await events.click(screen.getByRole('button', { name: 'Thông báo cũ hơn' }));
  await screen.findByRole('button', { name: 'Hoàn thành lab' });
  expect(mocks.call).toHaveBeenCalledWith('listMyTaskNotifications', { before: 'n1' });
});

it('email #tasks link opens notifications without requiring class selection', async () => {
  window.history.replaceState(null, '', '/#tasks');
  mocks.call.mockImplementation(async method => method === 'listClasses' ? [] : page());
  render(<Student user={{ uid: 'u1' }} />);
  expect(await screen.findByRole('button', { name: 'Hoàn thành lab' })).toBeTruthy();
  expect(screen.queryByRole('combobox', { name: 'Lớp học' })).toBeNull();
});

it('polls only while visible and stops after unmount', async () => {
  vi.useFakeTimers(); mocks.call.mockResolvedValue(page([]));
  const view = render(<Harness />);
  await act(async () => {});
  const initial = mocks.call.mock.calls.length;
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  await act(async () => { vi.advanceTimersByTime(30000); });
  expect(mocks.call.mock.calls.length).toBe(initial);
  hidden.mockReturnValue(false);
  await act(async () => { vi.advanceTimersByTime(30000); });
  expect(mocks.call.mock.calls.length).toBe(initial + 1);
  view.unmount();
  await act(async () => { vi.advanceTimersByTime(60000); });
  expect(mocks.call.mock.calls.length).toBe(initial + 1);
  hidden.mockRestore();
});
