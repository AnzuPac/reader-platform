import { notFound } from 'next/navigation';
import Link from 'next/link';
import { isLang, t, type Lang } from '@/lib/i18n';
import Chrome from '@/components/Chrome';
import SessionKeeper from '@/components/SessionKeeper';
import LanguageSwitcher from '@/components/LanguageSwitcher';

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
<header className="site-header sticky top-0 z-40 border-b border-line backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
          <Link href={`/${l}`} className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <span className="site-brand-mark flex h-8 w-8 items-center justify-center rounded-lg text-white">✦</span>
            <span className="site-brand-name hidden sm:inline">{t(l, 'brand')}</span>
          </Link>

          <nav className="site-nav hidden items-center gap-5 text-sm font-medium md:flex">
            <Link href={`/${l}`} className="hover:text-brand">{t(l, 'nav_home')}</Link>
            <Link href={`/${l}/catalog`} className="hover:text-brand">{t(l, 'nav_catalog')}</Link>
            <Link href={`/${l}/library`} className="hover:text-brand">{t(l, 'nav_library')}</Link>
            <Link href={`/${l}/collections`} className="hover:text-brand">{l === 'ru' ? 'Коллекции' : l === 'en' ? 'Collections' : 'Kolekcije'}</Link>
            <Link href={`/${l}/author`} className="hover:text-brand">{l === 'ru' ? 'Авторам' : l === 'en' ? 'For authors' : 'Autorima'}</Link>
          </nav>
          <nav className="site-mobile-nav md:hidden" aria-label="Mobile navigation"><Link href={`/${l}`}>{t(l, 'nav_home')}</Link><Link href={`/${l}/catalog`}>{t(l, 'nav_catalog')}</Link><Link href={`/${l}/library`}>{t(l, 'nav_library')}</Link><Link href={`/${l}/collections`}>{l === 'ru' ? 'Подборки' : l === 'en' ? 'Collections' : 'Kolekcije'}</Link></nav>

          <form action={`/${l}/catalog`} className="hidden flex-1 md:block">
            <input className="input" name="q" placeholder={t(l, 'search_placeholder')} />
          </form>

          <div className="ml-auto md:ml-0"><LanguageSwitcher lang={l}/></div>

          <div className="site-auth hidden items-center gap-2 sm:flex">
            <Link href={`/${l}/notifications`} className="site-notifications" aria-label={l === 'ru' ? 'Уведомления' : l === 'en' ? 'Notifications' : 'Obaveštenja'} title={l === 'ru' ? 'Уведомления' : l === 'en' ? 'Notifications' : 'Obaveštenja'}>♧</Link>
            <Link href={`/${l}/login`} className="btn btn-ghost">{t(l, 'nav_login')}</Link>
            <Link href={`/${l}/register`} className="btn btn-primary">{t(l, 'nav_register')}</Link>
          </div>
        </div>
      </header>
      )} footer={(
<footer className="site-footer mt-16 border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-8 text-sm text-mist">
          <span className="font-semibold text-ink">{t(l, 'brand')}</span>
          <Link href={`/${l}/catalog`}>{t(l, 'nav_catalog')}</Link>
          <Link href={`/${l}/subscribe`}>{l === 'ru' ? 'Подписка' : l === 'en' ? 'Subscription' : 'Pretplata'}</Link>
          <Link href={`/${l}/publisher`}>{l === 'ru' ? 'Издателям' : l === 'en' ? 'For publishers' : 'Za izdavače'}</Link>
          <Link href={`/${l}/account`}>{l === 'ru' ? 'Аккаунт' : l === 'en' ? 'Account' : 'Nalog'}</Link>
          <Link href={`/${l}/notifications`}>{l === 'ru' ? 'Уведомления' : l === 'en' ? 'Notifications' : 'Obaveštenja'}</Link>
          <Link href={`/${l}/help`}>{l === 'ru' ? 'Помощь' : l === 'en' ? 'Help' : 'Pomoć'}</Link>
          <Link href={`/${l}/rules`}>{l === 'ru' ? 'Правила' : l === 'en' ? 'Rules' : 'Pravila'}</Link>
          <Link href={`/${l}/about`}>{l === 'ru' ? 'О платформе' : l === 'en' ? 'About' : 'O platformi'}</Link>
          <span className="ml-auto">© {new Date().getFullYear()} TeroLibrary</span>
        </div>
      </footer>
      )}>
      <SessionKeeper />
      {children}
    </Chrome>
  );
}
