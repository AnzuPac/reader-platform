'use client';
import { useEffect, useState } from 'react';

type WorkStats = {
  id: number; slug: string; title: string;
  readers: number; readers7: number; readers30: number;
  gender: { m: number; f: number; other: number; unknown: number };
  age: Record<string, number>;
  region: Record<string, number>;
  furthestChapter: number | null;
  avgPercent: number;
  bookmarks: number; subscribers: number; purchases: number; purchasesSum: number;
};
type Stats = { works: WorkStats[]; totals: { readers: number; bookmarks: number; subscribers: number; purchases: number; purchasesSum: number } };

export default function AuthorStats() {
  const [st, setSt] = useState<Stats | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/author/stats').then(async (r) => {
      if (!r.ok) { setMsg('Статистика недоступна'); return; }
      setSt(await r.json());
    }).catch(() => setMsg('Статистика недоступна'));
  }, []);

  if (msg) return <div className="card p-5 text-sm muted">{msg}</div>;
  if (!st) return <div className="card p-5 text-sm muted">Считаю статистику…</div>;

  const t = st.totals;
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="mb-3 font-semibold">Статистика</h2>
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <div><div className="muted">Читателей</div><div className="text-xl font-bold">{t.readers}</div></div>
          <div><div className="muted">Закладок</div><div className="text-xl font-bold">{t.bookmarks}</div></div>
          <div><div className="muted">Подписчиков</div><div className="text-xl font-bold">{t.subscribers}</div></div>
          <div><div className="muted">Покупок</div><div className="text-xl font-bold">{t.purchases}</div></div>
          <div><div className="muted">Сумма покупок</div><div className="text-xl font-bold">{(t.purchasesSum / 100).toFixed(2)} RSD</div></div>
        </div>
      </div>

      {st.works.map((w) => {
        const ages = Object.entries(w.age).filter(([, n]) => n > 0);
        const regions = Object.entries(w.region).sort((a, b) => b[1] - a[1]).slice(0, 5);
        return (
          <div key={w.id} className="card p-5 text-sm">
            <div className="mb-2 font-semibold">{w.title}</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <div className="muted">Читатели</div>
                <div>{w.readers} всего · {w.readers7} за 7 дн · {w.readers30} за 30 дн</div>
                <div className="muted mt-1">Дочитали до</div>
                <div>{w.furthestChapter ? `глава ${w.furthestChapter}` : 'ещё не открывали'} · в среднем {w.avgPercent}%</div>
              </div>
              <div>
                <div className="muted">Пол</div>
                <div>♂ {w.gender.m} · ♀ {w.gender.f} · другой {w.gender.other} · не указан {w.gender.unknown}</div>
                <div className="muted mt-1">Возраст</div>
                <div>{ages.length ? ages.map(([b, n]) => `${b}: ${n}`).join(' · ') : 'данных нет'}</div>
              </div>
              <div>
                <div className="muted">География / язык</div>
                <div>{regions.length ? regions.map(([r, n]) => `${r}: ${n}`).join(' · ') : 'данных нет'}</div>
                <div className="muted mt-1">Закладки · подписчики · покупки</div>
                <div>{w.bookmarks} · {w.subscribers} · {w.purchases} ({(w.purchasesSum / 100).toFixed(2)} RSD)</div>
              </div>
            </div>
          </div>
        );
      })}
      {st.works.length === 0 ? <div className="card p-5 text-sm muted">Пока нет произведений.</div> : null}
    </div>
  );
}
