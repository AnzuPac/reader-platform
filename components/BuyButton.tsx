'use client';
import { useState } from 'react';

function money(cents: number, currency: string): string {
  const amount = (cents / 100).toFixed(2);
  return `${amount} ${currency}`;
}

/**
 * Кнопка разовой покупки. Работает и со Stripe (переход на Checkout),
 * и в ручном режиме (заявка уходит админу, доступ откроется после подтверждения).
 */
export default function BuyButton({
  workId,
  chapterId,
  priceCents,
  currency,
  lang = 'sr',
  label,
}: {
  workId?: number;
  chapterId?: number;
  priceCents: number;
  currency: string;
  lang?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);

  async function buy() {
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workId, chapterId, lang }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) {
        setMsg('Prvo se prijavi.');
        return;
      }
      if (!r.ok) {
        setMsg(j.error === 'not_for_sale' ? 'Ovo delo se ne prodaje.' : 'Kupovina nije moguća.');
        return;
      }
      if (j.mode === 'stripe' && j.url) {
        window.location.href = j.url;
        return;
      }
      if (j.already) {
        setDone(true);
        setMsg('Već kupljeno — osveži stranicu.');
        return;
      }
      setDone(true);
      setMsg(
        `Zahtev #${j.purchaseId} je poslat. Uplata ${money(j.amountCents ?? priceCents, j.currency ?? currency)} na račun izdavača; pristup se otvara posle potvrde.`
      );
    } catch {
      setMsg('Greška u mreži.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="btn btn-primary" onClick={buy} disabled={busy || done}>
        {busy ? '…' : done ? '✓ Zahtev poslat' : `${label || 'Kupi'} · ${money(priceCents, currency)}`}
      </button>
      {msg ? <p className="mt-1 max-w-sm text-xs muted">{msg}</p> : null}
    </div>
  );
}
