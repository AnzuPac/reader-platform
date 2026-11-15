'use client';
import { useState } from 'react';

export default function PublisherPriceEditor({
  workId,
  publisherId,
  amountCents,
  currency,
  active,
}: {
  workId: number;
  publisherId: number;
  amountCents: number | null;
  currency: string | null;
  active: number | null;
}) {
  const [value, setValue] = useState(amountCents ? String(Math.round(amountCents / 100)) : '');
  void currency; // цена всегда в RSD
  const [isActive, setIsActive] = useState(active !== 0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) { setMsg('Neispravna cena'); return; }
    const cents = Math.round(parsed) * 100; // целые RSD
    setBusy(true); setMsg('');
    const r = await fetch(`/api/publisher/works/${workId}/price?publisher=${publisherId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: cents, currency: 'RSD', active: isActive }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok
      ? `Sačuvano${j.trimmed_coins ? ` · главы урезаны на ${j.trimmed_coins} монет` : ''}`
      : `Greška: ${j.error || r.status}`);
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-2">
      <input
        className="input max-w-[110px]"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="990"
        aria-label="Cena u RSD"
      />
      <span className="text-xs muted">RSD</span>
      <label className="flex items-center gap-1 text-xs muted">
        <input type="checkbox" aria-label="Cena aktivna" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> aktivna
      </label>
      <button className="btn btn-ghost" disabled={busy}>{busy ? '…' : 'Sačuvaj'}</button>
      {msg ? <span className="text-xs muted">{msg}</span> : null}
    </form>
  );
}
