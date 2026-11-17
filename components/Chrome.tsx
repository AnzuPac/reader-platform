'use client';
import { usePathname } from 'next/navigation';

/**
 * Общая шапка и подвал сайта. Каталог по макету BOOKVERSE несёт собственную
 * навигацию (сайдбар и топбар), поэтому на его маршрутах общий хром скрывается,
 * чтобы не было двух меню подряд.
 */
export default function Chrome({
  header, footer, children,
}: {
  header: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const path = usePathname() || '';
  const bare = /\/catalog(\/|$)/.test(path);
  return (
    <div className="min-h-screen">
      {bare ? null : header}
      {children}
      {bare ? null : footer}
    </div>
  );
}
