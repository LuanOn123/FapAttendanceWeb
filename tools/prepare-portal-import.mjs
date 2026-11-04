import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { decodeFg, normalizeFg } from '../src/lib/fg.js';

export function preparePortalImport(normalized) {
  const code = value => String(value ?? '').trim().toUpperCase();
  if (!normalized.semester || !Array.isArray(normalized.classes)) throw new Error('Thiếu học kỳ hoặc danh sách lớp.');
  const seenClasses = new Set();
  const classes = normalized.classes.map(c => {
    const subjectCode = code(c.subject), classCode = code(c.className);
    const classKey = `${subjectCode}/${classCode}`;
    if (!subjectCode || !classCode || seenClasses.has(classKey)) throw new Error('Mã môn/lớp trống hoặc trùng.');
    seenClasses.add(classKey);
    if (!Array.isArray(c.components) || !c.components.length || c.components.length > 30 || new Set(c.components).size !== c.components.length) throw new Error(`Cột điểm không hợp lệ: ${classKey}`);
    const names = c.components.map(name => String(name).trim());
    if (names.some(name => !name || name.length > 100) || new Set(names).size !== names.length) throw new Error(`Tên cột điểm trống/trùng: ${classKey}`);
    const components = names.map(name => ({ id: 'c_' + crypto.createHash('sha256').update(name).digest('hex').slice(0, 24), name, maxScore: 10 }));
    const rolls = new Set();
    const students = c.students.map(s => {
      const studentCode = code(s.roll);
      if (!studentCode || rolls.has(studentCode)) throw new Error(`MSSV trống/trùng: ${classKey}`);
      rolls.add(studentCode);
      if (Object.keys(s.grades || {}).some(key => !c.components.includes(key))) throw new Error(`Điểm thuộc cột không xác định: ${classKey}/${studentCode}`);
      const grades = Object.fromEntries(components.map((comp, index) => {
        const raw = s.grades?.[c.components[index]];
        const value = raw == null || String(raw).trim() === '' ? '' : Number(raw);
        if (value !== '' && (!Number.isFinite(value) || value < 0 || value > comp.maxScore)) throw new Error(`Điểm ngoài thang 10: ${classKey}/${studentCode}/${comp.name}. Cần kiểm tra thang điểm nguồn trước khi chuyển.`);
        return [comp.id, value];
      }));
      return { studentCode, grades, comment: String(s.comment || '') };
    });
    return { semester: code(normalized.semester), subjectCode, classCode, components, students };
  });
  return { schemaVersion: 1, classes };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [, , input, output] = process.argv;
    if (!input || !output) throw new Error('Usage: node tools/prepare-portal-import.mjs <file.fg|normalized.json> <output.portal.json>');
    const text = fs.readFileSync(input, 'utf8');
    let normalized;
    if (/\.fg$/i.test(input)) normalized = normalizeFg(await decodeFg(text, process.env.FG_PASSWORD || ''));
    else { const data = JSON.parse(text); normalized = data.SubjectClassGrades ? normalizeFg(data) : data; }
    const result = preparePortalImport(normalized);
    fs.writeFileSync(output, JSON.stringify(result, null, 2), { encoding: 'utf8', flag: 'wx' });
    console.log(`Đã chuẩn bị ${result.classes.length} lớp. Chưa gửi hoặc công bố dữ liệu. Nhập file trên desktop để xem trước.`);
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
