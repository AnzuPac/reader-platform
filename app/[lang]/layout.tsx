import { notFound } from 'next/navigation';
import Link from 'next/link';
import { isLang, t, type Lang } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Chrome from '@/components/Chrome';
import SessionKeeper from '@/components/SessionKeeper';

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
    <Chrome header={(
<header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href={`/${l}`} className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-sm">✦</span>
            <span className="hidden text-ink sm:inline">{t(l, 'brand')}</span>
          </Link>

          <nav className="hidden items-center gap-5 text-sm font-semibold text-mist md:flex">
            <Link href={`/${l}`} className="hover:text-brand">{t(l, 'nav_home')}</Link>
            <Link href={`/${l}/catalog`} className="hover:text-brand">{t(l, 'nav_catalog')}</Link>
            <Link href={`/${l}/library`} className="hover:text-brand">{t(l, 'nav_library')}</Link>
            <Link href={`/${l}/storage`} className="hover:text-brand">Prostor</Link>
          </nav>

          <form action={`/${l}/catalog`} className="hidden max-w-xl flex-1 md:block">
            <input className="input bg-[#f8f7f6]" name="q" placeholder={`⌕  ${t(l, 'search_placeholder')}`} />
          </form>

          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <LanguageSwitcher lang={l} />
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <Link href={`/${l}/login`} className="btn btn-ghost">{t(l, 'nav_login')}</Link>
            <Link href={`/${l}/register`} className="btn btn-primary">{t(l, 'nav_register')}</Link>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 pb-3 text-xs font-semibold text-mist sm:px-6 md:hidden" aria-label="Mobile navigation">
          <Link href={`/${l}`} className="whitespace-nowrap rounded-full bg-[#f1edf8] px-3 py-1.5 text-brand">{t(l, 'nav_home')}</Link>
          <Link href={`/${l}/catalog`} className="whitespace-nowrap rounded-full px-3 py-1.5 hover:bg-[#f4f2ef]">{t(l, 'nav_catalog')}</Link>
          <Link href={`/${l}/library`} className="whitespace-nowrap rounded-full px-3 py-1.5 hover:bg-[#f4f2ef]">{t(l, 'nav_library')}</Link>
          <Link href={`/${l}/storage`} className="whitespace-nowrap rounded-full px-3 py-1.5 hover:bg-[#f4f2ef]">Files</Link>
          <Link href={`/${l}/login`} className="whitespace-nowrap rounded-full px-3 py-1.5 hover:bg-[#f4f2ef]">{t(l, 'nav_login')}</Link>
          <Link href={`/${l}/register`} className="whitespace-nowrap rounded-full bg-brand px-3 py-1.5 text-white">{t(l, 'nav_register')}</Link>
        </nav>
      </header>
      )} footer={(
<footer className="mt-16 border-t border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-8 text-sm text-mist sm:px-6 lg:px-8">
          <span className="font-semibold text-ink">{t(l, 'brand')}</span>
          <Link href={`/${l}/catalog`}>{t(l, 'nav_catalog')}</Link>
          <Link href={`/${l}/subscribe`}>Pretplata</Link>
          <Link href={`/${l}/publisher`}>Za izdavače</Link>
          <span className="ml-auto">© {new Date().getFullYear()}</span>
        </div>
      </footer>
      )}>
      <SessionKeeper />
      {children}
    </Chrome>
  );
}
