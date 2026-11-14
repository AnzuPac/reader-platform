'use client';
import { useState } from 'react';

type Line = { currency: string; sales: number; gross_cents: number; commission_cents: number; royalty_cents: number };
type Work = {
  id: number; slug: string; title: string; amount_cents: number | null; currency: string | null;
  sales: number; gross_cents: number; royalty_cents: number;
};
type Report = {
  from: string; to: string;
  byCurrency: Line[];
  payable: { currency: string; amount_cents: number }[];
  works: Work[];
};

function money(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

export default function PublisherReport({
  publisherId,
  initialFrom,
  initialTo,
  initialReport,
}: {
  publisherId: number;
  initialFrom: string;
  initialTo: string;
  initialReport: Report;
}) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [report, setReport] = useState<Report>(initialReport);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function load(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true); setMsg('');
    const qs = new URLSearchParams({ publisher: String(publisherId), from, to });
    const r = await fetch(`/api/publisher/report?${qs.toString()}`);
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(`Greška: ${j.error || r.status}`); return; }
    setReport(j.report);
  }

  const csvHref = `/api/publisher/report?publisher=${publisherId}&from=${from}&to=${to}&format=csv`;

  const totalRoyalty = report.byCurrency.reduce((s, l) => s + l.royalty_cents, 0);
  const totalGross = report.byCurrency.reduce((s, l) => s + l.gross_cents, 0);
  const totalSales = report.byCurrency.reduce((s, l) => s + l.sales, 0);
  const singleCurrency = report.byCurrency.length === 1 ? report.byCurrency[0].currency : '';

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <h2 className="mr-auto text-lg font-bold">Izveštaj za period</h2>
        <form onSubmit={load} className="flex flex-wrap items-end gap-2">
          <label className="text-xs muted">
            Od
            <input type="date" className="input mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-xs muted">
            Do
            <input type="date" className="input mt-1" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button className="btn btn-ghost" disabled={busy}>{busy ? '…' : 'Prikaži'}</button>
        </form>
        <a className="btn btn-primary" href={csvHref}>CSV</a>
      </div>

      {msg ? <p className="mb-3 text-sm text-hot">{msg}</p> : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line p-3">
          <div className="text-xs muted">Prodaje</div>
          <div className="text-xl font-bold">{totalSales}</div>
        </div>
        <div className="rounded-lg border border-line p-3">
          <div className="text-xs muted">Prihod</div>
          <div className="text-xl font-bold">
            {singleCurrency ? money(totalGross, singleCurrency) : `${totalGross} (centi)`}
          </div>
        </div>
        <div className="rounded-lg border border-line p-3">
          <div className="text-xs muted">Rojalit</div>
          <div className="text-xl font-bold">
            {singleCurrency ? money(totalRoyalty, singleCurrency) : `${totalRoyalty} (centi)`}
          </div>
        </div>
      </div>

      {report.byCurrency.length === 0 ? (
        <p className="text-sm muted">Nema prodaja u izabranom periodu.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase muted">
              <tr>
                <th className="py-1 pr-3">Valuta</th>
                <th className="py-1 pr-3">Prodaje</th>
                <th className="py-1 pr-3">Prihod</th>
                <th className="py-1 pr-3">Provizija</th>
                <th className="py-1 pr-3">Rojalit</th>
              </tr>
            </thead>
            <tbody>
              {report.byCurrency.map((r) => (
                <tr key={r.currency} className="border-t border-line">
                  <td className="py-1.5 pr-3 font-semibold">{r.currency}</td>
                  <td className="py-1.5 pr-3">{r.sales}</td>
                  <td className="py-1.5 pr-3">{money(r.gross_cents, r.currency)}</td>
                  <td className="py-1.5 pr-3">{money(r.commission_cents, r.currency)}</td>
                  <td className="py-1.5 pr-3 font-semibold">{money(r.royalty_cents, r.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5">
        <h3 className="mb-2 font-semibold">Za isplatu (načeto, neisplaćeno)</h3>
        {report.payable.length === 0 ? (
          <p className="text-sm muted">Nema neisplaćenih rojalita.</p>
        ) : (
          <ul className="flex flex-wrap gap-3 text-sm">
            {report.payable.map((p) => (
              <li key={p.currency} className="rounded-lg border border-line px-3 py-2">
                <span className="muted">{p.currency}:</span>{' '}
                <span className="font-semibold">{money(p.amount_cents, p.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
