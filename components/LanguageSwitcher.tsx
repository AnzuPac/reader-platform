'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import type { Lang } from '@/lib/i18n';

const LANGS: { code: Lang; label: string }[] = [
  { code: 'sr', label: 'SR' }, { code: 'ru', label: 'RU' }, { code: 'en', label: 'EN' },
];
export default function LanguageSwitcher({ lang, className = '' }: { lang: Lang; className?: string }) {
  const pathname = usePathname() || `/${lang}`;
  const search = useSearchParams();
  const parts = pathname.split('/');
  parts[1] = lang;
  const route = parts.join('/') || `/${lang}`;
  const query = search?.toString();
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  return <div className={`language-switcher ${className}`} aria-label="Language">
    {LANGS.map(({ code, label }) => <Link key={code} href={`${route}${query ? `?${query}` : ''}`} locale={false}
      className={`language-switcher__item ${code === lang ? 'is-active' : ''}`} aria-current={code === lang ? 'page' : undefined}>{label}</Link>)}
  </div>;
}
