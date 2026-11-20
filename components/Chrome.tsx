'use client';

import { Suspense } from 'react';
import BottomNavPill from '@/components/BottomNavPill';
import CategoryThemeBinder from '@/components/CategoryThemeBinder';
import type { Lang } from '@/lib/i18n';

/** Общая оболочка платформы. Все существующие страницы остаются в прежних маршрутах. */
export default function Chrome({
  lang, userId, children,
}: {
  lang: Lang;
  userId: number | null;
  children: React.ReactNode;
}) {
  return (
    <div className="tlp min-h-screen">
      <Suspense fallback={null}><CategoryThemeBinder /></Suspense>
      {children}
      <BottomNavPill lang={lang} userId={userId} />
    </div>
  );
}
