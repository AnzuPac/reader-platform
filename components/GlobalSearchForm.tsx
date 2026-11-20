'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import type { Lang } from '@/lib/i18n';

export default function GlobalSearchForm({ lang, placeholder, label }: { lang: Lang; placeholder: string; label: string }) {
  const pathname = usePathname() || `/${lang}`;
  const params = useSearchParams();
  const preserve = pathname.startsWith(`/${lang}/catalog`)
    ? Array.from(params.entries()).filter(([key]) => key !== 'q')
    : [];

  return (
    <form action={`/${lang}/catalog`} method="get" className="global-search tlp-header-search" role="search">
      <span aria-hidden="true">⌕</span>
      <input name="q" placeholder={placeholder} aria-label={label} />
      {preserve.map(([key, value], index) => <input key={`${key}-${index}`} type="hidden" name={key} value={value} />)}
    </form>
  );
}
