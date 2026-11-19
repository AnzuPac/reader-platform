'use client';

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
  return (
    <div className="tlp min-h-screen">
      {header}
      {children}
      {footer}
    </div>
  );
}
