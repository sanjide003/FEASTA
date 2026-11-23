import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, LogIn } from 'lucide-react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { brandingName, readCachedBranding } from '../../lib/branding';
import { getFirebaseState } from '../../lib/firebase';
import { resolveAuthenticatedProfile, routeForRole } from '../../lib/staffAuth';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [branding] = useState(() => readCachedBranding());
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = `Staff Login — ${brandingName(branding)}`;
    const { auth, isFirebaseConfigured } = getFirebaseState();
    if (!isFirebaseConfigured || !auth) {
      setCheckingSession(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user || user.isAnonymous) {
        setCheckingSession(false);
        return;
      }
      const profile = await resolveAuthenticatedProfile(user.uid, user.email);
      if (profile) {
        navigate(routeForRole(profile.role), { replace: true });
      } else {
        setCheckingSession(false);
      }
    });
    return () => unsub();
  }, [navigate, branding]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { auth, db, isFirebaseConfigured } = getFirebaseState();
    if (!isFirebaseConfigured || !auth || !db) {
      return setError('Firebase configuration is missing.');
    }
    const cleanId = identifier.trim();
    if (!cleanId || !password) {
      return setError('Enter both username/email and password.');
    }

    setSubmitting(true);
    setError('');
    try {
      let emailToUse = cleanId;
      if (!cleanId.includes('@')) {
        const slug = cleanId.toLowerCase();
        const [accessSnap, adminSnap] = await Promise.all([
          getDoc(doc(db, 'accessUsernames', slug)).catch(() => null),
          getDoc(doc(db, 'adminUsernames', slug)).catch(() => null),
        ]);
        const accessData = accessSnap?.exists() ? (accessSnap.data() as any) : null;
        const adminData = adminSnap?.exists() ? (adminSnap.data() as any) : null;
        const found = accessData?.email ? accessData : adminData?.email ? adminData : null;
        if (found) {
          if (found.active === false) {
            throw new Error('This staff account is currently deactivated.');
          }
          emailToUse = found.email;
        } else {
          emailToUse = `${slug}@fest.local`;
        }
      }

      const cred = await signInWithEmailAndPassword(auth, emailToUse, password);
      const profile = await resolveAuthenticatedProfile(cred.user.uid, cred.user.email);
      if (!profile) {
        await signOut(auth).catch(() => {});
        throw new Error('This account does not have an active staff role.');
      }
      navigate(routeForRole(profile.role), { replace: true });
    } catch (err: any) {
      const code = err?.code || '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        setError('Invalid username/email or password.');
      } else {
        setError(err?.message || 'Sign in failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] px-4 py-12 text-[#0F172A]">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 font-display text-lg font-bold text-slate-900">
            {brandingName(branding)}
          </Link>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-slate-900">Staff Portal Sign In</h1>
          <p className="mt-1 text-xs text-slate-500">
            Unified access for Festival Administrators, Team Leaders, and Judges
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {checkingSession ? (
            <p className="py-8 text-center text-xs text-slate-500">Checking active staff session…</p>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Username or Email</label>
                <input
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin, teamlead1, judge1 or email"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((p) => !p)}
                    aria-label="Toggle password visibility"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                <LogIn className="h-4 w-4" />
                <span>{submitting ? 'Signing In…' : 'Sign In'}</span>
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-500">
          <Link to="/" className="font-semibold text-blue-700 hover:underline">
            &larr; Back to Public Festival Site
          </Link>
        </p>
      </div>
    </div>
  );
};
