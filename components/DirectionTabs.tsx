'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { Lang } from '@/lib/i18n';

type Labels = {
  publisher: string; selfpub: string; fanfic: string; graphic: string; top: string;
  directions: string; literature: string; catalog: string; myLibrary: string;
};
const ITEMS = [
  { kind: 'publisher', key: 'publisher' },
  { kind: 'selfpub', key: 'selfpub' },
  { kind: 'fanfic', key: 'fanfic' },
  { kind: 'comic', key: 'graphic' },
] as const;

export default function DirectionTabs({ lang, labels, libraryHref }: { lang: Lang; labels: Labels; libraryHref: string }) {
  const pathname = usePathname() || `/${lang}`;
  const search = useSearchParams();
  const selectedKind = search.get('kind') || '';
  const onCatalog = pathname.startsWith(`/${lang}/catalog`);
  const [open, setOpen] = useState(false);
  const catalogHref = `/${lang}/catalog`;
  const topHref = `/${lang}/catalog?kind=top`;

  return (
    <nav className="tlp-main-navigation" aria-label={labels.directions}>
      <div className="tlp-literature-menu">
        <button type="button" className={`tlp-literature-trigger${open ? ' is-open' : ''}`} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)}>
          {labels.literature}<span className="tlp-menu-chevron" aria-hidden="true">⌄</span>
        </button>
        {open ? (
          <div className="tlp-literature-dropdown" role="menu">
            {ITEMS.map((item) => {
              const active = onCatalog && selectedKind === item.kind;
              const params = new URLSearchParams(search.toString());
              params.set('kind', item.kind);
              return <Link key={item.kind} role="menuitem" href={`/${lang}/catalog?${params.toString()}`} className={`tlp-literature-item${active ? ' is-active' : ''}`} onClick={() => setOpen(false)}>{labels[item.key]}</Link>;
            })}
          </div>
        ) : null}
      </div>
      <Link href={catalogHref} className={`tlp-main-nav-link${pathname.startsWith(`/${lang}/catalog`) && !selectedKind ? ' is-active' : ''}`}>{labels.catalog}</Link>
      <Link href={topHref} className={`tlp-main-nav-link${selectedKind === 'top' ? ' is-active' : ''}`}>{labels.top}</Link>
      <Link href={libraryHref} className="tlp-main-nav-link">{labels.myLibrary}</Link>
    </nav>
  );
}
