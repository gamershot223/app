import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { LoginForm } from './components/LoginForm';
import { CalculatorPage } from './components/CalculatorPage';
import { SettingsPage } from './components/SettingsPage';
import { HistoryPage } from './components/HistoryPage';
import { AnalyticsPage } from './components/AnalyticsPage';
import { EcosystemPage } from './components/EcosystemPage';
import { useAuthSession } from './hooks/use-auth-session';
import { logoutCurrentDevice } from './lib/app-auth';

/** Только композиция: сессия + маршруты. Калькулятор и экосистема открыты всем, остальное — для вошедших. */
export default function App() {
  const session = useAuthSession();
  const user = session.user;

  async function logout() {
    await logoutCurrentDevice();
    session.signOut('Вы вышли из системы.');
  }

  const login = <LoginForm onAuthed={session.signIn} notice={session.notice} />;
  const guard = (el: (u: NonNullable<typeof user>) => React.ReactNode) => (user ? el(user) : login);

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell user={user} onLogout={() => void logout()} />}>
          <Route path="/" element={<CalculatorPage user={user} />} />
          <Route path="/login" element={user ? <Navigate to="/" replace /> : login} />
          <Route path="/history" element={guard(() => <HistoryPage />)} />
          <Route path="/analytics" element={guard(() => <AnalyticsPage />)} />
          <Route path="/settings" element={guard((u) => <SettingsPage user={u} />)} />
          <Route path="/ecosystem" element={<EcosystemPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
