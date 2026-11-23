import express from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const rootDir = resolve('.');

const envPath = join(rootDir, '.env');
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

async function loadStaticRuntimeConfig() {
  const staticPath = join(rootDir, 'firebase-runtime-config.js');
  if (!existsSync(staticPath)) return {};
  try {
    const mod = await import(`./firebase-runtime-config.js?t=${Date.now()}`);
    return mod?.firebaseConfig || {};
  } catch {
    return {};
  }
}

async function loadFirebaseConfig() {
  const appletConfigPath = join(rootDir, 'firebase-applet-config.json');
  let appletConfig: Record<string, string> = {};
  if (existsSync(appletConfigPath)) {
    try {
      appletConfig = JSON.parse(readFileSync(appletConfigPath, 'utf8'));
    } catch {
      appletConfig = {};
    }
  }
  const staticConfig = await loadStaticRuntimeConfig();
  const baseConfig = appletConfig.apiKey ? appletConfig : staticConfig;

  return {
    apiKey: process.env.FIREBASE_API_KEY || baseConfig.apiKey || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || baseConfig.authDomain || '',
    projectId: process.env.FIREBASE_PROJECT_ID || baseConfig.projectId || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || baseConfig.storageBucket || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || baseConfig.messagingSenderId || '',
    appId: process.env.FIREBASE_APP_ID || baseConfig.appId || '',
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || baseConfig.measurementId || '',
  };
}

const blockedPrefixes = ['/functions', '/scripts', '/node_modules', '/.git', '/src'];
const blockedFiles = new Set([
  '/.env',
  '/.env.example',
  '/.firebaserc',
  '/.vercelignore',
  '/server.js',
  '/server.ts',
  '/package.json',
  '/package-lock.json',
  '/tsconfig.json',
  '/vite.config.ts',
  '/firebase-applet-config.json',
  '/firebase.json',
  '/firestore.rules',
  '/firestore.indexes.json',
  '/storage.rules',
  '/vercel.json',
  '/metadata.json',
]);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const HOST = '0.0.0.0';
  const isProd = process.env.NODE_ENV === 'production' && existsSync(join(rootDir, 'dist', 'index.html'));

  app.use((req, res, next) => {
    const reqPath = req.path.toLowerCase();
    const isSourceBlock = isProd && (reqPath === '/src' || reqPath.startsWith('/src/'));
    if (
      reqPath.startsWith('/.env') ||
      blockedFiles.has(reqPath) ||
      isSourceBlock ||
      ['/functions', '/scripts', '/node_modules', '/.git'].some(
        (prefix) => reqPath === prefix || reqPath.startsWith(prefix + '/')
      )
    ) {
      return res.status(404).send('Not Found');
    }
    next();
  });

  app.get('/api/firebase-config', async (_req, res) => {
    const config = await loadFirebaseConfig();
    res.setHeader('Cache-Control', 'no-store');
    res.json(config);
  });

  app.get('/firebase-runtime-config.js', async (_req, res) => {
    const config = await loadFirebaseConfig();
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(`window.__FIREBASE_CONFIG__ = ${JSON.stringify(config)};\nexport const firebaseConfig = ${JSON.stringify(config)};\n`);
  });

  if (isProd) {
    const distDir = join(rootDir, 'dist');
    app.use(express.static(distDir, { index: false }));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, HOST, () => {
    console.log(`Feastport Portal server running at http://${HOST}:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer();
