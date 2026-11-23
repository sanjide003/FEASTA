import {
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  type DocumentData,
  type Firestore,
  type Query,
} from 'firebase/firestore';
import type { Auth } from 'firebase/auth';

export const OperationType = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
});

const CACHE_PREFIX = 'fp_cache_v2:';
const memoryCache = new Map<string, { data: any; expiresAt: number }>();
const inflightRequests = new Map<string, Promise<any>>();

export function handleFirestoreError(
  error: unknown,
  operationType: string,
  path: string,
  auth: Auth | null = null
) {
  const user = auth?.currentUser;
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    code: (error as any)?.code || '',
    operationType,
    path,
    authInfo: {
      userId: user?.uid || null,
      email: user?.email || null,
    },
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  return errInfo;
}

export async function testFirestoreConnection(db: Firestore) {
  try {
    await getDocFromServer(doc(db, 'settings', 'home_config'));
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

function readSessionEntry(key: string): { data: any; expiresAt: number } | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.expiresAt !== 'number') return null;
    if (Date.now() > parsed.expiresAt) {
      sessionStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSessionEntry(key: string, data: any, expiresAt: number) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const serialized = JSON.stringify({ data, expiresAt });
    if (serialized.length <= 512 * 1024) {
      sessionStorage.setItem(CACHE_PREFIX + key, serialized);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function getCachedValue<T = any>(key: string): T | undefined {
  const now = Date.now();
  const mem = memoryCache.get(key);
  if (mem && mem.expiresAt > now) return mem.data as T;
  if (mem) memoryCache.delete(key);

  const sess = readSessionEntry(key);
  if (sess) {
    memoryCache.set(key, sess);
    return sess.data as T;
  }
  return undefined;
}

export function setCachedValue<T = any>(
  key: string,
  data: T,
  ttlMs = 180_000,
  persistSession = true
): T {
  const expiresAt = Date.now() + Math.max(0, ttlMs);
  const entry = { data, expiresAt };
  memoryCache.set(key, entry);
  if (persistSession) writeSessionEntry(key, data, expiresAt);
  return data;
}

export function invalidateCache(prefix = '') {
  for (const key of [...memoryCache.keys()]) {
    if (!prefix || key.startsWith(prefix)) memoryCache.delete(key);
  }
  try {
    if (typeof sessionStorage === 'undefined') return;
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const storageKey = sessionStorage.key(i);
      if (!storageKey || !storageKey.startsWith(CACHE_PREFIX)) continue;
      const logicalKey = storageKey.slice(CACHE_PREFIX.length);
      if (!prefix || logicalKey.startsWith(prefix)) {
        sessionStorage.removeItem(storageKey);
      }
    }
  } catch {
    // Ignore
  }
}

export async function cachedGetDoc<T = any>(
  db: Firestore,
  collectionName: string,
  docId: string,
  { ttlMs = 300_000, forceRefresh = false, persistSession = true } = {}
): Promise<(T & { id: string; _exists?: boolean }) | null> {
  const cacheKey = `doc:${collectionName}/${docId}`;
  if (!forceRefresh) {
    const hit = getCachedValue<(T & { id: string; _exists?: boolean }) | null>(cacheKey);
    if (hit !== undefined) return hit;
  }
  if (inflightRequests.has(cacheKey)) {
    return inflightRequests.get(cacheKey);
  }
  const promise = getDoc(doc(db, collectionName, docId))
    .then((snap) => {
      const data = snap.exists() ? ({ id: snap.id, ...snap.data(), _exists: true } as T & { id: string; _exists: boolean }) : null;
      return setCachedValue(cacheKey, data, ttlMs, persistSession);
    })
    .finally(() => inflightRequests.delete(cacheKey));

  inflightRequests.set(cacheKey, promise);
  return promise;
}

export async function cachedGetDocs<T = any>(
  cacheKey: string,
  firestoreQuery: Query<DocumentData>,
  { ttlMs = 120_000, forceRefresh = false, persistSession = true } = {}
): Promise<Array<T & { id: string }>> {
  if (!forceRefresh) {
    const hit = getCachedValue<Array<T & { id: string }>>(cacheKey);
    if (hit !== undefined) return hit;
  }
  if (inflightRequests.has(cacheKey)) {
    return inflightRequests.get(cacheKey);
  }
  const promise = getDocs(firestoreQuery)
    .then((snap) => {
      const rows = snap.docs.map((item) => ({ id: item.id, ...item.data() } as T & { id: string }));
      return setCachedValue(cacheKey, rows, ttlMs, persistSession);
    })
    .finally(() => inflightRequests.delete(cacheKey));

  inflightRequests.set(cacheKey, promise);
  return promise;
}
