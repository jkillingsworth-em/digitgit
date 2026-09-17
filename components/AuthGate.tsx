import React, { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '../firebase';
import LoginScreen from './LoginScreen';

interface AuthGateProps {
  children: (ctx: { user: User; signOut: () => Promise<void> }) => React.ReactNode;
}

const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  const getAllowedDomains = useCallback((): string[] => {
    const raw = (import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS || '').trim();
    if (!raw) return [];
    return raw
      .split(',')
      .map((d: string) => d.trim().toLowerCase())
      .filter(Boolean);
  }, []);

  const isEmailDomainAllowed = useCallback(
    (email: string | null | undefined): boolean => {
      const domains = getAllowedDomains();
      if (domains.length === 0) return true;
      if (!email || !email.includes('@')) return false;
      const domain = email.split('@').pop()?.toLowerCase() || '';
      return domains.includes(domain);
    },
    [getAllowedDomains],
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async next => {
      if (next && !isEmailDomainAllowed(next.email)) {
        const domains = getAllowedDomains();
        setBanner(
          `Access restricted to: ${domains.join(', ')}. Signed out ${next.email || 'this account'}.`,
        );
        try {
          await signOut(auth);
        } catch {
          /* ignore */
        }
        setUser(null);
        setLoading(false);
        return;
      }
      if (next) setBanner(null);
      setUser(next);
      setLoading(false);
    });
    return () => unsub();
  }, [getAllowedDomains, isEmailDomainAllowed]);

  const handleSignOut = useCallback(async () => {
    setBanner(null);
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out failed', err);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="font-black text-gray-400 animate-pulse uppercase tracking-widest text-sm">
          Checking authentication…
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen bannerMessage={banner} />;
  }

  return <>{children({ user, signOut: handleSignOut })}</>;
};

export default AuthGate;
