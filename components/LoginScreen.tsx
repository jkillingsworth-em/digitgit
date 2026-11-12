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

  const dots = [
    '00000000000000', '00000000000000', '00011100111000', '00010100100100',
    '00011100111000', '00010100100100', '00011100111000', '00000000000000',
  ];

  return (
    <div className="min-h-screen bg-em-page md:grid md:grid-cols-2">
      {/* Brand panel */}
      <div className="relative overflow-hidden bg-em-ink px-6 py-6 text-white md:flex md:flex-col md:px-12 md:py-12">
        <img src="/brand/electro-mech-logo-white.png" alt="Electro-Mech Scoreboard Company" className="h-auto w-44 md:w-[300px]" />
        <div className="relative z-10 mt-auto hidden max-w-md pb-56 md:block">
          <h1 className="!mb-3 text-[40px] font-bold leading-[48px] tracking-tight text-white">Every part, every bin, one place.</h1>
          <p className="text-base text-neutral-400">Scan, move and count scoreboard components across all Electro-Mech locations.</p>
        </div>
        {/* LED dot-matrix pattern, a nod to the scoreboards */}
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-5 -right-5 hidden grid-cols-[repeat(14,24px)] md:grid">
          {dots.flatMap((row, r) => row.split('').map((cell, c) => (
            <i key={`${r}-${c}`} className={`m-[7px] block h-2.5 w-2.5 rounded-full ${cell === '1' ? 'bg-em-red' : 'bg-neutral-800'}`} />
          )))}
        </div>
      </div>

      {/* Sign-in form */}
      <div className="flex items-start justify-center px-4 py-10 md:items-center">
        <div className="w-full max-w-[400px]">
          <img src="/brand/electro-mech-logo.png" alt="" className="mb-8 hidden h-auto w-60 md:block" />
          <h2 className="!mb-1 text-[26px] font-bold leading-8 text-em-ink">Sign in</h2>
          <p className="mb-6 text-neutral-500">Use your Electro-Mech Google Workspace account.</p>

          {(bannerMessage || error) && (
            <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-em-red-dark" role="alert">
              {error || bannerMessage}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy !== null}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-md border border-neutral-300 bg-white px-4 text-[15px] font-semibold text-em-ink hover:bg-neutral-50 disabled:opacity-60"
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

          <div className="my-5 flex items-center gap-3 text-[13px] text-neutral-500">
            <div className="h-px flex-1 bg-neutral-200" />
            or sign in with email
            <div className="h-px flex-1 bg-neutral-200" />
          </div>

          <form onSubmit={handleEmail} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="!mb-1 block text-xs font-semibold text-neutral-600">Email</label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="form-control h-11"
                placeholder="you@electro-mech.com"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="!mb-1 block text-xs font-semibold text-neutral-600">Password</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="form-control h-11"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={busy !== null}
              className="h-11 w-full rounded-md bg-em-red px-4 text-[15px] font-semibold text-white hover:bg-em-red-dark disabled:opacity-60"
            >
              {busy === 'email' ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-5 text-xs leading-relaxed text-neutral-500">
            Only Electro-Mech accounts can sign in. Email and password work for accounts an administrator has created. Need access? Ask an admin.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
