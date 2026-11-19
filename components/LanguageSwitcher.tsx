'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import type { Lang } from '@/lib/i18n';

const LANGS: { code: Lang; label: string }[] = [
  { code: 'sr', label: 'SR' },
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
];

/**
 * Переключатель языка, который сохраняет маршрут и query string.
 * Меняется только первый сегмент пути: /sr/catalog?genre=x → /ru/catalog?genre=x
 */
export default function LanguageSwitcher({ lang, className = '' }: { lang: Lang; className?: string }) {
  const pathname = usePathname() || `/${lang}`;
  const search = useSearchParams();
  const parts = pathname.split('/');
  if (parts.length > 1) parts[1] = lang;
  const route = parts.join('/') || `/${lang}`;
  const query = search?.toString();

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <div className={`language-switcher ${className}`} role="group" aria-label="Language">
      {LANGS.map(({ code, label }) => (
        <Link
          key={code}
          href={`${route}${query ? `?${query}` : ''}`}
          className={`language-switcher__item ${code === lang ? 'is-active' : ''}`}
          aria-current={code === lang ? 'page' : undefined}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
