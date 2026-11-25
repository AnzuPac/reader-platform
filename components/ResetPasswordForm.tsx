'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

const TXT = {
  sr: { title: 'Nova lozinka', password: 'Nova lozinka (min. 12)', repeat: 'Ponovi lozinku', save: 'Sačuvaj', done: 'Lozinka promenjena. Prijavite se.', weak: 'Lozinka je prekratka (min. 12)', mismatch: 'Lozinke se ne poklapaju', missing: 'Link nije ispravan', toLogin: 'Na prijavu' },
  ru: { title: 'Новый пароль', password: 'Новый пароль (мин. 12)', repeat: 'Повторите пароль', save: 'Сохранить', done: 'Пароль изменён. Войдите.', weak: 'Пароль слишком короткий (мин. 12)', mismatch: 'Пароли не совпадают', missing: 'Ссылка недействительна', toLogin: 'Ко входу' },
  en: { title: 'New password', password: 'New password (min. 12)', repeat: 'Repeat password', save: 'Save', done: 'Password changed. Please sign in.', weak: 'Password is too short (min. 12)', mismatch: 'Passwords do not match', missing: 'The link is invalid', toLogin: 'Go to sign in' },
} as const;

export default function ResetPasswordForm({ lang }: { lang: 'sr' | 'ru' | 'en' }) {
  const t = TXT[lang];
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) { setMessage(t.missing); return; }
    if (password.length < 12) { setMessage(t.weak); return; }
    if (password !== confirmPassword) { setMessage(t.mismatch); return; }
    setBusy(true);
    const res = await fetch('/api/auth/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password, confirmPassword }),
    }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      const json = res ? await res.json().catch(() => ({})) : {};
      const code = String(json.error || '');
      setMessage(code === 'weak_password' ? t.weak : code === 'password_mismatch' ? t.mismatch : t.missing);
      return;
    }
    setDone(true);
    setMessage(t.done);
  }

  return (
    <form onSubmit={submit} className="tl-auth-form card space-y-4 p-6">
      <div>
        <label className="mb-1 block text-sm muted">{t.password}</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      </div>
      <div>
        <label className="mb-1 block text-sm muted">{t.repeat}</label>
        <input className="input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
      </div>
      <button className="btn btn-primary w-full justify-center" disabled={busy || done}>{t.save}</button>
      {message ? <p className="text-sm muted" role="status">{message}</p> : null}
      {done ? <a className="block text-center text-sm" href={`/${lang}/login`}>{t.toLogin}</a> : null}
    </form>
  );
}
