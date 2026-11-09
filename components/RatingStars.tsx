'use client';
import { useEffect, useState } from 'react';

export default function RatingStars({ workId, initialAvg, initialCount }: { workId: number; initialAvg: string; initialCount?: number }) {
  const [avg, setAvg] = useState(Number(initialAvg) || 0);
  const [count, setCount] = useState(initialCount || 0);
  const [mine, setMine] = useState(0);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`/api/rate?workId=${workId}`).then((r) => r.json()).then((j) => {
      setAvg(Number(j.avg) || 0); setCount(j.count || 0); setMine(j.mine || 0);
    }).catch(() => {});
  }, [workId]);

  async function rate(v: number) {
    const r = await fetch('/api/rate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workId, value: v }),
    });
    if (r.status === 401) { setMsg('Prvo se prijavi.'); return; }
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setAvg(Number(j.avg)); setCount(j.count); setMine(v); setMsg(''); }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((v) => (
          <button key={v} onClick={() => rate(v)} title={`${v} / 5`}
            className={v <= (mine || Math.round(avg)) ? 'text-hot' : 'text-line'}>★</button>
        ))}
      </div>
      <span className="muted">{avg.toFixed(2)} · {count} ocena</span>
      {msg ? <span className="text-xs text-hot">{msg}</span> : null}
    </div>
  );
}
