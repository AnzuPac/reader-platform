'use client';
import { useEffect, useState } from 'react';

type Work = { id: number; slug: string; title: string; status: string; words_total: number };

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [works, setWorks] = useState<Work[]>([]);
  const [msg, setMsg] = useState('');

  // произведение
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [age, setAge] = useState(0);

  // глава
  const [slug, setSlug] = useState('');
  const [number, setNumber] = useState(1);
  const [chTitle, setChTitle] = useState('');
  const [content, setContent] = useState('');
  const [access, setAccess] = useState('free');

  useEffect(() => {
    const saved = localStorage.getItem('admin_token') || '';
    setToken(saved);
    if (saved) load(saved);
  }, []);

  async function load(tk = token) {
    const r = await fetch('/api/admin/work', { headers: { 'x-admin-token': tk } });
    if (!r.ok) { setMsg('Токен не подходит'); return; }
    const j = await r.json();
    setWorks(j.works || []);
  }

  async function saveToken() {
    localStorage.setItem('admin_token', token);
    await load(token);
    setMsg('Токен сохранён');
  }

  async function createWork(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/admin/work', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ title, description: desc, ageRating: age }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg('Ошибка: ' + (j.error || r.status)); return; }
    setMsg('Произведение создано: ' + j.work.slug);
    setTitle(''); setDesc(''); setAge(0);
    await load();
  }

  async function createChapter(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/admin/chapter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ workSlug: slug, number, title: chTitle, content, access }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg('Ошибка: ' + (j.error || r.status)); return; }
    setMsg(`Глава ${j.chapter.number} добавлена`);
    setChTitle(''); setContent('');
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="mb-6 text-3xl font-bold">Админка</h1>

      <div className="card mb-6 p-4">
        <label className="mb-1 block text-sm muted">Токен доступа</label>
        <div className="flex gap-2">
          <input className="input" value={token} onChange={(e) => setToken(e.target.value)} />
          <button className="btn btn-ghost" onClick={saveToken}>Сохранить</button>
        </div>
      </div>

      {msg ? <p className="mb-4 text-sm text-sakura">{msg}</p> : null}

      <form onSubmit={createWork} className="card mb-6 space-y-3 p-4">
        <h2 className="font-semibold">Новое произведение</h2>
        <input className="input" placeholder="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="input" placeholder="Описание" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
        <div className="flex items-center gap-3">
          <span className="text-sm muted">Возраст:</span>
          {[0, 16, 18].map((a) => (
            <label key={a} className="flex items-center gap-1 text-sm">
              <input type="radio" checked={age === a} onChange={() => setAge(a)} /> {a || '0'}
            </label>
          ))}
        </div>
        <button className="btn btn-primary">Создать</button>
      </form>

      <form onSubmit={createChapter} className="card mb-6 space-y-3 p-4">
        <h2 className="font-semibold">Новая глава</h2>
        <select className="input" value={slug} onChange={(e) => setSlug(e.target.value)}>
          <option value="">— выбери произведение —</option>
          {works.map((w) => <option key={w.id} value={w.slug}>{w.title}</option>)}
        </select>
        <div className="flex gap-2">
          <input className="input" type="number" min={1} value={number} onChange={(e) => setNumber(Number(e.target.value))} style={{ width: 110 }} />
          <input className="input" placeholder="Название главы" value={chTitle} onChange={(e) => setChTitle(e.target.value)} />
        </div>
        <textarea className="input" placeholder="Текст главы" rows={10} value={content} onChange={(e) => setContent(e.target.value)} />
        <div className="flex items-center gap-3 text-sm">
          <span className="muted">Доступ:</span>
          <select className="input" value={access} onChange={(e) => setAccess(e.target.value)} style={{ width: 200 }}>
            <option value="free">Бесплатно</option>
            <option value="subscribers">Подписчики</option>
            <option value="paid">Платная</option>
          </select>
        </div>
        <button className="btn btn-primary">Добавить главу</button>
      </form>

      <div className="card p-4">
        <h2 className="mb-2 font-semibold">Произведения ({works.length})</h2>
        <ul className="divide-y divide-line/60 text-sm">
          {works.map((w) => (
            <li key={w.id} className="flex items-center justify-between py-2">
              <span>{w.title}</span>
              <span className="text-xs muted">{w.slug} · {w.words_total} слов · {w.status}</span>
            </li>
          ))}
          {works.length === 0 ? <li className="py-2 muted">Пока пусто</li> : null}
        </ul>
      </div>
    </main>
  );
}
