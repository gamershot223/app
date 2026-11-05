import { Link, NavLink, Outlet } from 'react-router-dom';
import { LogIn, LogOut } from 'lucide-react';
import { siteContent } from '../content/site';
import type { AuthUser } from '../lib/auth';

export function AppShell({ user, onLogout }: { user: AuthUser | null; onLogout: () => void }) {
  const authBtn =
    'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-border px-4 text-sm text-foreground hover:bg-foreground/5';
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-3">
          <span className="font-display text-base font-semibold sm:text-lg">{siteContent.brand}</span>
          {user ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="hidden sm:inline">{user.email}</span>
              <button type="button" onClick={onLogout} className={authBtn}>
                <LogOut className="size-4" aria-hidden="true" />
                Выйти
              </button>
            </div>
          ) : (
            <Link to="/login" className={authBtn}>
              <LogIn className="size-4" aria-hidden="true" />
              Войти
            </Link>
          )}
        </div>
        <nav aria-label="Основная навигация" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2">
          {siteContent.nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm transition ${
                  isActive ? 'bg-accent font-semibold text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted-foreground">{siteContent.demoNote}</footer>
    </div>
  );
}
