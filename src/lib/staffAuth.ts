import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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

export async function resolveAuthenticatedProfile(uid: string, email: string | null): Promise<AccessUser | null> {
  const { db } = getFirebaseState();
  if (!db) return null;

  const adminSnap = await getDoc(doc(db, 'adminUsers', uid)).catch(() => null);
  if (adminSnap?.exists()) {
    const data = adminSnap.data() as any;
    if (data.active !== false && ADMIN_ROLES.has(data.role)) {
      return { id: adminSnap.id, uid, ...data, sourceCollection: 'adminUsers' };
    }
  }

  const accessSnap = await getDoc(doc(db, 'accessUsers', uid)).catch(() => null);
  if (accessSnap?.exists()) {
    const data = accessSnap.data() as any;
    if (data.active !== false && ['teamLeader', 'judge', 'admin', 'superAdmin'].includes(data.role)) {
      return { id: accessSnap.id, uid, ...data, sourceCollection: 'accessUsers' };
    }
  }

  // Canonical bootstrap fallback from username map if email follows @fest.local or matches accessUsernames
  if (email) {
    const localSlug = email.split('@')[0]?.toLowerCase().trim();
    if (localSlug) {
      const canonSnap = await getDoc(doc(db, 'accessUsernames', localSlug)).catch(() => null);
      if (canonSnap?.exists()) {
        const canon = canonSnap.data() as any;
        if (canon.active !== false && canon.email === email) {
          const restored: Record<string, any> = {
            username: localSlug,
            displayName: canon.displayName || localSlug,
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
          return { id: uid, uid, ...(restored as any), sourceCollection: 'accessUsers' };
        }
      }
    }
  }

  return null;
}

export async function signOutStaff() {
  const { auth } = getFirebaseState();
  if (auth) await signOut(auth).catch(() => {});
}
