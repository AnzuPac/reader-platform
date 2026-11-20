'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

const CATEGORY_CLASSES = ['tlp-publisher', 'tlp-selfpub', 'tlp-fanfic', 'tlp-manga'];

export default function CategoryThemeBinder() {
  const pathname = usePathname() || '';
  const search = useSearchParams();
  const kind = search.get('kind') || '';

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.tlp');
    if (!root) return;
    root.classList.remove(...CATEGORY_CLASSES);
    if (!pathname.includes('/catalog')) return;
    const categoryClass = kind === 'publisher' ? 'tlp-publisher'
      : kind === 'selfpub' ? 'tlp-selfpub'
      : kind === 'fanfic' ? 'tlp-fanfic'
      : kind === 'comic' ? 'tlp-manga'
      : '';
    if (categoryClass) root.classList.add(categoryClass);
  }, [pathname, kind]);

  return null;
}
