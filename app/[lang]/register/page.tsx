'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const rawLang = String(useParams<{ lang?: string }>()?.lang || 'sr');
  const lang = rawLang === 'ru' || rawLang === 'en' ? rawLang : 'sr';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !password) { setError('Popuni sva polja'); return; }
    setBusy(true); setError('');
    const res = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error === 'err_exists' ? 'Nalog sa ovom e-poštom već postoji' : 'Greška pri registraciji');
      return;
    }
    router.push(`/${lang}`);
    router.refresh();
  }

  return (
    <main id="main" className="mx-auto max-w-md px-5 py-16">
      <h1 className="mb-6 text-3xl font-bold">Registracija</h1>
      <form onSubmit={submit} className="card space-y-4 p-6">
        <div>
          <label className="mb-1 block text-sm muted">Ime ili nadimak</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm muted">E-pošta</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm muted">Lozinka (min. 8)</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error ? <p className="text-sm text-sakura">{error}</p> : null}
        <button className="btn btn-primary w-full justify-center" disabled={busy}>Napravi nalog</button>
      </form>
    </main>
  );
}
