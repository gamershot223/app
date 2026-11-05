import { FormEvent, useEffect, useState } from 'react';
import { LogIn } from 'lucide-react';
import { authRequest, type AuthUser } from '../lib/auth';
import {
  clearPendingOAuthError,
  oauthHref,
  onOAuthClick,
  peekPendingOAuthError,
  requestAccountEmail,
  suggestsSignup,
} from '../lib/app-auth';
import { userErrorText } from '../lib/api-error';
import { siteContent } from '../content/site';
import { btnGhost, btnPrimary, cardCls, fieldCls } from '../lib/ui-classes';

export function LoginForm({ onAuthed, notice }: { onAuthed: (user: AuthUser) => void; notice?: string }) {
  const c = siteContent.login;
  const [email, setEmail] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState(peekPendingOAuthError);
  const [offerSignup, setOfferSignup] = useState(false);
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    clearPendingOAuthError();
  }, []);

  async function run(mode: 'signup' | 'login') {
    setError('');
    setOfferSignup(false);
    setInfo('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Укажите корректную почту, например name@company.ru.');
      return;
    }
    if (secret.length < 8) {
      setError('Пароль должен быть не короче 8 символов.');
      return;
    }
    setBusy(true);
    try {
      const user = await authRequest(mode, email, secret);
      setSecret('');
      onAuthed(user);
    } catch (err) {
      const text = userErrorText(err, '');
      setError(
        text ||
          'Сервис входа не отвечает. Регистрация работает в превью и на опубликованном сайте; при локальном запуске сервиса входа нет.',
      );
      setOfferSignup(mode === 'login' && suggestsSignup(err));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void run('login');
  }

  async function forgot() {
    if (!email.trim()) {
      setError('Укажите почту, чтобы отправить письмо.');
      return;
    }
    setBusy(true);
    setError('');
    await requestAccountEmail('forgot', email);
    setInfo('Если этот адрес зарегистрирован, письмо уже отправлено.');
    setBusy(false);
  }

  return (
    <div data-section="login" className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="font-display text-3xl font-semibold">{c.title}</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">{c.lead}</p>
      <form onSubmit={onSubmit} noValidate className={`${cardCls} space-y-4`}>
        {error ? (
          <p className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="space-y-1.5">
          <label htmlFor="login-email" className="text-sm font-medium">{c.email}</label>
          <input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={fieldCls} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="login-secret" className="text-sm font-medium">{c.pass}</label>
          <input id="login-secret" type="password" autoComplete="current-password" required minLength={8} value={secret} onChange={(e) => setSecret(e.target.value)} className={fieldCls} />
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className={btnPrimary}>
            <LogIn className="size-4" aria-hidden="true" />
            {c.submit}
          </button>
          <button type="button" disabled={busy} onClick={() => void run('signup')} className={btnGhost}>
            {c.signup}
          </button>
        </div>
        <button type="button" disabled={busy} onClick={() => void forgot()} className="text-sm text-muted-foreground underline">
          {c.forgot}
        </button>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <a href={oauthHref('google')} onClick={(e) => onOAuthClick(e, 'google')} className="underline">Войти через Google</a>
          <a href={oauthHref('yandex')} onClick={(e) => onOAuthClick(e, 'yandex')} className="underline">Войти через Яндекс</a>
        </div>
        {notice ? <p className="text-sm text-muted-foreground" role="status">{notice}</p> : null}
        {info ? <p className="text-sm text-muted-foreground" role="status">{info}</p> : null}
        {error && offerSignup ? (
          <button type="button" disabled={busy} onClick={() => void run('signup')} className="text-sm underline">
            Зарегистрироваться
          </button>
        ) : null}
      </form>
    </div>
  );
}
