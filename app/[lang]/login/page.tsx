'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const TXT = {
  sr: { title: 'Prijava', email: 'E-pošta', password: 'Lozinka', submit: 'Prijavi se', err: 'Pogrešna e-pošta ili lozinka', need: 'Popuni sva polja' },
  en: { title: 'Sign in', email: 'Email', password: 'Password', submit: 'Sign in', err: 'Wrong email or password', need: 'Fill in all fields' },
  ru: { title: 'Вход', email: 'Почта', password: 'Пароль', submit: 'Prijava', err: 'Неверная почта или пароль', need: 'Заполни все поля' },
};

export default function LoginPage({ params }: { params: Promise<{ lang: string }> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const rawLang = String(useParams<{ lang?: string }>()?.lang || 'sr');
  const lang: keyof typeof TXT = rawLang === 'ru' || rawLang === 'en' ? rawLang : 'sr';
  const t = TXT[lang];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError(t.need); return; }
    setBusy(true); setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    setBusy(false);
    if (!res.ok) { setError(t.err); return; }
    router.push(`/${lang}`);
    router.refresh();
  }

  return (
    <main id="main" className="mx-auto max-w-md px-5 py-16">
      <h1 className="mb-6 text-3xl font-bold">{t.title}</h1>
      <form onSubmit={submit} className="card space-y-4 p-6">
        <div>
          <label className="mb-1 block text-sm muted">{t.email}</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div>
          <label className="mb-1 block text-sm muted">{t.password}</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {error ? <p className="text-sm text-sakura">{error}</p> : null}
        <button className="btn btn-primary w-full justify-center" disabled={busy}>{t.submit}</button>
      </form>
    </main>
  );
}
