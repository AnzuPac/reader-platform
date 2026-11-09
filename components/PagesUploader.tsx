'use client';
import { useRef, useState } from 'react';

export default function PagesUploader({ workSlug }: { workSlug: string }) {
  const [number, setNumber] = useState(1);
  const [title, setTitle] = useState('');
  const [access, setAccess] = useState('free');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusy(true); setMsg(`Загружаю ${files.length} страниц…`);
    const fd = new FormData();
    fd.append('workSlug', workSlug);
    fd.append('number', String(number));
    fd.append('title', title || `Glava ${number}`);
    fd.append('access', access);
    files.forEach((f) => fd.append('files', f));
    const r = await fetch('/api/author/pages', { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg('Ошибка: ' + (j.error || r.status)); return; }
    setMsg(`Готово: ${j.pages} страниц добавлено, всего ${j.total}`);
    e.target.value = '';
  }

  return (
    <div className="card mt-6 space-y-3 p-5">
      <div className="font-semibold">Страницы комикса</div>
      <div className="flex flex-wrap items-center gap-2">
        <input className="input max-w-[100px]" type="number" min={1} value={number} onChange={(e) => setNumber(Number(e.target.value))} />
        <input className="input max-w-[220px]" placeholder="Название главы" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select className="input max-w-[180px]" value={access} onChange={(e) => setAccess(e.target.value)}>
          <option value="free">Бесплатно</option>
          <option value="subscribers">Подписчики</option>
          <option value="paid">Платная</option>
        </select>
        <button className="btn btn-primary" onClick={() => ref.current?.click()} disabled={busy}>Выбрать страницы</button>
        <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={upload} />
      </div>
      <p className="text-xs muted">Можно выбрать сразу несколько картинок — они добавятся по порядку номеров страниц.</p>
      {msg ? <p className="text-sm text-hot">{msg}</p> : null}
    </div>
  );
}
