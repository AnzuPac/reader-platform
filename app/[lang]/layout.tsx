import { notFound } from 'next/navigation';
import { Suspense } from 'react';
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
    <Chrome
      header={(
        <header className="top">
          <Link href={`/${l}`} className="brand">
            <span className="logo">✦</span> terolibrary
          </Link>
          <nav className="nav">
            <Link href={`/${l}`}>{l === 'ru' ? 'Главная' : l === 'en' ? 'Home' : 'Početna'}</Link>
            <Link href={`/${l}/catalog`}>{l === 'ru' ? 'Каталог' : l === 'en' ? 'Catalog' : 'Katalog'}</Link>
            <Link href={`/${l}/library`}>{l === 'ru' ? 'Библиотека' : l === 'en' ? 'Library' : 'Biblioteka'}</Link>
            <Link href={`/${l}/author`}>{l === 'ru' ? 'Авторам' : l === 'en' ? 'For authors' : 'Autorima'}</Link>
          </nav>
          <form action={`/${l}/catalog`} className="global-search">
            <span>⌕</span>
            <input
              name="q"
              placeholder={l === 'ru' ? 'Название, автор, жанр, фандом или #тег' : l === 'en' ? 'Title, author, genre, fandom or #tag' : 'Naslov, autor, žanr, fandom ili #tag'}
            />
          </form>
          <div className="right">
            <Suspense fallback={<span className="lang">···</span>}><LanguageSwitcher lang={l} /></Suspense>
            <Link href={`/${l}/notifications`} className="iconbtn" aria-label="Notifications">♧</Link>
            <Link href={`/${l}/login`} className="btn">{l === 'ru' ? 'Войти' : l === 'en' ? 'Log in' : 'Prijava'}</Link>
          </div>
        </header>
      )}
      footer={(
        <footer className="footer">
          <span>© {new Date().getFullYear()} TeroLibrary</span>
          <span>
            <Link href={`/${l}/help`} className="lang">{l === 'ru' ? 'Помощь' : l === 'en' ? 'Help' : 'Pomoć'}</Link>
            <Link href={`/${l}/rules`} className="lang">{l === 'ru' ? 'Правила' : l === 'en' ? 'Rules' : 'Pravila'}</Link>
            <Link href={`/${l}/about`} className="lang">{l === 'ru' ? 'О платформе' : l === 'en' ? 'About' : 'O platformi'}</Link>
            <Link href={`/${l}/publisher`} className="lang">{l === 'ru' ? 'Издательствам' : l === 'en' ? 'For publishers' : 'Za izdavače'}</Link>
          </span>
        </footer>
      )}
    >
      <SessionKeeper />
      {children}
    </Chrome>
  );
}
