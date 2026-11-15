'use client';
import { useEffect, useState } from 'react';

type Pack = { code: string; coins: number; price_rsd: number; bonus_coins: number };
type Tx = { id: number; delta: number; kind: string; ref_id: string | null; balance_after: number; created_at: string };
type Settings = { auto_unlock: boolean; monthly_spend_limit_coins: number };

const KIND_LABEL: Record<string, string> = {
  topup: 'Dopuna',
  spend: 'Potrošnja',
  refund: 'Povraćaj',
  bonus: 'Bonus',
};

/** Кошелёк: баланс монет, пополнение пакетами, история, лимиты расходов. */
export default function WalletPanel({ compact = false, initial }: { compact?: boolean; initial?: {
  balance_coins: number; packages: Pack[]; history: Tx[]; settings: Settings;
} }) {
  const [balance, setBalance] = useState(initial?.balance_coins ?? 0);
  const [packages, setPackages] = useState<Pack[]>(initial?.packages ?? []);
  const [history, setHistory] = useState<Tx[]>(initial?.history ?? []);
  const [settings, setSettings] = useState<Settings>(
    initial?.settings ?? { auto_unlock: false, monthly_spend_limit_coins: 0 }
  );
  const [limit, setLimit] = useState(String(initial?.settings?.monthly_spend_limit_coins ?? 0));
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch('/api/wallet');
    if (!r.ok) { setMsg('Prvo se prijavi.'); return; }
    const j = await r.json();
    setBalance(Number(j.balance_coins || 0));
    setPackages(j.packages || []);
    setHistory(j.history || []);
    setSettings(j.settings || { auto_unlock: false, monthly_spend_limit_coins: 0 });
    setLimit(String(j.settings?.monthly_spend_limit_coins ?? 0));
  }
  useEffect(() => { load(); }, []);

  async function topUp(code: string) {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/wallet', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageCode: code }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg('Greška: ' + (j.error || r.status)); return; }
      if (j.mode === 'stripe' && j.url) { window.location.href = j.url; return; }
      setMsg(j.instructions || 'Zahtev je poslat.');
      await load();
    } finally { setBusy(false); }
  }

  async function saveSettings(next: Partial<Settings>) {
    setBusy(true); setMsg('');
    try {
      const merged = { ...settings, ...next };
      const r = await fetch('/api/wallet', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'settings',
          autoUnlock: merged.auto_unlock,
          monthlySpendLimitCoins: Number(limit) || 0,
        }),
      });
      if (!r.ok) { setMsg('Greška pri čuvanju.'); return; }
      setSettings(merged);
      setMsg('Sačuvano.');
    } finally { setBusy(false); }
  }

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="mr-auto font-bold">Novčanik</h2>
        <span className="rounded-full bg-brand/10 px-3 py-1 text-sm font-semibold text-brand">
          {balance} novčića · {balance} RSD
        </span>
      </div>

      <p className="mb-4 text-xs muted">1 novčić = 1 RSD. Novčići ne ističu.</p>

      <div className="mb-5 grid gap-2 sm:grid-cols-4">
        {packages.map((p) => (
          <button
            key={p.code}
            type="button"
            className="rounded-lg border border-line p-3 text-left hover:border-brand"
            disabled={busy}
            onClick={() => topUp(p.code)}
          >
            <div className="text-lg font-bold">{p.coins}</div>
            <div className="text-xs muted">{p.price_rsd} RSD{p.bonus_coins ? ` · +${p.bonus_coins} bonus` : ''}</div>
          </button>
        ))}
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.auto_unlock}
            onChange={(e) => saveSettings({ auto_unlock: e.target.checked })}
          />
          Automatsko otključavanje glava (podrazumevano isključeno)
        </label>
        <div className="flex items-center gap-2 text-sm">
          <span className="muted">Limit potrošnje / mesec (0 = bez limita):</span>
          <input
            className="input max-w-[90px]"
            inputMode="numeric"
            value={limit}
            onChange={(e) => setLimit(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={() => saveSettings({})}
          />
        </div>
      </div>

      {msg ? <p className="mb-3 text-sm text-brand">{msg}</p> : null}

      {!compact ? (
        <>
          <h3 className="mb-2 text-sm font-semibold">Istorija</h3>
          <ul className="divide-y divide-line text-sm">
            {history.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className={t.delta > 0 ? 'text-brand font-semibold' : 'font-semibold'}>
                  {t.delta > 0 ? '+' : ''}{t.delta}
                </span>
                <span className="text-xs muted">{KIND_LABEL[t.kind] || t.kind}</span>
                <span className="flex-1 truncate text-xs muted">{t.ref_id || ''}</span>
                <span className="text-xs muted">balans {t.balance_after}</span>
                <span className="text-xs muted">{String(t.created_at).slice(0, 10)}</span>
              </li>
            ))}
            {history.length === 0 ? <li className="py-3 muted">Još nema kretanja.</li> : null}
          </ul>
        </>
      ) : null}
    </section>
  );
}
