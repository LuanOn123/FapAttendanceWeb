import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({ portal: vi.fn(), signup: vi.fn() }));
vi.mock('../lib/api.js', () => ({
  portalCall: mocks.portal,
  firebaseGroupSignup: mocks.signup,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

it('saves a Firebase choice and loads the selected group without opening a Sheet', async () => {
  vi.stubEnv('VITE_FIREBASE_GROUP_SIGNUP', 'true');
  const { default: StudyGroups } = await import('./StudyGroups.jsx');
  const groups = [{ id: 'g1', name: 'Nhóm 1' }, { id: 'g2', name: 'Nhóm 2' }];
  let choice = null;
  mocks.signup.mockImplementation(async (request) => {
    if (request.action === 'plan') {
      return { groups: choice ? [{ ...groups.find(g => g.id === choice), memberIds: ['s1'] }] : [], students: [] };
    }
    if (request.action === 'choose') choice = request.groupId;
    return { state: 'OPEN', roundId: 'round-1', groups, selectedGroupId: choice };
  });
  mocks.portal.mockImplementation(async (method) => {
    if (method === 'getGroupMessages') return { messages: [], older: null };
    throw new Error('Unexpected API ' + method);
  });
  render(<StudyGroups classId="c1" />);
  const field = await screen.findByRole('combobox', { name: 'Chọn nhóm' });
  await userEvent.selectOptions(field, 'g2');
  await waitFor(() => expect(mocks.portal).toHaveBeenCalledWith('getGroupMessages', { classId: 'c1', groupId: 'g2' }));
  expect(mocks.signup).toHaveBeenCalledWith({ action: 'choose', classId: 'c1', roundId: 'round-1', groupId: 'g2' });
  expect(mocks.portal.mock.calls.some(([method]) => method === 'getGroupSignupSheet')).toBe(false);
  expect(screen.queryByRole('link', { name: /Google Sheets/ })).toBeNull();
});
