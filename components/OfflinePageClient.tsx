'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { loadChapter, readIndex, removeChapter, totalBytes, type OfflineIndexItem, type OfflineChapter } from '@/lib/offline';

type Lang = 'sr' | 'en' | 'ru';

const TXT: Record<Lang, {
  title: string; empty: string; hint: string; back: string; remove: string; open: string;
  reading: string; close: string; size: string;
}> = {
  sr: {
    title: 'Za offline', empty: 'Još nema sačuvanih glava.',
    hint: 'Otvori glavu i klikni „Sačuvaj za offline“ — čitaće se i bez interneta.',
    back: 'Nazad', remove: 'Ukloni', open: 'Čitaj', reading: 'Čitanje offline', close: 'Zatvori', size: 'zauzeto',
  },
  ru: {
    title: 'Для офлайна', empty: 'Сохранённых глав пока нет.',
    hint: 'Открой главу и нажми «Скачать для офлайна» — она будет читаться без интернета.',
    back: 'Назад', remove: 'Удалить', open: 'Читать', reading: 'Офлайн-чтение', close: 'Закрыть', size: 'занято',
  },
  en: {
    title: 'Offline', empty: 'No saved chapters yet.',
    hint: 'Open a chapter and press “Save for offline” — it will be readable without network.',
    back: 'Back', remove: 'Remove', open: 'Read', reading: 'Offline reading', close: 'Close', size: 'used',
  },
};

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function OfflinePageClient({ lang }: { lang: Lang }) {
  const [items, setItems] = useState<OfflineIndexItem[]>([]);
  const [open, setOpen] = useState<OfflineChapter | null>(null);
  const t = TXT[lang];

  function refresh() {
    try { setItems(readIndex(window.localStorage)); } catch { setItems([]); }
  }

  useEffect(() => { refresh(); }, []);

  const used = useMemo(() => totalBytes(items), [items]);

  if (open) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <button type="button" className="btn btn-ghost" onClick={() => setOpen(null)}>← {t.close}</button>
          <span className="muted">{t.reading} · {open.workTitle} — {open.title || `${t.reading} ${open.number}`}</span>
        </div>
        {/* HTML сохранён из читалки: доверяем ему так же, как серверному рендеру. */}
        <div className="reader-surface prose-reader" dangerouslySetInnerHTML={{ __html: open.html }} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-2 flex items-baseline gap-3">
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <span className="text-xs muted">{items.length} · {humanSize(used)} {t.size}</span>
      </div>
      <p className="mb-6 text-sm muted">{t.hint}</p>

      {items.length === 0 ? (
        <div className="card p-8 text-center muted">{t.empty}</div>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.chapterId} className="card flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <Link href={`/${lang}/work/${i.workSlug}`} className="font-semibold hover:text-brand">{i.workTitle}</Link>
                <div className="text-xs muted">
                  {i.title || `${i.number}`} · {humanSize(i.bytes)} · {new Date(i.savedAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-GB' : 'sr-RS')}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  try {
                    const ch = loadChapter(window.localStorage, i.chapterId);
                    if (ch) setOpen(ch);
                  } catch { /* приватный режим */ }
                }}
              >
                {t.open}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  try { removeChapter(window.localStorage, i.chapterId); } catch { /* приватный режим */ }
                  refresh();
                }}
              >
                {t.remove}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8">
        <Link href={`/${lang}/library`} className="btn btn-ghost">← {t.back}</Link>
      </div>
    </main>
  );
}
