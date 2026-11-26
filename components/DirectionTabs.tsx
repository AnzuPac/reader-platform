'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { Lang } from '@/lib/i18n';

type Labels = {
  publisher: string; selfpub: string; fanfic: string; graphic: string; top: string; directions: string;
};

const ITEMS = [
  { kind: 'publisher', key: 'publisher', className: 'publisher' },
  { kind: 'selfpub', key: 'selfpub', className: 'selfpub' },
  { kind: 'fanfic', key: 'fanfic', className: 'fanfic' },
  { kind: 'comic', key: 'graphic', className: 'graphic' },
] as const;

export default function DirectionTabs({ lang, labels }: { lang: Lang; labels: Labels }) {
  const pathname = usePathname() || `/${lang}`;
  const search = useSearchParams();
  const selectedKind = search.get('kind') || '';
  const onCatalog = pathname.startsWith(`/${lang}/catalog`);

  return (
    <nav className="tlp-main-navigation" aria-label={labels.directions}>
      {ITEMS.map((item) => {
        const active = onCatalog && (selectedKind === item.kind || (!selectedKind && item.kind === 'publisher'));
        return (
          <Link
            key={item.kind}
            href={`/${lang}/catalog?kind=${item.kind}`}
            className={`tlp-direction-tab tlp-direction-tab--${item.className}${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {labels[item.key]}
          </Link>
        );
      })}
      <Link
        href={`/${lang}/catalog?kind=top`}
        className={`tlp-direction-tab tlp-direction-tab--top${onCatalog && selectedKind === 'top' ? ' is-active' : ''}`}
        aria-current={onCatalog && selectedKind === 'top' ? 'page' : undefined}
      >
        {labels.top}
      </Link>
    </nav>
  );
}
