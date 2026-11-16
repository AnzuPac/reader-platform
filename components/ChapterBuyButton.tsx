'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Покупка glave за монеты с согласием по Закону о защите потребителей (4.8):
 * чекбокс «согласен потерять право отказа» — без него кнопка неактивна.
 * Automatska kupovina je isključena: каждое открытие платной glave — явное действие.
 */
export default function ChapterBuyButton({
  chapterId,
  coins,
  priceLabel,
  label,
}: {
  chapterId: number;
  coins: number;
  priceLabel: string;
  label?: string;
}) {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);

  async function buy() {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterId, consent: true }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { setMsg('Prvo se prijavi.'); return; }
      if (!r.ok) {
        if (j.error === 'insufficient_coins') setMsg('Nema dovoljno novčića. Dopuni novčanik u profilu.');
        else if (j.error === 'monthly_limit_exceeded') setMsg('Mjesečni limit potrošnje je dostignut. Promeni ga u profilu.');
        else if (j.error === 'consent_required') setMsg('Potrebna je saglasnost.');
        else setMsg('Kupovina nije moguća.');
        return;
      }
      setMsg(`Otvoreno. Balans: ${j.balance} novčića.`);
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        {label || 'Kupi glavu'} · {priceLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div role="dialog" aria-modal="true" className="card w-full max-w-md p-5">
            <h2 className="mb-2 text-lg font-bold">Kupovina glave</h2>
            <p className="mb-3 text-sm muted">
              Cena: <strong>{priceLabel}</strong>. 1 novčić = 1 RSD.
            </p>
            <label className="mb-4 flex items-start gap-2 text-sm">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                Saglasan/na sam da otvaranjem plaćene glave gubim pravo na odustajanje
                (Zakon o zaštiti potrošača). Saglasnost se beleži u dnevniku.
              </span>
            </label>
            {msg ? <p className="mb-3 text-sm text-brand">{msg}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Otkaži</button>
              <button type="button" className="btn btn-primary" disabled={!consent || busy} onClick={buy}>
                {busy ? '…' : `Plati ${coins} novčića`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
