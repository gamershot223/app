import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installErrorReporting } from './lib/error-reporting';
import './index.css';

/**
 * Подписка на рантайм-ошибки ДО первого рендера: иначе падение в самом первом
 * рендере пройдёт мимо приёмника. Ловит и то, что перехватил ErrorBoundary —
 * production-React такие ошибки наружу не пробрасывает (подробности в
 * src/lib/error-reporting.ts). Не удалять.
 */
installErrorReporting();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
