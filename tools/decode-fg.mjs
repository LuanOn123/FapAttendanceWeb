// Decrypt a FuGrade .fg file. The FuGrade tool (.NET) uses an "AesOperation"
// pattern: AES-CBC, key derived from the password via MD5, base64 wrapper.
// We don't know the exact derivation for certain, so we try a matrix of the
// common C# variants and keep whichever one yields valid JSON.
//
// Usage:  node decode-fg.mjs <file.fg> <password>
import crypto from "node:crypto";
import fs from "node:fs";

const [, , file, password] = process.argv;
if (!file || password === undefined) {
  console.error("Usage: node decode-fg.mjs <file.fg> <password>");
  process.exit(1);
}

const outer = fs.readFileSync(file, "utf8").trim();
const cipher = Buffer.from(outer, "base64"); // .fg is base64 of the AES bytes

const md5Hex = (s, up = false) => {
  const h = crypto.createHash("md5").update(s, "utf8").digest("hex");
  return up ? h.toUpperCase() : h;
};
const zeros = (n) => Buffer.alloc(n, 0);

// Candidate (algorithm, key, iv) triples to try.
const keyHexLower = Buffer.from(md5Hex(password, false), "utf8"); // 32 bytes -> aes-256
const keyHexUpper = Buffer.from(md5Hex(password, true), "utf8");  // 32 bytes -> aes-256
const keyMd5Raw = crypto.createHash("md5").update(password, "utf8").digest(); // 16 bytes -> aes-128
const keyUtf8 = Buffer.from(password, "utf8");

const candidates = [
  ["aes-256-cbc", keyHexLower, zeros(16), "md5hex(lower) key, IV=0"],
  ["aes-256-cbc", keyHexUpper, zeros(16), "md5hex(UPPER) key, IV=0"],
  ["aes-256-cbc", keyHexLower, keyHexLower.subarray(0, 16), "md5hex(lower) key, IV=first16 of key"],
  ["aes-128-cbc", keyMd5Raw, zeros(16), "md5raw(16) key, IV=0"],
  ["aes-128-cbc", keyMd5Raw, keyMd5Raw, "md5raw(16) key, IV=key"],
  ["aes-256-ecb", keyHexLower, null, "md5hex(lower) key, ECB"],
  ["aes-128-ecb", keyMd5Raw, null, "md5raw(16) key, ECB"],
];

// padded/truncated raw UTF8 key variants (some snippets do aes.Key=UTF8(key))
for (const [alg, size] of [["aes-128-cbc", 16], ["aes-192-cbc", 24], ["aes-256-cbc", 32]]) {
  const k = Buffer.alloc(size);
  keyUtf8.copy(k);
  candidates.push([alg, k, zeros(16), `utf8(password) padded to ${size}, IV=0`]);
}

function tryDecrypt(alg, key, iv) {
  try {
    const d = crypto.createDecipheriv(alg, key, iv);
    let out = Buffer.concat([d.update(cipher), d.final()]);
    return out.toString("utf8");
  } catch {
    return null;
  }
}

const looksJson = (s) =>
  s && /[\{\[]/.test(s[0]) && (() => { try { JSON.parse(s); return true; } catch { return false; } })();

let found = null;
for (const [alg, key, iv, label] of candidates) {
  const txt = tryDecrypt(alg, key, iv);
  if (looksJson(txt)) {
    found = { label, txt };
    console.error("MATCH:", label);
    break;
  }
}

if (!found) {
  console.error("No scheme produced valid JSON. Tried:");
  for (const c of candidates) console.error("  -", c[3]);
  console.error("Password may be wrong, or key derivation differs. Share the IL of EncryptString if so.");
  process.exit(2);
}

// Pretty-print and save
const obj = JSON.parse(found.txt);
const outPath = file.replace(/\.fg$/i, "") + ".decoded.json";
fs.writeFileSync(outPath, JSON.stringify(obj, null, 2), "utf8");
console.error("Saved ->", outPath);
console.log(JSON.stringify(obj, null, 2).slice(0, 2000));
