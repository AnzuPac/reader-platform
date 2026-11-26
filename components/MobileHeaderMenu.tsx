'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Lang } from '@/lib/i18n';

type ThemeMode = 'system' | 'light' | 'dark';
const THEME_KEY = 'tlp-theme';

const TEXT: Record<Lang, { menu: string; language: string; theme: string; system: string; light: string; dark: string }> = {
  sr: { menu: 'Meni', language: 'Jezik interfejsa', theme: 'Tema', system: 'Sistem', light: 'Svetla', dark: 'Tamna' },
  ru: { menu: 'Меню', language: 'Язык интерфейса', theme: 'Тема', system: 'Системная', light: 'Светлая', dark: 'Тёмная' },
  en: { menu: 'Menu', language: 'Interface language', theme: 'Theme', system: 'System', light: 'Light', dark: 'Dark' },
};

export default function MobileHeaderMenu({ lang }: { lang: Lang }) {
  const t = TEXT[lang];
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('system');
  const pathname = usePathname() || `/${lang}`;
  const search = useSearchParams();
  const query = search?.toString();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_KEY);
      setTheme(stored === 'light' || stored === 'dark' ? stored : 'system');
    } catch {
      setTheme('system');
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function applyTheme(mode: ThemeMode) {
    setTheme(mode);
    const root = document.querySelector<HTMLElement>('.tlp');
    if (root) {
      if (mode === 'system') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', mode);
    }
    try {
      if (mode === 'system') window.localStorage.removeItem(THEME_KEY);
      else window.localStorage.setItem(THEME_KEY, mode);
    } catch {
      // тема применится на текущей странице и без хранилища
    }
  }

  const routeFor = (code: Lang) => {
    const parts = pathname.split('/');
    parts[1] = code;
    return parts.join('/') || `/${code}`;
  };

  return (
    <>
      <button
        type="button"
        className="tlp-tool-button tlp-mobile-menu-button"
        aria-label={t.menu}
        title={t.menu}
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18" />
        </svg>
      </button>

      {open ? (
        <div
          className="tlp-mobile-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={t.menu}
          onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
        >
          <div className="tlp-mobile-sheet__panel">
            <div className="tlp-mobile-sheet__head">
              <strong>{t.menu}</strong>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>

            <div className="tlp-mobile-sheet__label">{t.language}</div>
            <div className="chips">
              {(['sr', 'ru', 'en'] as Lang[]).map((code) => (
                <Link
                  key={code}
                  href={`${routeFor(code)}${query ? `?${query}` : ''}`}
                  className={`chip ${code === lang ? 'selected' : ''}`}
                  onClick={() => setOpen(false)}
                >
                  {code.toUpperCase()}
                </Link>
              ))}
            </div>

            <div className="tlp-mobile-sheet__label">{t.theme}</div>
            <div className="chips">
              {(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`chip ${theme === mode ? 'selected' : ''}`}
                  onClick={() => applyTheme(mode)}
                >
                  {t[mode]}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
