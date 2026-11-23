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

const emptyConfig: RuntimeFirebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
  measurementId: '',
};

let resolvedConfig: RuntimeFirebaseConfig = {
  ...emptyConfig,
  ...(staticFallbackConfig || {}),
  ...((globalThis as any).__FIREBASE_CONFIG__ || {}),
};

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

export async function bootstrapFirebase(): Promise<RuntimeFirebaseConfig> {
  if (initialized) return resolvedConfig;
  initialized = true;
  if (typeof window !== 'undefined') {
    try {
      const resp = await fetch('/api/firebase-config', { cache: 'no-store' });
      if (resp.ok) {
        const json = await resp.json();
        if (hasUsableConfig(json)) {
          resolvedConfig = { ...emptyConfig, ...json };
        }
      }
    } catch {
      // Static hosting deployments (Firebase Hosting / Vercel) fall back to firebase-runtime-config.js
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
