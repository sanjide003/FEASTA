import { readFileSync } from 'node:fs';

const source = (file) => readFileSync(file, 'utf8');
const staffAuth = source('src/lib/staffAuth.ts');
const adminPortal = source('src/pages/staff/AdminPortal.tsx');
const adminStaff = source('src/pages/staff/admin/AdminStaffTab.tsx');
const adminResults = source('src/pages/staff/admin/AdminResultsTab.tsx');
const adminSummary = source('src/pages/staff/admin/types.ts');
const team = source('src/pages/staff/TeamPortal.tsx');
const judge = source('src/pages/staff/JudgePortal.tsx');
const tv = source('src/pages/public/TvDisplayPage.tsx');
const tvControl = source('src/pages/staff/TvControlPage.tsx');
const home = source('src/pages/public/HomePage.tsx');
const results = source('src/pages/public/ResultsPage.tsx');
const rules = source('firestore.rules');

const contracts = {
  'role routes map cleanly':
    ["admin: '/admin'", "superAdmin: '/admin'", "teamLeader: '/team'", "judge: '/judge'"].every((value) =>
      staffAuth.includes(value)
    ),
  'admin profile gate':
    staffAuth.includes("doc(db, 'adminUsers', uid)") && adminPortal.includes('ADMIN_ROLES.has(p.role)'),
  'tv control admin gate':
    tvControl.includes('ADMIN_ROLES.has(p.role)'),
  'access creation uses Firebase Auth':
    adminStaff.includes('createSecondaryStaffAuthUser') &&
    adminStaff.includes("'adminUsers'") &&
    adminStaff.includes("'accessUsers'"),
  'team profile and strict team scope':
    team.includes("p.role !== 'teamLeader'") &&
    team.includes("where('team', '==', teamId)") &&
    team.includes("where('team', 'in', ['All', teamId])") &&
    rules.includes("hasAccessRole('teamLeader')"),
  'team registration CRUD and lock':
    team.includes("addDoc(collection(db, 'registrations')") &&
    team.includes("updateDoc(doc(db, 'registrations'") &&
    team.includes("deleteDoc(doc(db, 'registrations'") &&
    rules.includes('registrationsOpen()'),
  'judge profile and scoped assignments':
    judge.includes("p.role !== 'judge'") &&
    judge.includes("where('judgeId', 'in', judgeIds)") &&
    rules.includes('judgeOwnsAssignment'),
  'judge draft submit transaction':
    judge.includes("persistScores('draft')") &&
    judge.includes("persistScores('submitted')") &&
    judge.includes('runTransaction') &&
    rules.includes("resource.data.status == 'draft'") &&
    rules.includes('judgeOwnsAssignment(scoreId'),
  'admin direct publishing and revisions':
    adminResults.includes("batch.set(doc(db, 'results', ev.id)") &&
    adminResults.includes("batch.update(doc(db, 'judgeScores'") &&
    adminResults.includes("batch.set(doc(collection(db, 'auditLogs'))") &&
    adminSummary.includes("doc(db, 'settings', 'public_summary')") &&
    rules.includes('allow create, update, delete: if isAdmin();'),
  'public results published only':
    rules.includes("resource.data.status == 'published'") &&
    home.includes("where('status', '==', 'published')") &&
    results.includes("where('status', '==', 'published')") &&
    team.includes("where('status', '==', 'published')") &&
    tv.includes("where('status', '==', 'published')"),
  'default deny':
    rules.includes('match /{document=**}') && rules.includes('allow read, write: if false;'),
};

let failed = 0;
for (const [name, passed] of Object.entries(contracts)) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  failed ||= !passed;
}
if (failed) throw new Error('Role access contract check failed');
console.log('Role access contracts passed');
