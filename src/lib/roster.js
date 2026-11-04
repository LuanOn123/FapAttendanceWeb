// Đọc file Excel danh sách lớp (Students_<Subject>_<Class>.xlsx).
// Cột chuẩn: TermName, SubjectCode, ClassName, RollNumber, FullName, Email.
// Trả về map: Roll (chữ HOA) -> { email, name, className, subject }.
import * as XLSX from "xlsx";

const norm = (s) => String(s ?? "").trim();

export async function parseRosterFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

  const byRoll = {};
  let count = 0;
  for (const r of rows) {
    // chấp nhận vài biến thể tên cột
    const roll = norm(r.RollNumber || r.Roll || r["Roll Number"] || r.MSSV);
    const email = norm(r.Email || r["Email Address"] || r.Mail);
    const name = norm(r.FullName || r.Name || r["Full Name"]);
    const className = norm(r.ClassName || r.Class);
    const subject = norm(r.SubjectCode || r.Subject);
    if (!roll) continue;
    byRoll[roll.toUpperCase()] = { email, name, className, subject };
    if (email) count++;
  }
  return { byRoll, emailCount: count, total: rows.length };
}

// Gộp nhiều file Excel lại thành 1 map chung.
export function mergeRosters(maps) {
  const all = {};
  for (const m of maps) Object.assign(all, m.byRoll);
  return all;
}
