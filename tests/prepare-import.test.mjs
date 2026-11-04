import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preparePortalImport } from '../tools/prepare-portal-import.mjs';
import { decodeFg, normalizeFg } from '../src/lib/fg.js';
import crypto from 'node:crypto';
const input = () => ({ semester: 'FA26', classes: [{ subject: 'PRM393', className: 'SE1', components: ['PE'], students: [{ roll: 'se001', grades: { PE: 0 }, comment: 'Good' }] }] });
test('migration retains zero and maps component names to stable safe IDs', () => {
  const r = preparePortalImport(input());
  assert.equal(r.classes[0].students[0].studentCode, 'SE001');
  const c = r.classes[0].components[0];
  assert.equal(r.classes[0].students[0].grades[c.id], 0);
  assert.equal(c.id, preparePortalImport(input()).classes[0].components[0].id);
});
test('migration rejects range errors and duplicate rolls instead of silently discarding grades', () => {
  const invalid = input(); invalid.classes[0].students[0].grades.PE = 11;
  assert.throws(() => preparePortalImport(invalid), /ngoài thang/);
  const duplicate = input(); duplicate.classes[0].students.push(duplicate.classes[0].students[0]);
  assert.throws(() => preparePortalImport(duplicate), /trống\/trùng/);
});
test('original FG decoder feeds migration without changing a zero grade', async () => {
  const raw = { Semester: 'FA26', SubjectClassGrades: [{ Subject: 'PRM393', Class: 'SE1', Components: ['PE'], Students: [{ Roll: 'SE001', Name: 'Student', Grades: [{ Component: 'PE', Grade: 0 }] }] }] };
  const encrypt = crypto.createCipheriv('aes-256-cbc', Buffer.from('l10ca968o8e4133tyne2ea2315g19377'), Buffer.alloc(16));
  const encrypted = Buffer.concat([encrypt.update(JSON.stringify(raw), 'utf8'), encrypt.final()]).toString('base64');
  const result = preparePortalImport(normalizeFg(await decodeFg(encrypted)));
  assert.equal(Object.values(result.classes[0].students[0].grades)[0], 0);
});
test('migration preserves values with whitespace in source column names', () => {
  const value = input(); value.classes[0].components = [' PE ']; value.classes[0].students[0].grades = { ' PE ': 8 };
  const result = preparePortalImport(value);
  assert.equal(result.classes[0].components[0].name, 'PE');
  assert.equal(Object.values(result.classes[0].students[0].grades)[0], 8);
});
