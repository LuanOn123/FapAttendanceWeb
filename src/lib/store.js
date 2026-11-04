// Lớp truy cập Firestore.
import {
  collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase.js";

const safeId = (s) => String(s).replace(/[\/#?\[\]*\u0000-\u001f]/g, "_").trim();
export const classId = (subject, className) => safeId(`${subject}__${className}`);

// ---------- Config (teacher allowlist) ----------
export async function getTeachers() {
  const snap = await getDoc(doc(db, "config", "app"));
  return snap.exists() ? snap.data().teachers || [] : [];
}
export async function setTeachers(emails) {
  const list = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  await setDoc(doc(db, "config", "app"), { teachers: list }, { merge: true });
  return list;
}

// ---------- Import một học kỳ ----------
// normalized = { semester, login, classes:[{subject, className, components:[str], students:[{roll,name,comment,grades}]}] }
// roster = map Roll(UPPER) -> { email, name, ... }
export async function importSemester(normalized, roster, onProgress) {
  const sem = normalized.semester;
  let ops = [];
  let batch = writeBatch(db);
  let pending = 0;
  const flush = async () => {
    if (pending > 0) { await batch.commit(); batch = writeBatch(db); pending = 0; }
  };
  const push = async (ref, data, opts) => {
    batch.set(ref, data, opts || {});
    pending++;
    if (pending >= 450) await flush();
  };

  await setDoc(doc(db, "semesters", sem), {
    semester: sem, login: normalized.login, updatedAt: Date.now(),
  }, { merge: true });

  let totalStudents = 0, matchedEmails = 0, missingEmails = [];
  let idx = 0;
  for (const c of normalized.classes) {
    const cid = classId(c.subject, c.className);
    const cref = doc(db, "semesters", sem, "classes", cid);
    // Giữ nguyên cờ studentEditable nếu lớp đã tồn tại (không ghi đè lúc nạp lại).
    const existing = await getDoc(cref);
    const prevFlags = {};
    if (existing.exists()) for (const comp of existing.data().components || []) prevFlags[comp.name] = !!comp.studentEditable;

    const components = c.components.map((name) => ({ name, studentEditable: prevFlags[name] || false }));
    const editableComponents = components.filter((x) => x.studentEditable).map((x) => x.name);

    await push(cref, {
      subject: c.subject, className: c.className, components, order: idx++,
    }, { merge: true });

    for (const s of c.students) {
      totalStudents++;
      const info = roster ? roster[String(s.roll).toUpperCase()] : null;
      const email = info?.email || "";
      if (email) matchedEmails++; else missingEmails.push(`${c.className}/${s.roll}`);
      const sref = doc(cref, "students", safeId(s.roll));
      await push(sref, {
        roll: s.roll, name: s.name, comment: s.comment || "",
        email, emailLower: email.toLowerCase(),
        grades: s.grades || {}, editableComponents,
      }, { merge: true });
    }
    if (onProgress) onProgress(`${c.className} (${c.students.length} SV)`);
  }
  await flush();
  return { totalStudents, matchedEmails, missingEmails };
}

// ---------- Admin đọc ----------
export async function listClasses(sem) {
  const snap = await getDocs(collection(db, "semesters", sem, "classes"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
export async function listStudents(sem, cid) {
  const snap = await getDocs(collection(db, "semesters", sem, "classes", cid, "students"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.roll.localeCompare(b.roll));
}
export async function listSemesters() {
  const snap = await getDocs(collection(db, "semesters"));
  return snap.docs.map((d) => d.id);
}

// ---------- Ghi điểm (giáo viên) ----------
export async function setStudentGrade(sem, cid, roll, component, value) {
  const sref = doc(db, "semesters", sem, "classes", cid, "students", safeId(roll));
  await updateDoc(sref, { [`grades.${component}`]: value });
}

// ---------- Bật/tắt quyền sinh viên cho 1 cột ----------
export async function setComponentEditable(sem, cid, component, editable) {
  const cref = doc(db, "semesters", sem, "classes", cid);
  const cls = (await getDoc(cref)).data();
  const components = (cls.components || []).map((x) =>
    x.name === component ? { ...x, studentEditable: editable } : x
  );
  const editableComponents = components.filter((x) => x.studentEditable).map((x) => x.name);
  await updateDoc(cref, { components });

  // Cập nhật editableComponents cho mọi sinh viên trong lớp.
  const students = await getDocs(collection(cref, "students"));
  let batch = writeBatch(db), n = 0;
  for (const d of students.docs) {
    batch.update(d.ref, { editableComponents });
    if (++n >= 450) { await batch.commit(); batch = writeBatch(db); n = 0; }
  }
  if (n > 0) await batch.commit();
  return editableComponents;
}

// ---------- Sinh viên: tìm bản ghi của mình theo email ----------
export async function findMyRecords(emailLower) {
  const q = query(collectionGroup(db, "students"), where("emailLower", "==", emailLower));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    // path: semesters/{sem}/classes/{cid}/students/{roll}
    const parts = d.ref.path.split("/");
    return { ref: d.ref, sem: parts[1], cid: parts[3], ...d.data() };
  });
}

// ---------- Sinh viên: tự cập nhật 1 cột được mở ----------
export async function studentUpdateGrade(ref, component, value) {
  await updateDoc(ref, { [`grades.${component}`]: value });
}

// Lấy cấu hình cột (tên + có được sửa không) của 1 lớp — cho trang sinh viên.
export async function getClassMeta(sem, cid) {
  const snap = await getDoc(doc(db, "semesters", sem, "classes", cid));
  return snap.exists() ? snap.data() : null;
}
