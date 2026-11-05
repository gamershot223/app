import { useEffect, useState } from 'react';
import type { AuthUser } from '../lib/auth';
import { restoreSession } from '../lib/app-auth';

export type AuthSession = {
  user: AuthUser | null;
  notice: string;
  signIn: (user: AuthUser) => void;
  signOut: (notice: string) => void;
};

/**
 * Сессия платформенного /auth одним объектом, а НЕ парами `useState` в
 * NotesSection.
 *
 * Это не стилистика. Панель заметок помечена `@workai-seed-stub`, и маркер
 * обещает агенту: ненужную секцию можно снять через delete_file вместе с
 * импортом. Пока родитель держал `notes` и `onLogout`, нужные только
 * NotesPanel, её удаление оставляло осиротевшие локальные переменные, и
 * `noUnusedLocals` ронял сборку с TS6133 — агент получал нерешаемый
 * self_check_build на коде, которого не писал.
 *
 * Поэтому заметки и выход живут внутри NotesPanel, а здесь — только то, что
 * делят форма входа и панель. Один объект держится любым оставшимся
 * потребителем, и удаление любой из секций сирот не оставляет.
 */
export function useAuthSession(): AuthSession {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void (async () => {
      // restoreSession уже делает защищённый /auth/me (и refresh при 401).
      // Второй запрос здесь мог сам получить 401 после ротации и ошибочно
      // скрыть только что подтверждённую сессию.
      const { user: me } = await restoreSession();
      if (me) setUser(me);
    })();
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
