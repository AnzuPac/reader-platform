'use client';
import { useState } from 'react';

type Props = {
  workId: number;
  publisherId: number | null;
  rightsSale: number;
  rightsSubscription: number;
  windowDays: number;
  regions: string;
  tts: number;
  excerpt: number;
};

export default function PublisherRightsEditor(p: Props) {
  const [sale, setSale] = useState(p.rightsSale === 1);
  const [sub, setSub] = useState(p.rightsSubscription === 1);
  const [days, setDays] = useState(p.windowDays || 0);
  const [regions, setRegions] = useState(p.regions || 'RS');
  const [tts, setTts] = useState(p.tts === 1);
  const [excerpt, setExcerpt] = useState(p.excerpt ?? 10);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMsg('');
    try {
      const r = await fetch(`/api/publisher/works/${p.workId}/rights?publisher=${p.publisherId ?? ''}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rights_sale: sale, rights_subscription: sub, subscription_window_days: days,
          regions, tts_allowed: tts, free_excerpt_pct: excerpt,
        }),
      });
      const j = await r.json().catch(() => ({}));
      setMsg(r.ok ? 'Sačuvano' : `Greška: ${j.error || r.status}`);
    } catch { setMsg('Greška'); }
    setBusy(false);
  }

  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer muted">Prava po knjizi</summary>
      <div className="mt-2 space-y-1">
        <label className="flex items-center gap-2"><input type="checkbox" checked={sale} onChange={(e) => setSale(e.target.checked)} /> Prodaja</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={sub} onChange={(e) => setSub(e.target.checked)} /> Pretplata</label>
        <label className="flex items-center gap-2">
          Okno novine (dana):
          <input type="number" min={0} max={365} value={days} onChange={(e) => setDays(Number(e.target.value) || 0)}
                 className="w-16 rounded border border-white/20 bg-transparent px-1 py-0.5" />
        </label>
        <label className="flex items-center gap-2">
          Regioni:
          <input value={regions} onChange={(e) => setRegions(e.target.value)}
                 className="w-24 rounded border border-white/20 bg-transparent px-1 py-0.5" />
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={tts} onChange={(e) => setTts(e.target.checked)} /> TTS</label>
        <label className="flex items-center gap-2">
          Odlomak, %:
          <input type="number" min={0} max={50} value={excerpt} onChange={(e) => setExcerpt(Number(e.target.value) || 0)}
                 className="w-16 rounded border border-white/20 bg-transparent px-1 py-0.5" />
        </label>
        <button onClick={save} disabled={busy} className="rounded border border-white/20 px-2 py-1">Sačuvaj prava</button>
        {msg ? <span className="ml-2 muted">{msg}</span> : null}
      </div>
    </details>
  );
}
