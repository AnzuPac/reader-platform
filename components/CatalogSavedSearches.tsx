'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Lang } from '@/lib/i18n';

type SavedSearch = { id: string; label: string; href: string; createdAt: number };
const STORAGE_KEY = 'terolibrary-saved-catalog-searches-v1';
const COPY: Record<Lang, { save: string; saved: string; empty: string; remove: string; savedLabel: string; duplicate: string }> = {
  sr: { save: 'Sačuvaj pretragu', saved: 'Sačuvane pretrage', empty: 'Sačuvajte kombinaciju filtera da biste je ponovo otvorili.', remove: 'Ukloni', savedLabel: 'Sačuvana pretraga', duplicate: 'Ova pretraga je već sačuvana.' },
  ru: { save: 'Сохранить поиск', saved: 'Сохранённые поиски', empty: 'Сохраняйте комбинации фильтров, чтобы быстро открывать их снова.', remove: 'Удалить', savedLabel: 'Сохранённый поиск', duplicate: 'Такой поиск уже сохранён.' },
  en: { save: 'Save search', saved: 'Saved searches', empty: 'Save a filter combination to open it again later.', remove: 'Remove', savedLabel: 'Saved search', duplicate: 'This search is already saved.' },
};

export default function CatalogSavedSearches({ lang }: { lang: Lang }) {
  const router = useRouter();
  const c = COPY[lang];
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as unknown;
      if (Array.isArray(parsed)) {
        setItems(parsed.filter((item): item is SavedSearch => Boolean(item && typeof item.id === 'string' && typeof item.href === 'string' && typeof item.label === 'string')).slice(0, 20));
      }
    } catch { setItems([]); }
  }, []);

  function persist(next: SavedSearch[]) {
    setItems(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* browser storage is optional */ }
  }

  function saveCurrent() {
    const href = `${window.location.pathname}${window.location.search}`;
    if (items.some((item) => item.href === href)) {
      setNotice(c.duplicate);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q')?.trim();
    const heading = query || params.get('fandom') || params.get('genre') || params.get('tag') || c.savedLabel;
    const next = [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label: heading.slice(0, 64), href, createdAt: Date.now() }, ...items].slice(0, 20);
    persist(next);
    setNotice('');
  }

  return (
    <div className="tlp-saved-searches" aria-label={c.saved}>
      <button type="button" className="btn tlp-saved-search-save" onClick={saveCurrent}>＋ {c.save}</button>
      {items.length > 0 ? (
        <details className="tlp-saved-search-menu">
          <summary>{c.saved} <span>{items.length}</span></summary>
          <div className="tlp-saved-search-list">
            {items.map((item) => (
              <div key={item.id} className="tlp-saved-search-item">
                <button type="button" onClick={() => router.push(item.href)} title={item.href}>{item.label}</button>
                <button type="button" className="tlp-saved-search-remove" onClick={() => persist(items.filter((entry) => entry.id !== item.id))} aria-label={`${c.remove}: ${item.label}`}>×</button>
              </div>
            ))}
          </div>
        </details>
      ) : null}
      {notice ? <span className="tlp-saved-search-notice" role="status">{notice}</span> : null}
    </div>
  );
}
