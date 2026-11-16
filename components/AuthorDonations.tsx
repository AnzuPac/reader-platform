'use client';
import { useEffect, useState } from 'react';

type Balance = { currency: string; received_cents: number; requested_cents: number; available_cents: number };
type History = {
  id: number; amount_cents: number; author_cents: number; currency: string;
  message: string; status: string; created_at: string; donor_name: string;
  work_title: string; chapter_number: number | null;
};
type Payout = { id: number; amount_cents: number; currency: string; status: string; created_at: string };
type Summary = { balances: Balance[]; history: History[]; payouts: Payout[] };

function money(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

/** Кабинет автора: «Dobijeno», история донатов и заявка на выплату. */
export default function AuthorDonations() {
  const [data, setData] = useState<Summary>({ balances: [], history: [], payouts: [] });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch('/api/author/donations');
    if (!r.ok) {
      setMsg('Nema pristupa: potrebna je uloga autora');
      return;
    }
    setData(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function requestPayout(currency: string) {
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/author/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(j.error === 'nothing_to_pay' ? 'Nema dostupnog iznosa.' : 'Greška prijave: ' + (j.error || r.status));
        return;
      }
      setMsg(`Zahtev #${j.payoutId} na ${money(j.amount_cents, j.currency)} napravljen.`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">Dobijeno</h2>
        <span className="text-sm muted">Donacije čitalaca</span>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {data.balances.length === 0 ? (
          <p className="text-sm muted sm:col-span-3">Пока нет донатов.</p>
        ) : data.balances.map((b) => (
          <div key={b.currency} className="rounded-lg border border-line p-3">
            <div className="text-xs muted">Получено · {b.currency}</div>
            <div className="text-xl font-bold">{money(b.received_cents, b.currency)}</div>
            <div className="mt-1 text-xs muted">Запрошено: {money(b.requested_cents, b.currency)}</div>
            <div className="mt-1 text-sm">
              Za isplatu: <strong>{money(b.available_cents, b.currency)}</strong>
            </div>
            <button
              type="button"
              className="btn btn-ghost mt-2 w-full"
              disabled={busy || b.available_cents <= 0}
              onClick={() => requestPayout(b.currency)}
            >
              Zatraži isplatu
            </button>
          </div>
        ))}
      </div>

      {msg ? <p className="mb-3 text-sm text-brand">{msg}</p> : null}

      <h3 className="mb-2 text-sm font-semibold">История донатов</h3>
      <ul className="divide-y divide-line text-sm">
        {data.history.map((h) => (
          <li key={h.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="font-semibold">{money(h.amount_cents, h.currency)}</span>
            <span className="muted">→ autoru {money(h.author_cents, h.currency)}</span>
            <span className="flex-1 truncate text-xs muted">
              {h.donor_name} · {h.work_title}{h.chapter_number ? ` · glava ${h.chapter_number}` : ''}
              {h.message ? ` — «${h.message}»` : ''}
            </span>
            <span className={h.status === 'paid' ? 'text-brand' : 'badge-hot'}>{h.status}</span>
            <span className="text-xs muted">{String(h.created_at).slice(0, 10)}</span>
          </li>
        ))}
        {data.history.length === 0 ? <li className="py-3 muted">Донатов ещё нет.</li> : null}
      </ul>

      <h3 className="mb-2 mt-5 text-sm font-semibold">Заявки на выплату</h3>
      <ul className="divide-y divide-line text-sm">
        {data.payouts.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="muted">#{p.id}</span>
            <span className="flex-1">{money(p.amount_cents, p.currency)}</span>
            <span className={p.status === 'paid' ? 'text-brand' : 'badge-hot'}>{p.status}</span>
            <span className="text-xs muted">{String(p.created_at).slice(0, 10)}</span>
          </li>
        ))}
        {data.payouts.length === 0 ? <li className="py-3 muted">Заявок ещё нет.</li> : null}
      </ul>
    </section>
  );
}
