import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const requiredFiles = [
  'index.html',
  'server.ts',
  'vite.config.ts',
  'tsconfig.json',
  'storage.rules',
  'firestore.rules',
  'firebase-runtime-config.js',
  'src/main.tsx',
  'src/App.tsx',
  'src/index.css',
  'src/pages/public/HomePage.tsx',
  'src/pages/public/ResultsPage.tsx',
  'src/pages/public/RegisterPage.tsx',
  'src/pages/public/VerifyPage.tsx',
  'src/pages/public/TvDisplayPage.tsx',
  'src/pages/staff/LoginPage.tsx',
  'src/pages/staff/TeamPortal.tsx',
  'src/pages/staff/JudgePortal.tsx',
  'src/pages/staff/TvControlPage.tsx',
  'src/pages/staff/AdminPortal.tsx',
];

for (const file of requiredFiles) {
  if (!existsSync(file)) throw new Error(`Missing required source file: ${file}`);
  readFileSync(file, 'utf8');
}

const distHtml = readFileSync('dist/index.html', 'utf8');
if (!distHtml.includes('/assets/')) throw new Error('Built dist/index.html missing compiled Vite assets');

const assets = readdirSync(join('dist', 'assets'));
const mainEntry = assets.find((f) => f.startsWith('index-') && f.endsWith('.js'));
if (!mainEntry) throw new Error('Missing main index JS bundle in dist/assets');
const mainSource = readFileSync(join('dist', 'assets', mainEntry), 'utf8');
if (mainSource.includes('SheetJS') || mainSource.includes('xlsx')) {
  throw new Error('xlsx library must be lazy-loaded via dynamic import and excluded from main public entry chunk');
}

console.log('React SPA static & bundle check passed');
