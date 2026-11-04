import { useEffect, useState } from "react";
import { decodeFg, normalizeFg } from "../lib/fg.js";
import { parseRosterFile, mergeRosters } from "../lib/roster.js";
import {
  importSemester, listSemesters, listClasses, listStudents,
  setStudentGrade, setComponentEditable, getTeachers, setTeachers,
} from "../lib/store.js";

export default function Admin({ user }) {
  const [tab, setTab] = useState("import");
  return (
    <main className="wrap">
      <div className="tabs">
        <button className={tab === "import" ? "tab active" : "tab"} onClick={() => setTab("import")}>Nạp dữ liệu</button>
        <button className={tab === "grade" ? "tab active" : "tab"} onClick={() => setTab("grade")}>Chấm điểm</button>
        <button className={tab === "teachers" ? "tab active" : "tab"} onClick={() => setTab("teachers")}>Giáo viên</button>
      </div>
      {tab === "import" && <ImportTab />}
      {tab === "grade" && <GradeTab />}
      {tab === "teachers" && <TeachersTab />}
    </main>
  );
}

/* ---------------- Nạp dữ liệu ---------------- */
function ImportTab() {
  const [fgFile, setFgFile] = useState(null);
  const [password, setPassword] = useState("");
  const [rosterFiles, setRosterFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const [result, setResult] = useState(null);
  const addLog = (m) => setLog((l) => [...l, m]);

  const run = async () => {
    if (!fgFile) return;
    setBusy(true); setLog([]); setResult(null);
    try {
      addLog("Đang đọc file .fg…");
      const text = await fgFile.text();
      const obj = await decodeFg(text, password);
      const normalized = normalizeFg(obj);
      addLog(`Giải mã OK: học kỳ ${normalized.semester}, ${normalized.classes.length} lớp.`);

      let roster = null;
      if (rosterFiles.length) {
        addLog(`Đọc ${rosterFiles.length} file Excel danh sách lớp…`);
        const maps = [];
        for (const f of rosterFiles) maps.push(await parseRosterFile(f));
        roster = mergeRosters(maps);
        addLog(`Tổng số email trong Excel: ${Object.values(roster).filter((x) => x.email).length}`);
      } else {
        addLog("⚠ Không có file Excel — sinh viên sẽ chưa có email để đăng nhập.");
      }

      addLog("Đang ghi lên Firestore…");
      const res = await importSemester(normalized, roster, (m) => addLog("  • " + m));
      setResult(res);
      addLog("✅ Hoàn tất.");
    } catch (e) {
      addLog("❌ " + (e.message || String(e)));
    } finally { setBusy(false); }
  };

  return (
    <div className="card">
      <h2>Nạp học kỳ mới</h2>
      <ol className="steps">
        <li>
          <b>File .fg</b> (xuất từ FuGrade):{" "}
          <input type="file" accept=".fg" onChange={(e) => setFgFile(e.target.files[0])} />
        </li>
        <li>
          <b>Mật khẩu .fg</b> (bỏ trống nếu file không đặt mật khẩu):{" "}
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="(không có)" />
        </li>
        <li>
          <b>File Excel danh sách lớp</b> (chọn nhiều file, cần cột Email):{" "}
          <input type="file" accept=".xlsx,.xls" multiple onChange={(e) => setRosterFiles([...e.target.files])} />
        </li>
      </ol>
      <button className="primary" disabled={!fgFile || busy} onClick={run}>
        {busy ? "Đang nạp…" : "Nạp dữ liệu"}
      </button>

      {result && (
        <div className="result">
          <p>✅ Đã nạp {result.totalStudents} sinh viên, khớp email: <b>{result.matchedEmails}</b>.</p>
          {result.missingEmails.length > 0 && (
            <details>
              <summary>{result.missingEmails.length} sinh viên chưa có email</summary>
              <div className="missing">{result.missingEmails.join(", ")}</div>
            </details>
          )}
        </div>
      )}
      {log.length > 0 && <pre className="logbox">{log.join("\n")}</pre>}
    </div>
  );
}

/* ---------------- Chấm điểm ---------------- */
function GradeTab() {
  const [semesters, setSemesters] = useState([]);
  const [sem, setSem] = useState("");
  const [classes, setClasses] = useState([]);
  const [cid, setCid] = useState("");
  const [cls, setCls] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { listSemesters().then((s) => { setSemesters(s); if (s[0]) setSem(s[0]); }); }, []);
  useEffect(() => { if (sem) listClasses(sem).then(setClasses); }, [sem]);
  useEffect(() => {
    if (sem && cid) {
      setLoading(true);
      const c = classes.find((x) => x.id === cid);
      setCls(c);
      listStudents(sem, cid).then((s) => { setStudents(s); setLoading(false); });
    }
  }, [sem, cid]);

  const toggleEditable = async (compName, val) => {
    await setComponentEditable(sem, cid, compName, val);
    const c = await listClasses(sem);
    setClasses(c); setCls(c.find((x) => x.id === cid));
    setStudents(await listStudents(sem, cid));
  };

  const saveGrade = async (roll, comp, value) => {
    await setStudentGrade(sem, cid, roll, comp, value);
  };

  const comps = cls?.components || [];

  return (
    <div className="card">
      <h2>Chấm điểm</h2>
      <div className="row">
        <label>Học kỳ:
          <select value={sem} onChange={(e) => { setSem(e.target.value); setCid(""); setCls(null); setStudents([]); }}>
            {semesters.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Lớp:
          <select value={cid} onChange={(e) => setCid(e.target.value)}>
            <option value="">— chọn lớp —</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.className} ({c.subject})</option>)}
          </select>
        </label>
      </div>

      {comps.length > 0 && (
        <div className="editable-toggles">
          <b>Cho sinh viên tự cập nhật cột:</b>
          {comps.map((c) => (
            <label key={c.name} className="chk">
              <input type="checkbox" checked={!!c.studentEditable}
                onChange={(e) => toggleEditable(c.name, e.target.checked)} />
              {c.name}
            </label>
          ))}
        </div>
      )}

      {loading ? <p>Đang tải…</p> : cid && (
        <div className="grid-scroll">
          <table className="grades grid">
            <thead>
              <tr>
                <th>MSSV</th><th>Họ tên</th><th>Email</th>
                {comps.map((c) => <th key={c.name}>{c.name}{c.studentEditable ? " ✎" : ""}</th>)}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.roll}</td>
                  <td>{s.name}</td>
                  <td className={s.email ? "" : "nomail"}>{s.email || "(thiếu email)"}</td>
                  {comps.map((c) => (
                    <td key={c.name}>
                      <GradeCell value={s.grades?.[c.name] ?? ""}
                        onSave={(v) => saveGrade(s.roll, c.name, v)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GradeCell({ value, onSave }) {
  const [val, setVal] = useState(value);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setVal(value); setDirty(false); }, [value]);
  const commit = async () => { if (dirty) { await onSave(val); setDirty(false); } };
  return (
    <input className="grade-input sm" value={val}
      onChange={(e) => { setVal(e.target.value); setDirty(true); }}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }} />
  );
}

/* ---------------- Giáo viên (allowlist) ---------------- */
function TeachersTab() {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { getTeachers().then((t) => setText(t.join("\n"))); }, []);
  const save = async () => {
    setMsg("");
    try {
      const list = await setTeachers(text.split(/[\n,;]+/));
      setText(list.join("\n")); setMsg("✓ Đã lưu danh sách giáo viên.");
    } catch (e) { setMsg("✗ " + (e.code || e.message)); }
  };
  return (
    <div className="card">
      <h2>Danh sách giáo viên được quyền quản trị</h2>
      <p className="muted">Mỗi email một dòng. (phuonglhk@fpt.edu.vn luôn là quản trị gốc.)</p>
      <textarea rows="6" value={text} onChange={(e) => setText(e.target.value)} />
      <div><button className="primary" onClick={save}>Lưu</button> <span className="save-msg">{msg}</span></div>
    </div>
  );
}
