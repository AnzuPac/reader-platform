'use client';
import { useState } from 'react';

export default function PayoutForm({ publisherId }: { publisherId: number }) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(String(amount).replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) { setMsg('Unesi iznos'); return; }
    setBusy(true); setMsg('');
    const r = await fetch(`/api/publisher/payouts?publisher=${publisherId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: Math.round(parsed * 100) }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? `Isplata #${j.payoutId} je zabeležena` : `Greška: ${j.error || r.status}`);
    if (r.ok) setAmount('');
  }

  return (
    <form onSubmit={create} className="flex flex-wrap items-end gap-2">
      <label className="text-xs muted">
        Iznos
        <input className="input mt-1 max-w-[130px]" inputMode="decimal" value={amount}
               onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </label>
      <button className="btn btn-primary" disabled={busy}>{busy ? '…' : 'Nova isplata'}</button>
      {msg ? <span className="text-xs muted">{msg}</span> : null}
    </form>
  );
}
