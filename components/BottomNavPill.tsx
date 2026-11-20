'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Lang } from '@/lib/i18n';

type Item = {
  key: 'home' | 'search' | 'library' | 'community' | 'profile';
  href: string;
  label: string;
  icon: string;
};

export default function BottomNavPill({ lang, userId }: { lang: Lang; userId: number | null }) {
  const pathname = usePathname() || `/${lang}`;
  const inReader = /\/read\/[^/]+$/.test(pathname);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false);
    if (!inReader) return;
    let previousY = window.scrollY;
    const onScroll = () => {
      const currentY = window.scrollY;
      if (currentY > previousY + 8 && currentY > 100) setHidden(true);
      else if (currentY < previousY - 8) setHidden(false);
      previousY = currentY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [inReader, pathname]);

  const items: Item[] = [
    { key: 'home', href: `/${lang}`, label: lang === 'ru' ? 'Главная' : lang === 'en' ? 'Home' : 'Početna', icon: '⌂' },
    { key: 'search', href: `/${lang}/catalog`, label: lang === 'ru' ? 'Поиск' : lang === 'en' ? 'Search' : 'Pretraga', icon: '⌕' },
    { key: 'library', href: `/${lang}/library`, label: lang === 'ru' ? 'Моя полка' : lang === 'en' ? 'My library' : 'Moja polica', icon: '▤' },
    { key: 'community', href: `/${lang}/community`, label: lang === 'ru' ? 'Сообщество' : lang === 'en' ? 'Community' : 'Zajednica', icon: '◎' },
    { key: 'profile', href: userId ? `/${lang}/u/${userId}` : `/${lang}/login`, label: lang === 'ru' ? 'Профиль' : lang === 'en' ? 'Profile' : 'Profil', icon: '◉' },
  ];

  function isActive(key: Item['key']) {
    if (key === 'home') return pathname === `/${lang}` || pathname === `/${lang}/`;
    if (key === 'search') return pathname.startsWith(`/${lang}/catalog`);
    if (key === 'library') return pathname.startsWith(`/${lang}/library`);
    if (key === 'community') return pathname.startsWith(`/${lang}/community`) || pathname.startsWith(`/${lang}/collections`);
    return pathname.startsWith(`/${lang}/u/`) || pathname.startsWith(`/${lang}/account`) || pathname.startsWith(`/${lang}/login`);
  }

  return (
    <nav className={`tlp-bottom-nav${hidden ? ' is-hidden' : ''}`} aria-label={lang === 'ru' ? 'Основная навигация' : lang === 'en' ? 'Main navigation' : 'Glavna navigacija'}>
      {items.map((item) => {
        const active = isActive(item.key);
        return (
          <Link key={item.key} href={item.href} className={`tlp-bottom-nav__item${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
            <span className="tlp-bottom-nav__icon" aria-hidden="true">{item.icon}</span>
            <span className="tlp-bottom-nav__label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
