'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Work = { id: number; slug: string; title: string; status: string; words_total: number; updated_at: string; views_total: number; chapters: number; readers: number };

export default function AuthorWorks({ lang }: { lang: string }) {
  const [works, setWorks] = useState<Work[]>([]);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    const r = await fetch('/api/author/work');
    if (!r.ok) { setMsg('Нет доступа: нужна роль автора'); return; }
    const j = await r.json();
    setWorks(j.works || []);
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/author/work', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description: desc }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg('Ошибка: ' + (j.error || r.status)); return; }
    setTitle(''); setDesc(''); setMsg('Черновик создан');
    await load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="card space-y-3 p-5">
        <h2 className="font-semibold">Новое произведение</h2>
        <input className="input" placeholder="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="input" rows={3} placeholder="Описание" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <button className="btn btn-primary">Создать черновик</button>
      </form>

      {msg ? <p className="text-sm text-hot">{msg}</p> : null}

      <div className="card overflow-hidden">
        <div className="border-b border-line px-5 py-3 font-semibold">Мои произведения</div>
        <ul className="divide-y divide-line">
          {works.map((w) => (
            <li key={w.id} className="flex items-center gap-3 px-5 py-3">
              <span className="flex-1 font-medium">{w.title}</span>
              <span className="text-xs muted">{w.chapters} гл · {w.words_total} слов · 👁 {w.views_total} · 👤 {w.readers}</span>
              <span className="text-xs muted">{w.status}</span>
              <Link href={`/${lang}/author/${w.slug}`} className="btn btn-ghost">Редактор</Link>
            </li>
          ))}
          {works.length === 0 ? <li className="px-5 py-4 text-sm muted">Пока нет произведений</li> : null}
        </ul>
      </div>
    </div>
  );
}
