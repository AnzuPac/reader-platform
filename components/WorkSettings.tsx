'use client';
import { useState } from 'react';

export default function WorkSettings({
  workSlug, initialTitle, initialDescription, initialAge, initialCompletion,
}: {
  workSlug: string; initialTitle: string; initialDescription: string;
  initialAge: number; initialCompletion: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [desc, setDesc] = useState(initialDescription);
  const [age, setAge] = useState(initialAge);
  const [completion, setCompletion] = useState(initialCompletion);
  const [msg, setMsg] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);

  async function uploadCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('workSlug', workSlug);
    fd.append('file', file);
    const r = await fetch('/api/author/cover', { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? 'Обложка загружена' : 'Ошибка обложки: ' + (j.error || r.status));
    e.target.value = '';
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/author/work', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: workSlug, title, description: desc, ageRating: age, completion }),
    });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? 'Сохранено' : 'Ошибка: ' + (j.error || r.status));
  }

  if (!open) {
    return (
      <button className="btn btn-ghost mb-4" onClick={() => setOpen(true)}>Настройки произведения</button>
    );
  }

  return (
    <form onSubmit={save} className="card mb-5 space-y-3 p-4">
      <div className="flex items-center justify-between">
        <span className="font-semibold">Настройки произведения</span>
        <button type="button" className="text-sm muted hover:text-ink" onClick={() => setOpen(false)}>свернуть</button>
      </div>
      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название" />
      <textarea className="input" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Описание" />
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          Возраст:
          <select className="input max-w-[100px]" value={age} onChange={(e) => setAge(Number(e.target.value))}>
            <option value={0}>0+</option>
            <option value={16}>16+</option>
            <option value={18}>18+</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          Статус:
          <select className="input max-w-[170px]" value={completion} onChange={(e) => setCompletion(e.target.value)}>
            <option value="ongoing">В работе</option>
            <option value="completed">Завершено</option>
            <option value="hiatus">Пауза</option>
          </select>
        </label>
        <button className="btn btn-primary">Сохранить</button>
        <label className="btn btn-ghost cursor-pointer">
          Обложка
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={uploadCover} />
        </label>
        {msg ? <span className="text-hot">{msg}</span> : null}
      </div>
    </form>
  );
}
