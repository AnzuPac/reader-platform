'use client';
import { useEffect, useState } from 'react';

type Total = { currency: string; gross_cents: number; commission_cents: number; net_cents: number; donations_cents: number };
type WorkRow = {
  id: number; title: string; slug: string; exclusivity: boolean;
  share_pct: number; commission_pct: number; sales_cents: number; donations_cents: number; net_cents: number;
};
type Payout = { id: number; amount_cents: number; currency: string; status: string; created_at: string };
type Income = { totals: Total[]; works: WorkRow[]; payouts: Payout[]; payout_threshold_cents: number };

function rsd(cents: number): string {
  const n = Math.trunc(cents || 0);
  return n % 100 === 0 ? `${n / 100} RSD` : `${(n / 100).toFixed(2).replace('.', ',')} RSD`;
}

/** Доход автора: ставка 70/80, продажи и донаты, выплаты. */
export default function AuthorIncome({ initial }: { initial?: Income | null }) {
  const [data, setData] = useState<Income | null>(initial ?? null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch('/api/author/income');
    if (!r.ok) { setMsg('Nema pristupa: potrebna je uloga autora'); return; }
    setData(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function toggle(work: WorkRow) {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/author/exclusivity', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workId: work.id, exclusivity: !work.exclusivity }),
      });
      if (!r.ok) { setMsg('Не удалось изменить ставку.'); return; }
      setMsg(!work.exclusivity ? 'Ekskluzivitet uključen: 80% autoru.' : 'Ekskluzivitet isključen: 70% autoru.');
      await load();
    } finally { setBusy(false); }
  }

  if (!data) {
    return <section className="card p-5 text-sm muted">{msg || 'Загрузка дохода…'}</section>;
  }

  const rsdTotal = data.totals.find((t) => t.currency === 'RSD') || {
    currency: 'RSD', gross_cents: 0, commission_cents: 0, net_cents: 0, donations_cents: 0,
  };

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">Dohodak</h2>
        <span className="text-sm muted">Ставка: 70% · эксклюзив 80% · выплаты от 2 000 RSD</span>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line p-3">
          <div className="text-xs muted">Брутто</div>
          <div className="text-xl font-bold">{rsd(rsdTotal.gross_cents)}</div>
        </div>
        <div className="rounded-lg border border-line p-3">
          <div className="text-xs muted">Комиссия платформы</div>
          <div className="text-xl font-bold">{rsd(rsdTotal.commission_cents)}</div>
        </div>
        <div className="rounded-lg border border-line p-3">
          <div className="text-xs muted">К выплате (нетто)</div>
          <div className="text-xl font-bold">{rsd(rsdTotal.net_cents)}</div>
          <div className="mt-1 text-xs muted">в т.ч. донаты: {rsd(rsdTotal.donations_cents)}</div>
        </div>
      </div>

      {msg ? <p className="mb-3 text-sm text-brand">{msg}</p> : null}

      <h3 className="mb-2 text-sm font-semibold">Произведения и ставка</h3>
      <ul className="divide-y divide-line text-sm">
        {data.works.map((w) => (
          <li key={w.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="min-w-0 flex-1 truncate">{w.title}</span>
            <span className="text-xs muted">
              продажи {rsd(w.sales_cents)} · донаты {rsd(w.donations_cents)}
            </span>
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
              {w.share_pct}%
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => toggle(w)}
            >
              {w.exclusivity ? 'Ukloni ekskluzivu' : 'Uključi ekskluzivitet (80%)'}
            </button>
          </li>
        ))}
        {data.works.length === 0 ? <li className="py-3 muted">Произведений пока нет.</li> : null}
      </ul>

      <h3 className="mb-2 mt-5 text-sm font-semibold">Выплаты</h3>
      <ul className="divide-y divide-line text-sm">
        {data.payouts.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="muted">#{p.id}</span>
            <span className="flex-1">{rsd(p.amount_cents)}</span>
            <span className={p.status === 'paid' ? 'text-brand' : 'badge-hot'}>{p.status}</span>
            <span className="text-xs muted">{String(p.created_at).slice(0, 10)}</span>
          </li>
        ))}
        {data.payouts.length === 0 ? <li className="py-3 muted">Заявок ещё нет.</li> : null}
      </ul>
      <p className="mt-3 text-xs muted">
        Порог выплаты: {rsd(data.payout_threshold_cents)}; удержание 60 дней — защита от возвратов.
      </p>
    </section>
  );
}
