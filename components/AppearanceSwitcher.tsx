'use client';

import { useEffect, useState } from 'react';
import type { Lang } from '@/lib/i18n';

type ThemeMode = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'tlp-theme';
const LABELS: Record<Lang, Record<ThemeMode, string>> = {
  sr: { system: 'Sistem', light: 'Svetla tema', dark: 'Tamna tema' },
  ru: { system: 'Системная тема', light: 'Светлая тема', dark: 'Тёмная тема' },
  en: { system: 'System theme', light: 'Light theme', dark: 'Dark theme' },
};
const SHORT: Record<Lang, Record<ThemeMode, string>> = {
  sr: { system: 'Auto', light: 'Svetla', dark: 'Tamna' },
  ru: { system: 'Авто', light: 'Светлая', dark: 'Тёмная' },
  en: { system: 'Auto', light: 'Light', dark: 'Dark' },
};

function applyTheme(mode: ThemeMode) {
  const root = document.querySelector<HTMLElement>('.tlp');
  if (!root) return;
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
}

export default function AppearanceSwitcher({ lang }: { lang: Lang }) {
  const [mode, setMode] = useState<ThemeMode>('system');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const initial: ThemeMode = stored === 'light' || stored === 'dark' ? stored : 'system';
      setMode(initial);
      applyTheme(initial);
    } catch {
      applyTheme('system');
    }
  }, []);

  function cycleMode() {
    const next: ThemeMode = mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system';
    setMode(next);
    applyTheme(next);
    try {
      if (next === 'system') window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The selected theme still applies for the current page when storage is unavailable.
    }
  }

  return (
    <button
      type="button"
      className="tlp-tool-button tlp-theme-button"
      onClick={cycleMode}
      aria-label={`${LABELS[lang][mode]}. ${lang === 'ru' ? 'Изменить тему.' : lang === 'en' ? 'Change theme.' : 'Promeni temu.'}`}
      title={LABELS[lang][mode]}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3a9 9 0 1 0 9 9c0-.4-.03-.8-.08-1.2A7 7 0 0 1 13.2 3.08C12.8 3.03 12.4 3 12 3Z" />
        <path d="M16.5 3.8v4.4M14.3 6h4.4" />
      </svg>
      <span className="tlp-theme-label">{SHORT[lang][mode]}</span>
    </button>
  );
}
