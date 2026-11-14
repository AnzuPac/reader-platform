'use client';
import { useState } from 'react';

/**
 * Кнопка «Podrži autora» + модалка доната.
 * Сумма вводится в евро, на сервер уходит целыми центами.
 */
export default function DonateButton({
  workId,
  chapterId,
  lang = 'sr',
  authorName,
}: {
  workId: number;
  chapterId?: number;
  lang?: string;
  authorName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('5');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);

  function reset() {
    setOpen(false);
    setBusy(false);
    setNote('');
    setDone(false);
    setMessage('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const eur = Number(String(amount).replace(',', '.'));
    const cents = Math.round(eur * 100);
    if (!Number.isFinite(cents) || cents < 100 || cents > 100000) {
      setNote('Iznos mora biti između 1 i 1000 EUR.');
      return;
    }
    if (message.length > 300) {
      setNote('Poruka može imati najviše 300 znakova.');
      return;
    }
    setBusy(true);
    setNote('');
    try {
      const r = await fetch('/api/donate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workId, chapterId, amountCents: cents, message, lang }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) {
        setNote('Prvo se prijavi.');
        return;
      }
      if (!r.ok) {
        if (j.error === 'self_donation') setNote('Ne možeš donirati sam sebi.');
        else if (j.error === 'invalid_amount') setNote('Iznos mora biti između 1 i 1000 EUR.');
        else if (j.error === 'message_too_long') setNote('Poruka je predugačka.');
        else if (j.error === 'work_not_found') setNote('Delo nije pronađeno.');
        else setNote('DONACIJA NIJE POSLATA. Pokušaj ponovo.');
        return;
      }
      if (j.mode === 'stripe' && j.url) {
        window.location.href = j.url;
        return;
      }
      setDone(true);
      setNote(String(j.instructions || 'Zahtev je poslat. Autor dobija podršku nakon potvrde uplate.'));
    } catch {
      setNote('Greška u mreži.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        💜 Podrži autora
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={reset}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="donate-title"
            className="card w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h2 id="donate-title" className="text-lg font-bold">Podrži autora</h2>
                <p className="text-sm muted">
                  {authorName ? `${authorName} · ` : ''}90% ide autoru, 10% platformi.
                </p>
              </div>
              <button type="button" className="text-sm muted hover:text-ink" onClick={reset} aria-label="Zatvori">✕</button>
            </div>

            {done ? (
              <div className="space-y-3">
                <p className="text-sm">{note}</p>
                <button type="button" className="btn btn-primary" onClick={reset}>Zatvori</button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <span className="mb-1 block text-xs font-semibold muted">Iznos (EUR)</span>
                  <div className="mb-2 flex gap-2">
                    {['2', '5', '10'].map((v) => (
                      <button
                        type="button"
                        key={v}
                        onClick={() => setAmount(v)}
                        className={`rounded px-3 py-1 text-sm ${amount === v ? 'bg-brand text-white' : 'border border-line text-mist'}`}
                      >
                        {v} €
                      </button>
                    ))}
                  </div>
                  <input
                    className="input"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    aria-label="Iznos donacije u evrima"
                  />
                </div>

                <div>
                  <label htmlFor="donate-message" className="mb-1 block text-xs font-semibold muted">
                    Poruka (opciono, do 300 znakova)
                  </label>
                  <textarea
                    id="donate-message"
                    className="input"
                    rows={3}
                    maxLength={300}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Hvala za priču!"
                  />
                  <div className="mt-1 text-right text-xs muted">{message.length}/300</div>
                </div>

                {note ? <p className="text-sm text-pink-300">{note}</p> : null}

                <div className="flex items-center gap-3">
                  <button className="btn btn-primary" disabled={busy}>
                    {busy ? '…' : 'Pošalji podršku'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={reset}>Otkaži</button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
