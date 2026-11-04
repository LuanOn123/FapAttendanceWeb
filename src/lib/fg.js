// Đọc file FuGrade (.fg) ngay trên trình duyệt.
// .fg = base64( AES-256-CBC( JSON ) ), IV = 16 byte 0, padding PKCS7.
//   - Không mật khẩu  -> key = UTF8( DEFAULT_KEY )           (32 byte -> AES-256)
//   - Có mật khẩu      -> key = UTF8( md5hex(password) )      (32 byte -> AES-256)
import { md5Hex } from "./md5.js";

const DEFAULT_KEY = "l10ca968o8e4133tyne2ea2315g19377";

function b64ToBytes(b64) {
  const bin = atob(b64.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function aesCbcDecrypt(keyStr, cipherBytes) {
  const keyBytes = new TextEncoder().encode(keyStr); // 32 bytes
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, ["decrypt"]);
  const iv = new Uint8Array(16); // zeros
  const plain = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, cipherBytes);
  return new TextDecoder("utf-8").decode(plain);
}

/**
 * Giải mã .fg -> object JSON.
 * @param {string} base64Text nội dung file .fg (text)
 * @param {string} [password] mật khẩu nếu file có đặt (để trống nếu không)
 */
export async function decodeFg(base64Text, password = "") {
  const cipher = b64ToBytes(base64Text);
  const keyStr = password ? md5Hex(password) : DEFAULT_KEY;
  let json;
  try {
    json = await aesCbcDecrypt(keyStr, cipher);
  } catch (e) {
    throw new Error(
      password
        ? "Giải mã thất bại — sai mật khẩu?"
        : "Giải mã thất bại — có thể file có đặt mật khẩu, hãy nhập mật khẩu."
    );
  }
  let obj;
  try {
    obj = JSON.parse(json);
  } catch {
    throw new Error("Giải mã xong nhưng nội dung không phải JSON hợp lệ (sai mật khẩu?).");
  }
  return obj; // { Version, Semester, Login, Password, SubjectClassGrades:[...] }
}

/**
 * Chuẩn hoá object .fg thành cấu trúc dùng cho app.
 * grade item .fg: { Component, Grade }  -> gộp thành map { [component]: grade }
 */
export function normalizeFg(obj) {
  const semester = obj.Semester || "Unknown";
  const classes = (obj.SubjectClassGrades || []).map((c) => {
    const grades = {};
    const studentsGradeMap = {};
    for (const s of c.Students || []) {
      const g = {};
      for (const item of s.Grades || []) {
        if (item && item.Component != null) g[item.Component] = item.Grade ?? "";
      }
      studentsGradeMap[s.Roll] = g;
    }
    return {
      subject: c.Subject,
      className: c.Class,
      components: c.Components || [],
      students: (c.Students || []).map((s) => ({
        roll: s.Roll,
        name: s.Name,
        comment: s.Comment || "",
        grades: studentsGradeMap[s.Roll] || {},
      })),
    };
  });
  return { semester, login: obj.Login || "", classes };
}
