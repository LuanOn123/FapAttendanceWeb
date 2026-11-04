import { before, after, test } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
let env;
const path = 'semesters/FA26/classes/PRM393__SE1/students/SE001';
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-fu-portal', firestore: { host: '127.0.0.1', port: 8089, rules: fs.readFileSync('firestore.rules', 'utf8') } });
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'config/app'), { teachers: ['teacher@fpt.edu.vn'] });
    await setDoc(doc(db, path), { roll: 'SE001', emailLower: 'student@fpt.edu.vn', grades: { PE: 9 }, editableComponents: ['PE'] });
  });
});
after(async () => { await env?.cleanup(); });
test('student cannot read own legacy grades or write a formerly editable column', async () => {
  const db = env.authenticatedContext('student', { email: 'student@fpt.edu.vn', email_verified: true }).firestore();
  await assertFails(getDoc(doc(db, path)));
  await assertFails(updateDoc(doc(db, path), { 'grades.PE': 10 }));
});
test('anonymous and other students cannot read legacy grades', async () => {
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), path)));
  const db = env.authenticatedContext('other', { email: 'other@fpt.edu.vn', email_verified: true }).firestore();
  await assertFails(getDoc(doc(db, path)));
});
test('registered verified teacher can still export legacy data for migration', async () => {
  const db = env.authenticatedContext('teacher', { email: 'teacher@fpt.edu.vn', email_verified: true }).firestore();
  await assertSucceeds(getDoc(doc(db, path)));
});
