import { firebaseConfig as fallbackConfig } from '../firebase-runtime-config.js';

function resolveAllowedOrigin(origin) {
  if (!origin || typeof origin !== 'string') return '';
  if (
    origin === 'https://localhost' ||
    origin === 'http://localhost' ||
    origin === 'capacitor://localhost' ||
    origin === 'https://feastareact-nine.vercel.app' ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)
  ) {
    return origin;
  }
  return '';
}

function readVal(primary, secondary, fallback) {
  const candidates = [primary, secondary, fallback];
  for (const val of candidates) {
    const trimmed = String(val || '').trim();
    if (trimmed && !trimmed.includes('YOUR_')) return trimmed;
  }
  return '';
}

export default function handler(req, res) {
  const origin = req.headers?.origin || '';
  const allowedOrigin = resolveAllowedOrigin(origin);
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const config = {
    apiKey: readVal(process.env.FIREBASE_API_KEY, process.env.VITE_FIREBASE_API_KEY, fallbackConfig.apiKey),
    authDomain: readVal(
      process.env.FIREBASE_AUTH_DOMAIN,
      process.env.VITE_FIREBASE_AUTH_DOMAIN,
      fallbackConfig.authDomain
    ),
    projectId: readVal(process.env.FIREBASE_PROJECT_ID, process.env.VITE_FIREBASE_PROJECT_ID, fallbackConfig.projectId),
    storageBucket: readVal(
      process.env.FIREBASE_STORAGE_BUCKET,
      process.env.VITE_FIREBASE_STORAGE_BUCKET,
      fallbackConfig.storageBucket
    ),
    messagingSenderId: readVal(
      process.env.FIREBASE_MESSAGING_SENDER_ID,
      process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      fallbackConfig.messagingSenderId
    ),
    appId: readVal(process.env.FIREBASE_APP_ID, process.env.VITE_FIREBASE_APP_ID, fallbackConfig.appId),
    measurementId: readVal(
      process.env.FIREBASE_MEASUREMENT_ID,
      process.env.VITE_FIREBASE_MEASUREMENT_ID,
      fallbackConfig.measurementId
    ),
  };

  res.status(200).json(config);
}
