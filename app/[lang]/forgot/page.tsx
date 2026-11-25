'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';

const TXT = {
  sr: { title: 'Zaboravljena lozinka', hint: 'Unesite e-poštu naloga — poslaćemo link za novu lozinku.', email: 'E-pošta', send: 'Pošalji link', sent: 'Ako nalog postoji, link je poslat na e-poštu.', need: 'Unesite e-poštu' },
  ru: { title: 'Забыли пароль', hint: 'Укажите почту аккаунта — пришлём ссылку для нового пароля.', email: 'Почта', send: 'Отправить ссылку', sent: 'Если аккаунт существует, ссылка отправлена на почту.', need: 'Укажите почту' },
  en: { title: 'Forgot password', hint: 'Enter your account email — we will send a link to set a new password.', email: 'Email', send: 'Send link', sent: 'If the account exists, a link has been sent to your email.', need: 'Enter your email' },
} as const;

export default function ForgotPage() {
  const rawLang = String(useParams<{ lang?: string }>()?.lang || 'sr');
  const lang = rawLang === 'ru' || rawLang === 'en' ? rawLang : 'sr';
  const t = TXT[lang];
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) { setMessage(t.need); return; }
    setBusy(true);
    await fetch('/api/auth/password/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, lang }),
    }).catch(() => null);
    setBusy(false);
    setMessage(t.sent);
  }

  return (
    <main id="main" className="tl-screen mx-auto max-w-md px-5 py-16">
      <h1 className="mb-2 text-3xl font-bold">{t.title}</h1>
      <p className="mb-6 muted">{t.hint}</p>
      <form onSubmit={submit} className="tl-auth-form card space-y-4 p-6">
        <div>
          <label className="mb-1 block text-sm muted">{t.email}</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <button className="btn btn-primary w-full justify-center" disabled={busy}>{t.send}</button>
        {message ? <p className="text-sm muted" role="status">{message}</p> : null}
      </form>
    </main>
  );
}
