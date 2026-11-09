'use client';
import { useEffect, useRef, useState } from 'react';

type FileRow = { id: number; bytes: number; mime: string; kind: string; created_at: string };
type Quota = { used: number; limit: number; plan: string };

function fmt(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export default function StorageManager() {
  const [quota, setQuota] = useState<Quota | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function load() {
    const r = await fetch('/api/storage');
    if (!r.ok) { setMsg('Нужно войти в аккаунт'); return; }
    const j = await r.json();
    setQuota(j.quota); setFiles(j.files || []);
  }
  useEffect(() => { load(); }, []);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setMsg('Загружаю…');
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('/api/storage', { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    e.target.value = '';
    if (r.status === 401) { setMsg('Нужно войти в аккаунт'); return; }
    if (!r.ok) {
      setMsg(j.error === 'quota_exceeded' ? 'Не хватает места в хранилище' : 'Ошибка загрузки: ' + (j.error || r.status));
      return;
    }
    setQuota(j.quota); setMsg('Файл загружен'); await load();
  }

  async function remove(id: number) {
    const r = await fetch(`/api/storage?id=${id}`, { method: 'DELETE' });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setQuota(j.quota); await load(); }
  }

  const pct = quota ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0;

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold">Хранилище</span>
          <span className="muted">
            {quota ? `${fmt(quota.used)} из ${fmt(quota.limit)} · тариф ${quota.plan}` : '—'}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#221a35]">
          <div className="h-full rounded-full bg-gradient-to-r from-brand to-hot" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button className="btn btn-primary" onClick={() => ref.current?.click()} disabled={busy}>
            {busy ? 'Загружаю…' : 'Загрузить скан или файл'}
          </button>
          <input ref={ref} type="file" accept=".pdf,.epub,.docx,.txt,image/*" className="hidden" onChange={upload} />
          {msg ? <span className="text-sm text-hot">{msg}</span> : null}
        </div>
        <p className="mt-2 text-xs muted">
          Бесплатно — 1 ГБ. Сканирование книг выполняется на устройстве, сюда попадает готовый PDF или EPUB.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-line px-5 py-3 font-semibold">Мои файлы ({files.length})</div>
        <ul className="divide-y divide-line">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              <span className="flex-1">{f.mime}</span>
              <span className="muted">{fmt(f.bytes)}</span>
              <span className="text-xs muted">{String(f.created_at).slice(0, 16)}</span>
              <a className="text-brand" href={`/api/storage/file/${f.id}`} target="_blank" rel="noreferrer">открыть</a>
              <button className="text-xs muted hover:text-hot" onClick={() => remove(f.id)}>удалить</button>
            </li>
          ))}
          {files.length === 0 ? <li className="px-5 py-4 text-sm muted">Пока пусто</li> : null}
        </ul>
      </div>
    </div>
  );
}
