import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GradeForecast from './GradeForecast.jsx';
afterEach(cleanup);
async function fill(events) {
  for (let index = 1; index <= 3; index++) {
    await events.type(screen.getByLabelText(`Trọng số cột ${index} (%)`), '20');
    await events.type(screen.getByLabelText(`Điểm cột ${index} / 10`), '5');
  }
  await events.type(screen.getByLabelText('Trọng số cột 4 (%)'), '40');
}
it('shows FE requirement and invalidates stale results immediately after editing', async () => {
  const events = userEvent.setup(); render(<GradeForecast />);
  await fill(events);
  await events.click(screen.getByRole('button', { name: 'Tính điểm cần đạt' }));
  expect(screen.getByRole('heading', { name: 'FE cần ít nhất 5,1 / 10' })).toBeTruthy();
  await events.type(screen.getByLabelText('Điểm cột 1 / 10'), '1');
  expect(screen.queryByRole('region', { name: 'Kết quả tính điểm' })).toBeNull();
  await events.click(screen.getByRole('button', { name: 'Tính điểm cần đạt' }));
  expect(screen.getByRole('heading', { name: 'Kiểm tra lại dữ liệu' })).toBeTruthy();
});
it('supports FE plus PE scenarios and prevents adding the same exam twice', async () => {
  const events = userEvent.setup(); render(<GradeForecast />);
  await fill(events);
  await events.click(screen.getByRole('button', { name: '+ PE' }));
  expect(screen.getByRole('button', { name: '+ PE' }).disabled).toBe(true);
  await events.clear(screen.getByLabelText('Trọng số cột 4 (%)'));
  await events.type(screen.getByLabelText('Trọng số cột 4 (%)'), '20');
  await events.type(screen.getByLabelText('Trọng số cột 5 (%)'), '20');
  await events.click(screen.getByRole('button', { name: 'Tính điểm cần đạt' }));
  expect(screen.getByRole('heading', { name: 'Nếu hai bài thi bằng điểm nhau' })).toBeTruthy();
  expect(screen.getByRole('table', { name: 'Giả sử điểm PE, tính FE tối thiểu' })).toBeTruthy();
  expect(screen.getByText('5,1 / 10')).toBeTruthy();
});
it('reports incomplete input rather than treating missing continuous grades as zero', async () => {
  const events = userEvent.setup(); render(<GradeForecast />);
  await events.click(screen.getByRole('button', { name: 'Tính điểm cần đạt' }));
  expect(screen.getByRole('heading', { name: 'Kiểm tra lại dữ liệu' })).toBeTruthy();
  expect(screen.getByText(/Cột 1: nhập điểm đã có/)).toBeTruthy();
  expect(screen.queryByText(/cần ít nhất/)).toBeNull();
});
