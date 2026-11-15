'use client';
import { useState } from 'react';

export default function AccountDangerZone({ lang }: { lang: string }) {
  const [step, setStep] = useState<'idle' | 'confirm'>('idle');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function startDelete() {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/account/delete-request', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'error');
      setToken(j.token); setStep('confirm');
    } catch (e: any) { setError(e.message); }
    setBusy(false);
  }

  async function confirmDelete() {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/account/delete-confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'error');
      window.location.href = `/${lang}`;
    } catch (e: any) { setError(e.message); setBusy(false); }
  }

  return (
    <section className="mt-10 rounded border border-red-500/30 p-5">
      <h2 className="mb-3 text-lg font-semibold">Podaci i nalog</h2>
      <p className="mb-4 text-sm muted">Preuzmite svoje podatke ili obrišite nalog. Brisanje je nepovratno.</p>
      <div className="flex flex-wrap gap-3">
        <a href="/api/account/export" className="rounded border border-white/20 px-3 py-2 text-sm">Preuzmi podatke (JSON)</a>
        {step === 'idle' ? (
          <button onClick={startDelete} disabled={busy} className="rounded border border-red-500/50 px-3 py-2 text-sm text-red-300">
            Obriši nalog
          </button>
        ) : null}
      </div>
      {step === 'confirm' ? (
        <div className="mt-4 max-w-sm">
          <p className="mb-2 text-sm">Potvrdite lozinkom. Nalog će biti obezličen, komentari skriveni.</p>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                 placeholder="Lozinka" className="mb-2 w-full rounded border border-white/20 bg-transparent px-3 py-2" />
          <div className="flex gap-2">
            <button onClick={confirmDelete} disabled={busy} className="rounded bg-red-600/80 px-3 py-2 text-sm">Obriši zauvek</button>
            <button onClick={() => { setStep('idle'); setPassword(''); }} className="rounded border border-white/20 px-3 py-2 text-sm">Otkaži</button>
          </div>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
    </section>
  );
}
