'use client';
import { useState } from 'react';

export default function SubscribeForm({ planCode, disabled }: { planCode: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function pay() {
    setBusy(true); setMsg('');
    const r = await fetch('/api/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planCode }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.status === 401) { setMsg('Prvo se prijavi.'); return; }
    if (!r.ok) { setMsg('Greška: ' + (j.error || r.status)); return; }
    setMsg(`Zahtev #${j.paymentId} poslat. ${j.instructions}`);
  }

  return (
    <div className="mt-auto">
      <button className="btn btn-primary w-full justify-center" onClick={pay} disabled={disabled || busy}>
        {disabled ? 'Uključeno' : 'Izaberi'}
      </button>
      {msg ? <p className="mt-2 text-xs muted">{msg}</p> : null}
    </div>
  );
}
