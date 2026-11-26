'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { Lang } from '@/lib/i18n';

const LABELS: Record<Lang, { home: string; discover: string; top: string; community: string; authors: string; more: string; publishers: string; help: string; collections: string }> = {
  sr: { home: 'Početna', discover: 'Otkrij', top: 'Top', community: 'Zajednica', more: 'Više', publishers: 'Izdavači', help: 'Pomoć', collections: 'Kolekcije', authors: 'Za autore' },
  ru: { home: 'Главная', discover: 'Каталог', top: 'Топ', community: 'Сообщество', more: 'Ещё', publishers: 'Издательства', help: 'Помощь', collections: 'Коллекции', authors: 'Авторам' },
  en: { home: 'Home', discover: 'Explore', top: 'Top', community: 'Community', more: 'More', publishers: 'Publishers', help: 'Help', collections: 'Collections', authors: 'For authors' },
};

export default function DesktopPrimaryNav({ lang }: { lang: Lang }) {
  const t = LABELS[lang];
  const pathname = usePathname() || `/${lang}`;
  const search = useSearchParams();
  const isCatalog = pathname.startsWith(`/${lang}/catalog`);
  const isTop = isCatalog && (search.get('kind') === 'top' || search.get('type') === 'top');
  const isCommunity = pathname.startsWith(`/${lang}/community`) || pathname.startsWith(`/${lang}/collections`);
  const isAuthors = pathname.startsWith(`/${lang}/author`);
  const items = [
    { href: `/${lang}`, label: t.home, active: pathname === `/${lang}` || pathname === `/${lang}/` },
    { href: `/${lang}/catalog`, label: t.discover, active: isCatalog && !isTop },
    { href: `/${lang}/catalog?kind=top`, label: t.top, active: isTop },
    { href: `/${lang}/community`, label: t.community, active: isCommunity },
    { href: `/${lang}/author`, label: t.authors, active: isAuthors },
  ];

  return (
    <nav className="tlp-desktop-primary-nav" aria-label={lang === 'ru' ? 'Разделы платформы' : lang === 'en' ? 'Platform sections' : 'Delovi platforme'}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={`tlp-primary-link${item.active ? ' is-active' : ''}`} aria-current={item.active ? 'page' : undefined}>
          {item.label}
        </Link>
      ))}
      <details className="tlp-primary-more">
        <summary>{t.more}<span aria-hidden="true">⌄</span></summary>
        <div className="tlp-primary-more-menu">
          <Link href={`/${lang}/community`} className="tlp-more-community-link">{t.community}</Link>
          <Link href={`/${lang}/author`} className="tlp-more-authors-link">{t.authors}</Link>
          <Link href={`/${lang}/collections`}>{t.collections}</Link>
          <Link href={`/${lang}/publishers`}>{t.publishers}</Link>
          <Link href={`/${lang}/help`}>{t.help}</Link>
        </div>
      </details>
    </nav>
  );
}
