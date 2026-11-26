'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { Lang } from '@/lib/i18n';

type Labels = { books: string; fanfic: string; graphic: string; directions: string };

const ITEMS = [
  { kind: 'books', key: 'books', className: 'books', query: 'books' },
  { kind: 'fanfic', key: 'fanfic', className: 'fanfic', query: 'fanfic' },
  { kind: 'comic', key: 'graphic', className: 'graphic', query: 'comic' },
] as const;

export default function DirectionTabs({ lang, labels }: { lang: Lang; labels: Labels }) {
  const pathname = usePathname() || `/${lang}`;
  const search = useSearchParams();
  const selectedKind = search.get('kind') || '';
  const type = search.get('type') || '';
  const onCatalog = pathname.startsWith(`/${lang}/catalog`);

  function isActive(kind: typeof ITEMS[number]['kind']) {
    if (!onCatalog || selectedKind === 'top' || type === 'top') return false;
    if (kind === 'books') return !['fanfic', 'comic', 'manga'].includes(selectedKind) && !['fanfic', 'manga'].includes(type);
    if (kind === 'fanfic') return selectedKind === 'fanfic' || type === 'fanfic';
    return ['comic', 'manga'].includes(selectedKind) || type === 'manga';
  }

  return (
    <nav className="tlp-main-navigation" aria-label={labels.directions}>
      {ITEMS.map((item) => {
        const active = isActive(item.kind);
        return (
          <Link key={item.kind} href={`/${lang}/catalog?kind=${item.query}`}
            className={`tlp-direction-tab tlp-direction-tab--${item.className}${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}>
            {labels[item.key]}
          </Link>
        );
      })}
    </nav>
  );
}
