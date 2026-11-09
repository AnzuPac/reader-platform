'use client';
import { useEffect, useState } from 'react';

type Page = { id: number; page_no: number; file_path: string };

export default function PagesManager({ workSlug }: { workSlug: string }) {
  const [number, setNumber] = useState(1);
  const [pages, setPages] = useState<Page[]>([]);
  const [msg, setMsg] = useState('');

  async function load(n = number) {
    const r = await fetch(`/api/author/pages?work=${encodeURIComponent(workSlug)}&number=${n}`);
    if (!r.ok) return;
    const j = await r.json();
    setPages(j.pages || []);
  }
  useEffect(() => { load(); }, [workSlug, number]);

  async function remove(id: number) {
    const r = await fetch(`/api/author/pages?id=${id}`, { method: 'DELETE' });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? `Удалено, осталось ${j.total}` : 'Ошибка удаления');
    await load();
  }

  async function move(id: number, dir: 'up' | 'down') {
    const r = await fetch('/api/author/pages/move', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, dir }),
    });
    if (r.ok) await load();
  }

  return (
    <div className="card mt-6 p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-semibold">Страницы главы</span>
        <input className="input max-w-[90px]" type="number" min={1} value={number}
               onChange={(e) => setNumber(Number(e.target.value))} />
        <span className="text-sm muted">{pages.length} страниц</span>
        {msg ? <span className="text-sm text-hot">{msg}</span> : null}
      </div>

      {pages.length === 0 ? (
        <p className="text-sm muted">В этой главе пока нет страниц.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
          {pages.map((p) => (
            <div key={p.id} className="rounded-lg border border-line p-1">
              <img src={p.file_path} alt={`Стр. ${p.page_no}`} className="mb-1 h-28 w-full rounded object-cover" loading="lazy" />
              <div className="flex items-center justify-between px-1 text-xs">
                <span className="muted">{p.page_no}</span>
                <div className="flex gap-1">
                  <button className="text-mist hover:text-brand" onClick={() => move(p.id, 'up')} title="Выше">↑</button>
                  <button className="text-mist hover:text-brand" onClick={() => move(p.id, 'down')} title="Ниже">↓</button>
                  <button className="text-mist hover:text-hot" onClick={() => remove(p.id)} title="Удалить">✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
