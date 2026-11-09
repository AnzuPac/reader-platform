import { notFound } from 'next/navigation';
import Link from 'next/link';
import { isLang, t, LANGS, type Lang } from '@/lib/i18n';

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
      <header className="sticky top-0 z-40 border-b border-line bg-[#120e1c]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
          <Link href={`/${l}`} className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">✦</span>
            <span className="hidden text-ink sm:inline">{t(l, 'brand')}</span>
          </Link>

          <nav className="hidden items-center gap-5 text-sm font-medium text-mist md:flex">
            <Link href={`/${l}`} className="hover:text-brand">{t(l, 'nav_home')}</Link>
            <Link href={`/${l}/catalog`} className="hover:text-brand">{t(l, 'nav_catalog')}</Link>
            <Link href={`/${l}/library`} className="hover:text-brand">{t(l, 'nav_library')}</Link>
            <Link href={`/${l}/storage`} className="hover:text-brand">Prostor</Link>
          </nav>

          <form action={`/${l}/catalog`} className="hidden flex-1 md:block">
            <input className="input" name="q" placeholder={t(l, 'search_placeholder')} />
          </form>

          <div className="ml-auto flex items-center gap-1 md:ml-0">
            {LANGS.map((code) => (
              <Link
                key={code}
                href={`/${code}`}
                className={`rounded px-2 py-1 text-xs font-bold uppercase ${
                  code === l ? 'bg-brand text-white' : 'text-mist hover:text-brand'
                }`}
              >
                {code}
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <Link href={`/${l}/login`} className="btn btn-ghost">{t(l, 'nav_login')}</Link>
            <Link href={`/${l}/register`} className="btn btn-primary">{t(l, 'nav_register')}</Link>
          </div>
        </div>
      </header>

      {children}

      <footer className="mt-16 border-t border-line bg-[#150f21]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-8 text-sm text-mist">
          <span className="font-semibold text-ink">{t(l, 'brand')}</span>
          <Link href={`/${l}/catalog`}>{t(l, 'nav_catalog')}</Link>
          <Link href={`/${l}/subscribe`}>Pretplata</Link>
          <span className="ml-auto">© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
