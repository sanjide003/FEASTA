import { signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, query, setDoc, where } from 'firebase/firestore';
import { getFirebaseState } from './firebase';
import type { AccessUser } from '../types/festival';

export const ADMIN_ROLES = new Set(['admin', 'superAdmin']);

export const ROLE_ROUTES: Record<string, string> = {
  admin: '/admin',
  superAdmin: '/admin',
  teamLeader: '/team',
  judge: '/judge',
};

export function routeForRole(role: string): string {
  return ROLE_ROUTES[role] || '/login';
}

export function staffEmailLookupKey(email: string): string {
  return `email_${String(email || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_@.-]/g, '_')}`;
}

export interface StaffResolutionResult {
  profile: AccessUser | null;
  reason: 'inactive' | 'missing_profile' | null;
}

const VALID_ACCESS_ROLES = new Set(['teamLeader', 'judge', 'admin', 'superAdmin']);

export async function resolveStaffAuthStatus(
  uid: string,
  email: string | null
): Promise<StaffResolutionResult> {
  const { db } = getFirebaseState();
  if (!db) return { profile: null, reason: 'missing_profile' };

  const adminSnap = await getDoc(doc(db, 'adminUsers', uid)).catch(() => null);
  if (adminSnap?.exists()) {
    const data = adminSnap.data() as any;
    if (data.active === false) {
      return { profile: null, reason: 'inactive' };
    }
    if (ADMIN_ROLES.has(data.role)) {
      return {
        profile: { id: adminSnap.id, uid, ...data, sourceCollection: 'adminUsers' },
        reason: null,
      };
    }
  }

  const accessSnap = await getDoc(doc(db, 'accessUsers', uid)).catch(() => null);
  if (accessSnap?.exists()) {
    const data = accessSnap.data() as any;
    if (data.active === false) {
      return { profile: null, reason: 'inactive' };
    }
    if (VALID_ACCESS_ROLES.has(data.role)) {
      return {
        profile: { id: accessSnap.id, uid, ...data, sourceCollection: 'accessUsers' },
        reason: null,
      };
    }
  }

  if (email) {
    // Query accessUsers by email (permitted by firestore.rules when resource.data.email == auth token email)
    const emailMatches = await getDocs(
      query(collection(db, 'accessUsers'), where('email', '==', email), limit(1))
    ).catch(() => null);
    if (emailMatches && !emailMatches.empty) {
      const matched = emailMatches.docs[0];
      const data = matched.data() as any;
      if (data.active === false) {
        return { profile: null, reason: 'inactive' };
      }
      if (VALID_ACCESS_ROLES.has(data.role)) {
        return {
          profile: { id: matched.id, uid, ...data, sourceCollection: 'accessUsers' },
          reason: null,
        };
      }
    }

    // Canonical bootstrap fallback via accessUsernames (both email key and local username slug)
    const lookupKeys = [
      staffEmailLookupKey(email),
      email.split('@')[0]?.toLowerCase().trim() || '',
    ].filter(Boolean);

    for (const key of lookupKeys) {
      const canonSnap = await getDoc(doc(db, 'accessUsernames', key)).catch(() => null);
      if (!canonSnap?.exists()) continue;
      const canon = canonSnap.data() as any;
      if (String(canon.email || '').toLowerCase() !== email.toLowerCase()) continue;
      if (canon.active === false) {
        return { profile: null, reason: 'inactive' };
      }
      if (VALID_ACCESS_ROLES.has(canon.role)) {
        const restored: Record<string, any> = {
          username: canon.username || email.split('@')[0]?.toLowerCase().trim() || key,
          displayName: canon.displayName || canon.username || email,
          email: canon.email,
          role: canon.role,
          active: true,
          authUid: uid,
          updatedAt: Date.now(),
        };
        if (canon.role === 'teamLeader') {
          restored.team = canon.team || '';
          restored.genderScope = canon.genderScope || 'Both';
        }
        await setDoc(doc(db, 'accessUsers', uid), restored, { merge: true }).catch(() => {});
        return {
          profile: { id: uid, uid, ...(restored as any), sourceCollection: 'accessUsers' },
          reason: null,
        };
      }
    }
  }

  return { profile: null, reason: 'missing_profile' };
}

export async function resolveAuthenticatedProfile(uid: string, email: string | null): Promise<AccessUser | null> {
  const { profile } = await resolveStaffAuthStatus(uid, email);
  return profile;
}

export async function signOutStaff() {
  const { auth } = getFirebaseState();
  if (auth) await signOut(auth).catch(() => {});
}
