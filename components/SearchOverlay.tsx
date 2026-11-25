'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Lang } from '@/lib/i18n';

const COPY: Record<Lang, {
  search: string; placeholder: string; find: string; close: string;
  configure: string; history: string; clear: string; hint: string;
}> = {
  sr: {
    search: 'Pretraga', placeholder: 'Pretraži knjigu, autora, prevodioca ili opis',
    find: 'Traži', close: 'Zatvori', configure: 'Podesi pretragu u katalogu',
    history: 'Istorija pretraga', clear: 'Obriši', hint: 'Počnite da kucate naziv, autora ili opis.',
  },
  ru: {
    search: 'Поиск', placeholder: 'Поиск книг, авторов, переводчиков, описаний',
    find: 'Найти', close: 'Закрыть', configure: 'Настроить поиск в каталоге',
    history: 'История запросов', clear: 'Очистить', hint: 'Начните вводить название, автора или описание.',
  },
  en: {
    search: 'Search', placeholder: 'Search books, authors, translators, descriptions',
    find: 'Find', close: 'Close', configure: 'Set up search in the catalog',
    history: 'Search history', clear: 'Clear', hint: 'Start typing a title, author or description.',
  },
};

const HISTORY_KEY = 'tl-search-history';

export default function SearchOverlay({ lang }: { lang: Lang }) {
  const c = COPY[lang];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      setHistory(raw ? (JSON.parse(raw) as string[]).slice(0, 8) : []);
    } catch {
      setHistory([]);
    }
    const timer = setTimeout(() => inputRef.current?.focus(), 30);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function submit(value: string) {
    const next = value.trim();
    if (!next) return;
    const updated = [next, ...history.filter((item) => item !== next)].slice(0, 8);
    setHistory(updated);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch {
      // локальное хранилище может быть недоступно — поиск всё равно работает
    }
    setOpen(false);
    router.push(`/${lang}/catalog?q=${encodeURIComponent(next)}`);
  }

  function clearHistory() {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <button
        type="button"
        className="tlp-tool-button"
        aria-label={c.search}
        title={c.search}
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
      </button>
      {open ? (
        <div className="tl-search-overlay" role="dialog" aria-modal="true" aria-label={c.search}>
          <div className="tl-search-panel">
            <div className="tl-search-row">
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submit(query);
                }}
                placeholder={c.placeholder}
                aria-label={c.placeholder}
              />
              <button type="button" className="btn btn-primary" onClick={() => submit(query)}>{c.find}</button>
              <button type="button" className="btn" onClick={() => setOpen(false)} aria-label={c.close}>✕</button>
            </div>
            <Link href={`/${lang}/catalog`} className="btn btn-soft tl-search-catalog" onClick={() => setOpen(false)}>
              {c.configure}
            </Link>
            {history.length ? (
              <div className="tl-search-history">
                <div className="row">
                  <strong>{c.history}</strong>
                  <button type="button" className="btn" onClick={clearHistory}>{c.clear}</button>
                </div>
                <div className="chips">
                  {history.map((item) => (
                    <button key={item} type="button" className="chip" onClick={() => submit(item)}>#{item}</button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="muted tl-search-hint">{c.hint}</p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
