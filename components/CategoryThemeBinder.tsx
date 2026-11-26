'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

const CATEGORY_CLASSES = ['tlp-publisher', 'tlp-selfpub', 'tlp-fanfic', 'tlp-manga', 'tlp-top'];

export default function CategoryThemeBinder() {
  const pathname = usePathname() || '';
  const search = useSearchParams();
  const kind = search.get('kind') || '';
  const source = search.get('source') || '';

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.tlp');
    if (!root) return;
    root.classList.remove(...CATEGORY_CLASSES);

    let category = '';
    if (pathname.includes('/catalog')) {
      category = kind === 'top' ? 'tlp-top'
        : kind === 'selfpub' || source === 'selfpub' ? 'tlp-selfpub'
        : kind === 'fanfic' ? 'tlp-fanfic'
        : kind === 'comic' || kind === 'manga' ? 'tlp-manga'
        : 'tlp-publisher';
    } else if (pathname.includes('/work/')) {
      const work = document.querySelector<HTMLElement>('.tl-screen--work');
      const workCategory = work?.dataset.category;
      category = workCategory === 'fanfic' ? 'tlp-fanfic'
        : workCategory === 'graphic' ? 'tlp-manga'
        : 'tlp-publisher';
    } else if (pathname.includes('/read/')) {
      const reader = document.querySelector<HTMLElement>('.tl-screen--reader');
      const readerCategory = reader?.dataset.category;
      category = readerCategory === 'fanfic' ? 'tlp-fanfic'
        : readerCategory === 'graphic' ? 'tlp-manga'
        : 'tlp-publisher';
    }
    if (category) root.classList.add(category);
  }, [pathname, kind, source]);

  return null;
}
