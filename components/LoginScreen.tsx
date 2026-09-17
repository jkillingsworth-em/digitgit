import React, { useState } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  AuthError,
} from 'firebase/auth';
import { auth } from '../firebase';

interface LoginScreenProps {
  /** Optional message from domain allowlist rejection or prior session */
  bannerMessage?: string | null;
}

function authErrorMessage(err: unknown): string {
  const code = (err as AuthError)?.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again later.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'Pop-up blocked. Allow pop-ups for this site and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return (err as Error)?.message || 'Sign-in failed. Please try again.';
  }
}

const LoginScreen: React.FC<LoginScreenProps> = ({ bannerMessage }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'google' | 'email' | null>(null);

  const handleGoogle = async () => {
    setError(null);
    setBusy('google');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy('email');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center rounded-full bg-em-red px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-white mb-4">
            Electro-Mech Scoreboard Co.
          </div>
          <h1 className="titlefont text-3xl sm:text-4xl text-white tracking-tight">
            <span className="font-black">ELECTRO-MECH</span>{' '}
            <span className="font-light opacity-70">INVENTORY</span>
          </h1>
          <p className="mt-3 text-sm font-medium text-gray-400 normal-case tracking-normal">
            Sign in to access digitgit floor inventory.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900 shadow-2xl overflow-hidden">
          <div className="h-1.5 bg-em-red" />
          <div className="p-6 sm:p-8 space-y-6">
            {(bannerMessage || error) && (
              <div
                className="rounded-xl border border-red-900/60 bg-red-950/50 px-4 py-3 text-sm font-bold text-red-200 normal-case tracking-normal"
                role="alert"
              >
                {error || bannerMessage}
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy !== null}
              className="w-full flex items-center justify-center gap-3 rounded-xl bg-white px-4 py-3.5 text-sm font-black uppercase tracking-wide text-gray-900 hover:bg-gray-100 disabled:opacity-60 transition-colors border border-gray-200"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.48-1.84-6.51-4.32H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.49 14.31c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.29H2.18C1.43 8.78 1 10.34 1 12s.43 3.22 1.18 4.71l3.31-2.4z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.29l3.31 2.4c1.03-2.48 3.65-4.31 6.51-4.31z"
                />
              </svg>
              {busy === 'google' ? 'Signing in…' : 'Continue with Google'}
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-700" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                or email
              </span>
              <div className="h-px flex-1 bg-gray-700" />
            </div>

            <form onSubmit={handleEmail} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1.5">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm font-medium text-white normal-case tracking-normal focus:border-em-red focus:outline-none focus:ring-1 focus:ring-em-red"
                  placeholder="you@electro-mech.com"
                />
              </div>
              <div>
                <label htmlFor="login-password" className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1.5">
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm font-medium text-white normal-case tracking-normal focus:border-em-red focus:outline-none focus:ring-1 focus:ring-em-red"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={busy !== null}
                className="w-full rounded-xl bg-em-red px-4 py-3.5 text-sm font-black uppercase tracking-wide text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {busy === 'email' ? 'Signing in…' : 'Sign in with email'}
              </button>
            </form>

            <p className="text-[11px] text-gray-500 font-medium normal-case tracking-normal text-center leading-relaxed">
              Prefer Google Workspace. Email/password works for accounts already created in the Firebase Console.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
