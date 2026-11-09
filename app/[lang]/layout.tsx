import { notFound } from 'next/navigation';
import Link from 'next/link';
import { isLang, t, type Lang } from '@/lib/i18n';

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const l = lang as Lang;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line/60">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-4">
          <Link href={`/${l}`} className="text-lg font-bold tracking-tight">
            <span className="text-violet">✦</span> {t(l, 'brand')}
          </Link>
          <nav className="flex items-center gap-4 text-sm muted">
            <Link href={`/${l}/catalog`}>{t(l, 'nav_catalog')}</Link>
            <Link href={`/${l}/library`}>{t(l, 'nav_library')}</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <Link href={`/${l}/login`} className="btn btn-ghost">{t(l, 'nav_login')}</Link>
            <Link href={`/${l}/register`} className="btn btn-primary">{t(l, 'nav_register')}</Link>
          </div>
        </div>
      </header>
      {children}
      <footer className="mt-20 border-t border-line/60">
        <div className="mx-auto max-w-6xl px-5 py-8 text-sm muted">
          © {new Date().getFullYear()} — sr · en · ru
        </div>
      </footer>
    </div>
  );
}
