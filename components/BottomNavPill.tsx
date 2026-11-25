'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Lang } from '@/lib/i18n';

type Item = {
  key: 'home' | 'top' | 'catalog' | 'library' | 'profile';
  href: string;
  label: string;
};

function NavIcon({ name }: { name: Item['key'] }) {
  const paths: Record<Item['key'], React.ReactNode> = {
    home: <path d="M3 10.8 12 3l9 7.8v9.1a1.1 1.1 0 0 1-1.1 1.1h-5.2v-6.2H9.3V21H4.1A1.1 1.1 0 0 1 3 19.9z" />,
    top: <path d="m12 2.8 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
    catalog: <path d="M4 4h3v16H4zm6 0h3v16h-3zm6 0h3v16h-3z" />,
    library: <path d="M5 3h12.5A2.5 2.5 0 0 1 20 5.5v15H7.5A2.5 2.5 0 0 1 5 18zM3 6v13a2 2 0 0 0 2 2h1V5H5a2 2 0 0 0-2 1z" />,
    profile: <path d="M12 12a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4zm-7.5 8.5a7.5 7.5 0 0 1 15 0z" />,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

export default function BottomNavPill({ lang, userId }: { lang: Lang; userId: number | null }) {
  const pathname = usePathname() || `/${lang}`;
  const searchParams = useSearchParams();
  const isTop = searchParams.get('kind') === 'top';
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
    { key: 'home', href: `/${lang}`, label: lang === 'ru' ? 'Главная' : lang === 'en' ? 'Home' : 'Početna' },
    { key: 'top', href: `/${lang}/catalog?kind=top`, label: lang === 'ru' ? 'Топ' : lang === 'en' ? 'Top' : 'Top' },
    { key: 'catalog', href: `/${lang}/catalog`, label: lang === 'ru' ? 'Каталог' : lang === 'en' ? 'Catalog' : 'Katalog' },
    { key: 'library', href: `/${lang}/library`, label: lang === 'ru' ? 'Моя полка' : lang === 'en' ? 'My shelf' : 'Moja polica' },
    { key: 'profile', href: userId ? `/${lang}/u/${userId}` : `/${lang}/login`, label: lang === 'ru' ? 'Профиль' : lang === 'en' ? 'Profile' : 'Profil' },
  ];

  function isActive(key: Item['key']) {
    if (key === 'home') return pathname === `/${lang}` || pathname === `/${lang}/`;
    if (key === 'top') return pathname.startsWith(`/${lang}/catalog`) && isTop;
    if (key === 'catalog') return pathname.startsWith(`/${lang}/catalog`) && !isTop;
    if (key === 'library') return pathname.startsWith(`/${lang}/library`);
    return pathname.startsWith(`/${lang}/u/`) || pathname.startsWith(`/${lang}/account`) || pathname.startsWith(`/${lang}/login`);
  }

  return (
    <nav className={`tlp-bottom-nav${hidden ? ' is-hidden' : ''}`} aria-label={lang === 'ru' ? 'Основная навигация' : lang === 'en' ? 'Main navigation' : 'Glavna navigacija'}>
      {items.map((item) => {
        const active = isActive(item.key);
        return (
          <Link key={item.key} href={item.href} className={`tlp-bottom-nav__item${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
            <span className="tlp-bottom-nav__icon"><NavIcon name={item.key} /></span>
            <span className="tlp-bottom-nav__label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
