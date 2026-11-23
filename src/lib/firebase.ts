import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  setPersistence,
  signOut,
  type Auth,
} from 'firebase/auth';
import { enableIndexedDbPersistence, getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { Capacitor } from '@capacitor/core';
import { firebaseConfig as staticFallbackConfig } from '../../firebase-runtime-config.js';

export interface RuntimeFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

const FIREBASE_CONFIG_CACHE_KEY = 'feastport_firebase_runtime_cfg';
const REMOTE_WEB_ORIGIN = 'https://feastareact-nine.vercel.app';

const emptyConfig: RuntimeFirebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
  measurementId: '',
};

const envConfig: Partial<RuntimeFirebaseConfig> = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

function readCachedFirebaseConfig(): Partial<RuntimeFirebaseConfig> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(FIREBASE_CONFIG_CACHE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeCachedFirebaseConfig(cfg: RuntimeFirebaseConfig) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FIREBASE_CONFIG_CACHE_KEY, JSON.stringify(cfg));
  } catch {
    // Ignore storage errors
  }
}

function mergeUsableConfig(...sources: Array<Partial<RuntimeFirebaseConfig> | null | undefined>): RuntimeFirebaseConfig {
  const merged: RuntimeFirebaseConfig = { ...emptyConfig };
  for (const src of sources) {
    if (!src) continue;
    for (const key of Object.keys(emptyConfig) as Array<keyof RuntimeFirebaseConfig>) {
      const val = String(src[key] || '').trim();
      if (val && !val.includes('YOUR_')) {
        merged[key] = val;
      }
    }
  }
  return merged;
}

let resolvedConfig: RuntimeFirebaseConfig = mergeUsableConfig(
  readCachedFirebaseConfig(),
  staticFallbackConfig,
  envConfig,
  (globalThis as any).__FIREBASE_CONFIG__
);

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;
let functionsInstance: Functions | null = null;
let initialized = false;
let persistenceAttempted = false;

function hasUsableConfig(cfg: Partial<RuntimeFirebaseConfig> | null | undefined): boolean {
  return Boolean(cfg && cfg.apiKey && cfg.projectId && !String(cfg.apiKey).includes('YOUR_'));
}

function ensureFirebaseInstances(cfg: RuntimeFirebaseConfig) {
  if (!hasUsableConfig(cfg)) return;
  if (!appInstance) {
    appInstance = getApps().length ? getApp() : initializeApp(cfg);
    authInstance = getAuth(appInstance);
    dbInstance = getFirestore(appInstance);
    storageInstance = getStorage(appInstance);
    functionsInstance = getFunctions(appInstance);
    if (typeof window !== 'undefined') {
      setPersistence(authInstance, browserLocalPersistence).catch(() => {});
      if (!persistenceAttempted && dbInstance) {
        persistenceAttempted = true;
        enableIndexedDbPersistence(dbInstance).catch(() => {});
      }
    }
  }
}

ensureFirebaseInstances(resolvedConfig);

async function fetchRemoteConfigFromOrigin(origin: string): Promise<Partial<RuntimeFirebaseConfig> | null> {
  try {
    const resp = await fetch(`${origin}/api/firebase-config`, { cache: 'no-store' });
    const contentType = resp.headers.get('content-type') || '';
    if (resp.ok && contentType.includes('application/json')) {
      const json = await resp.json();
      if (hasUsableConfig(json)) return json;
    }
  } catch {
    // Ignore and try JS fallback if remote
  }
  return null;
}

export async function bootstrapFirebase(): Promise<RuntimeFirebaseConfig> {
  if (initialized) return resolvedConfig;
  initialized = true;
  if (typeof window !== 'undefined') {
    const localJson = Capacitor.isNativePlatform() ? null : await fetchRemoteConfigFromOrigin('');
    if (localJson) {
      resolvedConfig = mergeUsableConfig(resolvedConfig, localJson);
      writeCachedFirebaseConfig(resolvedConfig);
    } else if (!hasUsableConfig(resolvedConfig) && Capacitor.isNativePlatform()) {
      const remoteJson = await fetchRemoteConfigFromOrigin(REMOTE_WEB_ORIGIN);
      if (remoteJson) {
        resolvedConfig = mergeUsableConfig(resolvedConfig, remoteJson);
        writeCachedFirebaseConfig(resolvedConfig);
      }
    } else if (hasUsableConfig(resolvedConfig) && Capacitor.isNativePlatform()) {
      writeCachedFirebaseConfig(resolvedConfig);
    }
  }
  ensureFirebaseInstances(resolvedConfig);
  return resolvedConfig;
}

export function getFirebaseState() {
  ensureFirebaseInstances(resolvedConfig);
  return {
    app: appInstance,
    auth: authInstance as Auth,
    db: dbInstance as Firestore,
    storage: storageInstance as FirebaseStorage,
    functions: functionsInstance as Functions,
    config: resolvedConfig,
    isFirebaseConfigured: hasUsableConfig(resolvedConfig) && Boolean(appInstance && authInstance && dbInstance),
  };
}

export async function createSecondaryStaffAuthUser(email: string, password: string): Promise<string> {
  const { isFirebaseConfigured, config } = getFirebaseState();
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured.');
  }
  const secAppName = 'secondary-staff-provisioner';
  const secApp = getApps().some((a) => a.name === secAppName)
    ? getApp(secAppName)
    : initializeApp(config, secAppName);
  const secAuth = getAuth(secApp);
  const cred = await createUserWithEmailAndPassword(secAuth, email, password);
  const uid = cred.user.uid;
  await signOut(secAuth).catch(() => {});
  return uid;
}

export const app = appInstance;
export const auth = authInstance as unknown as Auth;
export const db = dbInstance as unknown as Firestore;
export const storage = storageInstance as unknown as FirebaseStorage;
export const functions = functionsInstance as unknown as Functions;
export const isFirebaseConfigured = hasUsableConfig(resolvedConfig);
