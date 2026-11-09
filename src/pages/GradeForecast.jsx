import { useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { forecastGrades, parseGradeNumber } from '../lib/gradeForecast.js';

const defaults = () => [
  { id: 1, name: 'Assignment', kind: 'known', weight: '', score: '' },
  { id: 2, name: 'PT', kind: 'known', weight: '', score: '' },
  { id: 3, name: 'Quiz', kind: 'known', weight: '', score: '' },
  { id: 4, name: 'FE', kind: 'FE', weight: '', score: '' },
];
const number = value => value.toLocaleString('vi-VN', { maximumFractionDigits: 6 });
export default function GradeForecast() {
  const [rows, setRows] = useState(defaults), [result, setResult] = useState(null);
  const nextId = useRef(5), output = useRef(null);
  const update = (id, key, value) => { setRows(current => current.map(row => row.id === id ? { ...row, [key]: value } : row)); setResult(null); };
  const add = kind => {
    if (rows.length >= 30 || (kind !== 'known' && rows.some(row => row.kind === kind))) return;
    setRows(current => [...current, { id: nextId.current++, name: kind === 'known' ? 'Lab' : kind, kind, weight: '', score: '' }]); setResult(null);
  };
  const weight = rows.reduce((sum, row) => sum + (parseGradeNumber(row.weight) ?? 0), 0) / 100;
  const calculate = event => {
    event.preventDefault(); setResult(forecastGrades(rows));
    // Move focus after React commits the result so keyboard users can find it.
    requestAnimationFrame(() => output.current?.focus());
  };
  return <section className="card forecast-card">
    <div className="card-heading"><div><span className="eyebrow">MỤC TIÊU QUA MÔN</span><h2>Cần bao nhiêu điểm thi?</h2></div><span className="heading-icon"><Icon name="spark" size={26} /></span></div>
    <p className="card-description">Nhập điểm đã có và trọng số theo syllabus. Để trống điểm FE hoặc PE cần tính.</p>
    <p className="muted">Kết quả xét tổng &gt; 5 và ngưỡng FE/PE đã nhập. Kiểm tra chuyên cần và điều kiện khác trong đề cương.</p>
    <div className="forecast-summary"><span>Thang điểm <strong>10</strong></span><span>Tổng trọng số <strong>{number(weight)} / 100%</strong></span><span>Mục tiêu <strong>Tổng &gt; 5</strong></span></div>
    <form onSubmit={calculate} noValidate>
      <div className="forecast-rows">{rows.map((row, index) => <fieldset className="forecast-row" key={row.id}>
        <legend>Cột {index + 1}{row.kind === 'known' ? '' : ` · ${row.kind}`}</legend>
        <div className="field"><label htmlFor={`forecast-name-${row.id}`}>Tên cột {index + 1}</label><input id={`forecast-name-${row.id}`} value={row.name} maxLength={80} readOnly={row.kind !== 'known'} onChange={e => update(row.id, 'name', e.target.value)} /></div>
        <div className="field"><label htmlFor={`forecast-weight-${row.id}`}>Trọng số cột {index + 1} (%)</label><input id={`forecast-weight-${row.id}`} inputMode="decimal" placeholder="VD: 20" value={row.weight} maxLength={12} onChange={e => update(row.id, 'weight', e.target.value)} /></div>
        <div className="field"><label htmlFor={`forecast-score-${row.id}`}>Điểm cột {index + 1} / 10</label><input id={`forecast-score-${row.id}`} inputMode="decimal" placeholder={row.kind === 'known' ? 'VD: 8,5' : 'Trống = cần tính'} value={row.score} maxLength={12} onChange={e => update(row.id, 'score', e.target.value)} /></div>
        <button className="icon-button forecast-remove" type="button" aria-label={`Xóa cột ${index + 1}: ${row.name}`} disabled={rows.length === 1} onClick={() => { setRows(current => current.filter(r => r.id !== row.id)); setResult(null); }}><Icon name="close" /></button>
        {row.kind !== 'known' && <div className="field forecast-minimum"><label htmlFor={`forecast-minimum-${row.id}`}>Điểm tối thiểu {row.kind} theo đề cương</label><input id={`forecast-minimum-${row.id}`} inputMode="decimal" value={row.minimum ?? '0'} maxLength={12} onChange={e => update(row.id, 'minimum', e.target.value)} /><small>0 = không áp dụng ngưỡng riêng</small></div>}
      </fieldset>)}</div>
      <div className="forecast-actions"><button type="button" disabled={rows.length >= 30} onClick={() => add('known')}>+ Cột điểm</button>{['FE', 'PE'].map(kind => <button key={kind} type="button" disabled={rows.length >= 30 || rows.some(row => row.kind === kind)} onClick={() => add(kind)}>+ {kind}</button>)}<button className="primary" type="submit"><Icon name="spark" />Tính điểm cần đạt</button></div>
    </form>
    {result && <section className={`forecast-result ${result.errors.length || result.status === 'impossible' || result.status === 'failed' ? 'forecast-warning' : ''}`} aria-label="Kết quả tính điểm" tabIndex={-1} ref={output}>
      {result.errors.length ? <><h3>Kiểm tra lại dữ liệu</h3><ul>{result.errors.map(error => <li key={error}>{error}</li>)}</ul></> : <>
        {result.status === 'single' && <><h3>{result.exam} cần ít nhất <strong>{number(result.needed)} / 10</strong></h3><p>Tổng dự kiến: <strong>{number(result.total)} / 10</strong> khi các điểm khác giữ nguyên.</p></>}
        {result.status === 'pair' && <><h3>Nếu hai bài thi bằng điểm nhau</h3><p className="forecast-target">FE và PE đều từ <strong>{number(result.sameScore)} / 10</strong></p><p>Tổng dự kiến: <strong>{number(result.total)} / 10</strong>. Hoặc chọn một cặp điểm bên dưới; hai mức điểm phải đi cùng nhau.</p>
          <div className="table-scroll"><table className="grades"><caption>Giả sử điểm PE, tính FE tối thiểu</caption><thead><tr><th>PE giả định</th><th>FE cần đạt</th><th>Tổng dự kiến</th></tr></thead><tbody>{result.scenarios.map(row => <tr key={row.pe}><td>{number(row.pe)}</td><td>{row.fe == null ? (row.reason ?? 'Không đủ dù FE = 10') : number(row.fe)}</td><td>{row.total == null ? '—' : number(row.total)}</td></tr>)}</tbody></table></div></>}
        {result.status === 'impossible' && <><h3>Chưa thể vượt 5 với các điểm đã nhập</h3><p>Dù phần thi còn lại đều đạt 10, tổng tối đa là <strong>{number(result.maximum)} / 10</strong>. Kiểm tra lại trọng số hoặc trao đổi với giảng viên về cách cải thiện điểm.</p></>}
        {result.status === 'passed' && <><h3>Tổng điểm đã vượt 5</h3><p>Tổng theo dữ liệu đã nhập: <strong>{number(result.total)} / 10</strong>.</p></>}
        {result.status === 'failed' && <><h3>Tổng điểm chưa vượt 5</h3><p>Tổng theo dữ liệu đã nhập: <strong>{number(result.total)} / 10</strong>. Xóa điểm FE/PE để tính mức điểm cần đạt.</p></>}
        <p className="muted">Điểm thi gợi ý theo bước 0,1. Tổng đúng 5 chưa đạt mục tiêu “trên 5”; phép tính dùng điểm chưa làm tròn.</p>
      </>}
    </section>}
    <details className="forecast-help"><summary>Công thức &amp; điều kiện</summary><p>Tổng = Σ (điểm từng cột × trọng số / 100). Một bài thi cần vượt (5 − tổng điểm đã quy đổi) ÷ (trọng số bài thi / 100) và đạt ngưỡng FE/PE đã nhập.</p><p>Dữ liệu chỉ ở màn hình hiện tại. Không gửi lên server và không thay đổi điểm giảng viên đã công bố.</p></details>
  </section>;
}
