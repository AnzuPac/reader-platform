'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Lang } from '@/lib/i18n';

type SearchItem = {
  slug: string; title: string; author: string; description: string;
  cover: string | null; type: 'book' | 'fanfic' | 'graphic'; rating: number;
};

const COPY: Record<Lang, {
  search: string; placeholder: string; find: string; close: string;
  configure: string; history: string; clear: string; hint: string; popular: string;
  loading: string; noResults: string; book: string; fanfic: string; graphic: string;
}> = {
  sr: {
    search: 'Pretraga', placeholder: 'Pretraži knjigu, autora, prevodioca ili opis',
    find: 'Traži', close: 'Zatvori', configure: 'Podesi pretragu u katalogu',
    history: 'Istorija pretraga', clear: 'Obriši', hint: 'Počnite da kucate naziv, autora ili opis.',
    popular: 'Popularne pretrage', loading: 'Pretraga…', noResults: 'Nema rezultata. Probajte drugi upit.',
    book: 'Knjiga', fanfic: 'Fanfikcija', graphic: 'Grafička literatura',
  },
  ru: {
    search: 'Поиск', placeholder: 'Поиск книг, авторов, переводчиков, описаний',
    find: 'Найти', close: 'Закрыть', configure: 'Настроить поиск в каталоге',
    history: 'История запросов', clear: 'Очистить', hint: 'Начните вводить название, автора или описание.',
    popular: 'Популярные запросы', loading: 'Ищем…', noResults: 'Ничего не найдено. Попробуйте другой запрос.',
    book: 'Книга', fanfic: 'Фанфик', graphic: 'Графическая литература',
  },
  en: {
    search: 'Search', placeholder: 'Search books, authors, translators, descriptions',
    find: 'Find', close: 'Close', configure: 'Set up search in the catalog',
    history: 'Search history', clear: 'Clear', hint: 'Start typing a title, author or description.',
    popular: 'Popular searches', loading: 'Searching…', noResults: 'No results. Try another query.',
    book: 'Book', fanfic: 'Fan fiction', graphic: 'Graphic literature',
  },
};

const HISTORY_KEY = 'tl-search-history';
const POPULAR: Record<Lang, string[]> = {
  sr: ['fantazija', 'isekai', 'Naruto', 'romantika'],
  ru: ['фэнтези', 'исекай', 'Naruto', 'романтика'],
  en: ['fantasy', 'isekai', 'Naruto', 'romance'],
};

export default function SearchOverlay({ lang }: { lang: Lang }) {
  const c = COPY[lang];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onGlobalKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, []);

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

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setItems([]);
      setLoading(false);
      setSearched(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal, cache: 'no-store' });
        const data = await response.json() as { items?: SearchItem[] };
        if (response.ok) setItems(Array.isArray(data.items) ? data.items : []);
        else setItems([]);
        setSearched(true);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setItems([]);
          setSearched(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, query]);

  function remember(value: string) {
    const updated = [value, ...history.filter((item) => item !== value)].slice(0, 8);
    setHistory(updated);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch { /* optional browser storage */ }
  }

  function submit(value: string) {
    const next = value.trim();
    if (!next) return;
    remember(next);
    setOpen(false);
    router.push(`/${lang}/catalog?q=${encodeURIComponent(next)}`);
  }

  function openWork(item: SearchItem) {
    remember(query.trim());
    setOpen(false);
    router.push(`/${lang}/work/${item.slug}`);
  }

  function clearHistory() {
    setHistory([]);
    try { localStorage.removeItem(HISTORY_KEY); } catch { /* optional browser storage */ }
  }

  return (
    <>
      <button type="button" className="tlp-tool-button" aria-label={c.search} title={`${c.search} (Ctrl/⌘ K)`} aria-keyshortcuts="Control+K Meta+K" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
      </button>
      {open ? (
        <div className="tl-search-overlay" role="dialog" aria-modal="true" aria-label={c.search} onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div className="tl-search-panel">
            <div className="tl-search-row">
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') submit(query); }}
                placeholder={c.placeholder}
                aria-label={c.placeholder}
              />
              {query ? <button type="button" className="tl-search-clear" onClick={() => setQuery('')} aria-label={lang === 'ru' ? 'Очистить поле' : 'Clear input'}>×</button> : null}
              <button type="button" className="btn primary" onClick={() => submit(query)}>{c.find}</button>
              <button type="button" className="btn" onClick={() => setOpen(false)} aria-label={c.close}>✕</button>
            </div>
            <Link href={`/${lang}/catalog`} className="btn soft tl-search-catalog" onClick={() => setOpen(false)}>
              <span className="tl-search-catalog__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5h16M4 12h16M4 19h16"/><path d="M8 3v4M16 10v4M11 17v4"/></svg></span><span>{c.configure}</span><span aria-hidden="true">›</span>
            </Link>
            {query.trim().length < 2 ? (
              <div className="tl-search-start">
                {history.length ? (
                  <div className="tl-search-history">
                    <div className="row"><strong>{c.history}</strong><button type="button" className="tl-search-text-button" onClick={clearHistory}>{c.clear}</button></div>
                    <div className="chips">{history.map((item) => <button key={item} type="button" className="chip" onClick={() => submit(item)}>{item}</button>)}</div>
                  </div>
                ) : <p className="muted tl-search-hint">{c.hint}</p>}
                <div className="tl-search-popular">
                  <strong>{c.popular}</strong>
                  <div className="chips">{POPULAR[lang].map((item) => <button key={item} type="button" className="chip" onClick={() => submit(item)}>{item}</button>)}</div>
                </div>
              </div>
            ) : (
              <div className="tl-search-live" aria-live="polite">
                {loading ? <p className="muted tl-search-hint">{c.loading}</p> : null}
                {!loading && searched && !items.length ? <p className="muted tl-search-hint">{c.noResults}</p> : null}
                {items.map((item) => (
                  <button key={item.slug} type="button" className="tl-search-result" onClick={() => openWork(item)}>
                    <span className={`tl-search-result-cover tl-search-result-cover--${item.type}`}>
                      {item.cover ? <img src={item.cover} alt="" loading="lazy" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12.5A2.5 2.5 0 0 1 20 6.5V20H7.5A2.5 2.5 0 0 1 5 17.5Z"/><path d="M3 7v12a2 2 0 0 0 2 2h2V5H5a2 2 0 0 0-2 2Z"/></svg>}
                    </span>
                    <span className="tl-search-result-copy">
                      <strong>{item.title}</strong><small>{item.author}</small>
                      <span>{item.type === 'fanfic' ? c.fanfic : item.type === 'graphic' ? c.graphic : c.book} · ★ {item.rating.toFixed(1)}</span>
                    </span>
                    <span className="tl-search-result-arrow" aria-hidden="true">›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
