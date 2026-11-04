// Integer arithmetic: score hundredths × percentage hundredths / 1,000,000.
// The requested rule is strictly > 5, before any display rounding.
const SCALE = 1_000_000, PASS = 5 * SCALE;
export function parseGradeNumber(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) return null;
  const number = Number(text.replace(',', '.'));
  return Number.isFinite(number) ? Math.round(number * 100) : null;
}
export function forecastGrades(rows) {
  const errors = [], normalized = [], examTypes = new Set();
  if (!Array.isArray(rows) || !rows.length || rows.length > 30) {
    return { errors: ['Cần từ 1 đến 30 cột điểm.'] };
  }
  rows.forEach((row, index) => {
    const label = `Cột ${index + 1}`, kind = row.kind;
    const weight = parseGradeNumber(row.weight), text = String(row.score ?? '').trim();
    const score = text === '' ? null : parseGradeNumber(text);
    if (!['known', 'FE', 'PE'].includes(kind)) errors.push(`${label}: chọn loại điểm hợp lệ.`);
    if (!String(row.name ?? '').trim() || String(row.name).length > 80) errors.push(`${label}: nhập tên tối đa 80 ký tự.`);
    if (weight == null || weight <= 0 || weight > 10000) errors.push(`${label}: trọng số phải lớn hơn 0 và không quá 100%.`);
    if (text !== '' && (score == null || score > 1000)) errors.push(`${label}: điểm phải từ 0 đến 10, tối đa 2 chữ số thập phân.`);
    if (kind === 'known' && text === '') errors.push(`${label}: nhập điểm đã có; chỉ FE/PE được để trống để tính.`);
    if (kind === 'FE' || kind === 'PE') {
      if (examTypes.has(kind)) errors.push(`Chỉ được có một cột ${kind}.`);
      examTypes.add(kind);
    }
    normalized.push({ ...row, weight, score });
  });
  const totalWeight = normalized.reduce((sum, row) => sum + (row.weight ?? 0), 0);
  if (totalWeight !== 10000) errors.push(`Tổng trọng số phải đúng 100% (hiện tại ${totalWeight / 100}%).`);
  if (errors.length) return { errors, totalWeight: totalWeight / 100 };
  const unknown = normalized.filter(row => row.score == null);
  const base = normalized.reduce((sum, row) => sum + (row.score ?? 0) * row.weight, 0);
  const maximum = base + unknown.reduce((sum, row) => sum + 1000 * row.weight, 0);
  const result = { errors, totalWeight: 100, current: base / SCALE, maximum: maximum / SCALE, unknown: unknown.map(r => r.kind) };
  if (!unknown.length) return { ...result, status: base > PASS ? 'passed' : 'failed', total: base / SCALE };
  if (maximum <= PASS) return { ...result, status: 'impossible' };
  // Recommend attainable exam marks in increments of 0.1; strict comparison avoids
  // recommending an equality boundary such as exactly 5.0 overall.
  function minimum(extraBase, weight) {
    for (let tenth = 0; tenth <= 100; tenth++) {
      if (extraBase + tenth * 10 * weight > PASS) return tenth / 10;
    }
    return null;
  }
  if (unknown.length === 1) {
    const exam = unknown[0], needed = minimum(base, exam.weight);
    return { ...result, status: 'single', exam: exam.kind, needed, total: (base + Math.round(needed * 100) * exam.weight) / SCALE };
  }
  const fe = unknown.find(row => row.kind === 'FE'), pe = unknown.find(row => row.kind === 'PE');
  const sameScore = minimum(base, fe.weight + pe.weight);
  const scenarios = Array.from({ length: 11 }, (_, peScore) => {
    const feScore = minimum(base + peScore * 100 * pe.weight, fe.weight);
    return { pe: peScore, fe: feScore, total: feScore == null ? null : (base + peScore * 100 * pe.weight + Math.round(feScore * 100) * fe.weight) / SCALE };
  });
  return { ...result, status: 'pair', sameScore, scenarios, total: (base + Math.round(sameScore * 100) * (fe.weight + pe.weight)) / SCALE };
}
