'use client';
import { useEffect, useState } from 'react';

type Page = { id: number; page_no: number; file_path: string };

export default function PagesManager({ workSlug }: { workSlug: string }) {
  const [number, setNumber] = useState(1);
  const [pages, setPages] = useState<Page[]>([]);
  const [chapterId, setChapterId] = useState(0);
  const [dragId, setDragId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  async function load(n = number) {
    const r = await fetch(`/api/author/pages?work=${encodeURIComponent(workSlug)}&number=${n}`);
    if (!r.ok) return;
    const j = await r.json();
    setPages(j.pages || []);
    setChapterId(j.chapterId || 0);
  }
  useEffect(() => { load(); }, [workSlug, number]);

  async function saveOrder(next: Page[]) {
    setPages(next);
    if (!chapterId) return;
    const r = await fetch('/api/author/pages/order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterId, ids: next.map((p) => p.id) }),
    });
    setMsg(r.ok ? 'Порядок сохранён' : 'Ошибка сохранения порядка');
    await load();
  }

  function onDrop(targetId: number) {
    if (dragId === null || dragId === targetId) return;
    const from = pages.findIndex((p) => p.id === dragId);
    const to = pages.findIndex((p) => p.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...pages];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDragId(null);
    saveOrder(next);
  }

  async function remove(id: number) {
    const r = await fetch(`/api/author/pages?id=${id}`, { method: 'DELETE' });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? `Удалено, осталось ${j.total}` : 'Ошибка удаления');
    await load();
  }

  async function move(id: number, dir: 'up' | 'down') {
    const i = pages.findIndex((p) => p.id === id);
    if (i < 0) return;
    const j = dir === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= pages.length) return;
    const next = [...pages];
    [next[i], next[j]] = [next[j], next[i]];
    await saveOrder(next);
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
        <>
          <p className="mb-3 text-xs muted">Перетащи картинку, чтобы поменять порядок.</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
            {pages.map((p, i) => (
              <div
                key={p.id}
                draggable
                onDragStart={() => setDragId(p.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(p.id)}
                onDragEnd={() => setDragId(null)}
                className={`cursor-grab rounded-lg border p-1 transition ${
                  dragId === p.id ? 'border-brand opacity-60' : 'border-line'
                }`}
              >
                <img src={p.file_path} alt={`Стр. ${p.page_no}`} className="mb-1 h-28 w-full rounded object-cover" loading="lazy" />
                <div className="flex items-center justify-between px-1 text-xs">
                  <span className="muted">{i + 1}</span>
                  <div className="flex gap-1">
                    <button className="text-mist hover:text-brand" onClick={() => move(p.id, 'up')} title="Выше">↑</button>
                    <button className="text-mist hover:text-brand" onClick={() => move(p.id, 'down')} title="Ниже">↓</button>
                    <button className="text-mist hover:text-hot" onClick={() => remove(p.id)} title="Удалить">✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
