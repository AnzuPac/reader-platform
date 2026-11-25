'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Book = {
  book_id: number; title: string; author: string | null; format: string; status: string; created_at: string;
  file_id: number | null; size_bytes: number | string | null; mime: string | null; storage: string | null; file_status: string | null;
};
type Data = { books: Book[]; usage: number; quota: number; maxFileBytes: number; allowed: string[] };

const TXT = {
  sr: {
    title: 'Moji fajlovi', add: 'Dodaj knjigu', hint: 'EPUB, FB2, TXT, PDF, CBZ, CBR — privatno, samo za vas.',
    empty: 'Još nema ličnih fajlova.', download: 'Preuzmi', remove: 'Obriši', read: 'Čitaj', used: 'Iskorišćeno',
    quota: 'Kvota', tooBig: 'Fajl je prevelik', quotaFull: 'Nema dovoljno mesta u kvoti',
    badFormat: 'Format nije podržan', badContent: 'Sadržaj ne odgovara formatu', uploadFail: 'Greška pri otpremanju',
    confirm: 'Obrisati fajl? Radnja je nepovratna.', busy: 'Otpremanje…',
  },
  ru: {
    title: 'Мои файлы', add: 'Добавить книгу', hint: 'EPUB, FB2, TXT, PDF, CBZ, CBR — приватно, только для вас.',
    empty: 'Личных файлов пока нет.', download: 'Скачать', remove: 'Удалить', read: 'Читать', used: 'Использовано',
    quota: 'Квота', tooBig: 'Файл слишком большой', quotaFull: 'Недостаточно места в квоте',
    badFormat: 'Формат не поддерживается', badContent: 'Содержимое не соответствует формату', uploadFail: 'Ошибка загрузки',
    confirm: 'Удалить файл? Действие необратимо.', busy: 'Загрузка…',
  },
  en: {
    title: 'My files', add: 'Add a book', hint: 'EPUB, FB2, TXT, PDF, CBZ, CBR — private, only for you.',
    empty: 'No personal files yet.', download: 'Download', remove: 'Delete', read: 'Read', used: 'Used',
    quota: 'Quota', tooBig: 'File is too large', quotaFull: 'Not enough quota space',
    badFormat: 'Format is not supported', badContent: 'Content does not match the format', uploadFail: 'Upload failed',
    confirm: 'Delete this file? This cannot be undone.', busy: 'Uploading…',
  },
} as const;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function MyFiles({ lang }: { lang: 'sr' | 'ru' | 'en' }) {
  const t = TXT[lang];
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/library/files');
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => { void load(); }, [load]);

  function message(code: string): string {
    if (code === 'file_too_large') return t.tooBig;
    if (code === 'quota_exceeded') return t.quotaFull;
    if (code === 'format_not_allowed' || code === 'not_epub') return t.badFormat;
    if (code === 'content_mismatch' || code === 'binary_txt' || code === 'zip_bomb_suspected' || code === 'zip_path_traversal') return t.badContent;
    return t.uploadFail;
  }

  async function upload(file: File) {
    setBusy(true); setError('');
    const body = new FormData();
    body.append('file', file);
    const res = await fetch('/api/library/files', { method: 'POST', body }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      const json = res ? await res.json().catch(() => ({})) : {};
      setError(message(String(json.error || '')));
      return;
    }
    await load();
  }

  async function remove(fileId: number) {
    if (!window.confirm(t.confirm)) return;
    const res = await fetch(`/api/library/files/${fileId}`, { method: 'DELETE' }).catch(() => null);
    if (res?.ok) await load();
  }

  const usage = data?.usage || 0;
  const quota = data?.quota || 1;
  const percent = Math.min(100, Math.round((usage / quota) * 100));

  return (
    <section className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="text-lg font-bold">{t.title}</h2>
          <p className="text-xs muted">{t.hint}</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".epub,.fb2,.txt,.pdf,.cbz,.cbr"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = '';
            }}
          />
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? t.busy : t.add}
          </button>
        </div>
      </div>

      <div className="card p-4">
        <div className="mb-1 flex items-center justify-between text-xs muted">
          <span>{t.used}: {formatSize(usage)} / {formatSize(quota)}</span>
          <span>{percent}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded bg-black/10">
          <div className="h-full rounded bg-[var(--tlp-a)]" style={{ width: `${percent}%` }} />
        </div>
        {usage > quota ? (
          <p className="mt-2 text-sm" role="status" style={{ color: '#9a6700' }}>
            {lang === 'ru' ? 'Квота тарифа уменьшилась: файлы сохранены, скачивание и чтение работают, новые загрузки заблокированы до освобождения места или смены тарифа.'
              : lang === 'en' ? 'Your plan quota decreased: files are kept and remain readable, new uploads are blocked until you free space or change the plan.'
              : 'Kvota tarife je smanjena: fajlovi su sačuvani i čitljivi, nove otpreme su blokirane dok ne oslobodite prostor ili promenite tarifu.'}
          </p>
        ) : null}
        {error ? <p className="mt-2 text-sm" role="alert" style={{ color: '#b3261e' }}>{error}</p> : null}
      </div>

      {!data ? (
        <div className="card p-6 muted">…</div>
      ) : data.books.length === 0 ? (
        <div className="card p-6 muted">{t.empty}</div>
      ) : (
        <ul className="space-y-2">
          {data.books.map((book) => (
            <li key={book.book_id} className="card flex items-center gap-3 p-4">
              <span className="rounded bg-black/5 px-2 py-1 text-xs font-bold uppercase">{book.format}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{book.title}</div>
                <div className="text-xs muted">
                  {formatSize(Number(book.size_bytes || 0))} · {book.status}
                </div>
              </div>
              {book.file_id ? (
                <>
                  {(book.format === 'txt' || book.format === 'pdf') ? (
                    <a className="btn btn-primary" href={`/${lang}/read-file/${book.file_id}`}>{TXT[lang].read}</a>
                  ) : null}
                  <a className="btn btn-ghost" href={`/api/library/files/${book.file_id}`}>{t.download}</a>
                  <button type="button" className="btn btn-ghost" onClick={() => remove(book.file_id as number)}>{t.remove}</button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
