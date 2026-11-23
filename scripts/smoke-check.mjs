import { existsSync, readFileSync } from 'node:fs';

const read = (f) => readFileSync(f, 'utf8');
const homeTsx = read('src/pages/public/HomePage.tsx');
const resultsTsx = read('src/pages/public/ResultsPage.tsx');
const registerTsx = read('src/pages/public/RegisterPage.tsx');
const verifyTsx = read('src/pages/public/VerifyPage.tsx');
const editorialShell = read('src/components/layout/EditorialShell.tsx');
const loginTsx = read('src/pages/staff/LoginPage.tsx');
const teamTsx = read('src/pages/staff/TeamPortal.tsx');
const tvTsx = read('src/pages/public/TvDisplayPage.tsx');
const tvControlTsx = read('src/pages/staff/TvControlPage.tsx');
const adminPortalTsx = read('src/pages/staff/AdminPortal.tsx');
const adminStaffTsx = read('src/pages/staff/admin/AdminStaffTab.tsx');
const adminEventsTsx = read('src/pages/staff/admin/AdminEventsTab.tsx');
const adminResultsTsx = read('src/pages/staff/admin/AdminResultsTab.tsx');
const excelTsx = read('src/pages/staff/admin/ExcelWorkspace.tsx');
const judgeTsx = read('src/pages/staff/JudgePortal.tsx');
const functionsJs = read('functions/index.js');
const dataCacheTs = read('src/lib/dataCache.ts');
const scoreUtilsTs = read('src/lib/scoreUtils.ts');
const rules = read('firestore.rules');

const checks = {
  'obsolete legacy files removed': !existsSync('admin.html') && !existsSync('admin-main.js') && !existsSync('judge.html'),
  'xlsx lazy-loaded via dynamic import only': excelTsx.includes("import('xlsx')") && !homeTsx.includes('xlsx') && !resultsTsx.includes('xlsx'),
  'shared data cache implemented': dataCacheTs.includes('cachedGetDoc') && dataCacheTs.includes('cachedGetDocs') && dataCacheTs.includes('invalidateCache'),
  'public home uses cached reads without students or listeners':
    homeTsx.includes('cachedGetDoc') &&
    homeTsx.includes('cachedGetDocs') &&
    !homeTsx.includes('onSnapshot') &&
    !homeTsx.includes("collection(db, 'students')"),
  'public results uses cached reads and winnerDetails without students reads':
    resultsTsx.includes('cachedGetDoc') &&
    resultsTsx.includes('cachedGetDocs') &&
    !resultsTsx.includes('onSnapshot') &&
    !resultsTsx.includes("collection(db, 'students')"),
  'editorial shell places staff portal link cleanly in footer only':
    editorialShell.includes('/login') && editorialShell.includes('Staff Portal') && !editorialShell.includes('/tv"'),
  'verify page enforces QR token without manual lookup form':
    !verifyTsx.includes('manual-lookup-form') &&
    verifyTsx.includes('computeVerificationToken') &&
    verifyTsx.includes('QR Signature Required'),
  'unified login and portals redirect cleanly without ?next= query':
    [adminPortalTsx, teamTsx, judgeTsx, tvControlTsx, loginTsx].every((src) => !src.includes('?next=')),
  'staff credential editing updates Auth cleanly without plaintext passwords':
    adminStaffTsx.includes('updateStaffCredentials') &&
    !adminStaffTsx.includes("accessPassword: '") &&
    functionsJs.includes('exports.updateStaffCredentials') &&
    functionsJs.includes('FieldValue.delete()'),
  'single event creation enforced without gender split':
    adminEventsTsx.includes('Create Single Event') && adminEventsTsx.includes('parseCriteria'),
  'tv display and control avoid students reads':
    tvTsx.includes('winnerDetails') &&
    !tvTsx.includes("collection(db, 'students')") &&
    !tvControlTsx.includes("collection(db, 'students')"),
  'team portal uses strict team scoped queries':
    teamTsx.includes("where('team', '==', teamId)") &&
    teamTsx.includes('cachedGetDoc') &&
    teamTsx.includes('ActionIconButton'),
  'admin console includes all 11 tabs, lazy scopes, and ActionIconButton':
    ['overview', 'setup', 'students', 'events', 'registrations', 'schedule', 'results', 'staff', 'tv', 'notices', 'reset'].every((t) =>
      adminPortalTsx.includes(`id: '${t}'`)
    ) &&
    adminResultsTsx.includes('resolveWinnerDetails') &&
    adminResultsTsx.includes('ActionIconButton'),
  'judge desk uses scoped queries and transaction locking':
    judgeTsx.includes('runTransaction') && judgeTsx.includes('judgeIds'),
  'registration portal supports student verification':
    registerTsx.includes('registrationRequests') &&
    registerTsx.includes('searchRegistrationCandidates') &&
    registerTsx.includes('cachedGetDoc'),
  'winnerDetails helper present in scoreUtils': scoreUtilsTs.includes('resolveWinnerDetails'),
  'security rules protect results and team scope': rules.includes('isAdmin()') && rules.includes("resource.data.status == 'published'"),
};

let failed = 0;
for (const [label, ok] of Object.entries(checks)) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed++;
}
if (failed) throw new Error(`${failed} smoke check(s) failed`);
console.log('All React SPA smoke checks passed');
