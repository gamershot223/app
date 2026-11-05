import { useEffect, useState } from 'react';
import type { AuthUser } from '../lib/auth';
import { restoreSession } from '../lib/app-auth';
import { supabase } from '../lib/supabase';

export type AuthSession = {
  user: AuthUser | null;
  notice: string;
  signIn: (user: AuthUser) => void;
  signOut: (notice: string) => void;
};

export function useAuthSession(): AuthSession {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void (async () => {
      const { user: me } = await restoreSession();
      if (me) setUser(me);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session?.user) {
          setUser({ id: session.user.id, email: session.user.email ?? '' });
        } else {
          setUser(null);
        }
      })();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    notice,
    signIn: (next) => {
      setUser(next);
      setNotice('');
    },
    signOut: (message) => {
      setUser(null);
      setNotice(message);
    },
  };
}
