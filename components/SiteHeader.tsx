import Link from 'next/link';
import { Suspense } from 'react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import AppearanceSwitcher from '@/components/AppearanceSwitcher';
import type { Lang } from '@/lib/i18n';
import type { Session } from '@/lib/auth';
import DirectionTabs from '@/components/DirectionTabs';
import GlobalSearchForm from '@/components/GlobalSearchForm';

const COPY: Record<Lang, {
  home: string; publisher: string; selfpub: string; fanfic: string; graphic: string; top: string;
  search: string; searchPlaceholder: string; notifications: string; wallet: string; signIn: string;
  profile: string; directions: string; literature: string; catalog: string; myLibrary: string;
}> = {
  sr: {
    home: 'Početna', publisher: 'Izdavači', selfpub: 'Samizdat', fanfic: 'Fanfikcija', graphic: 'Strip i manga', top: 'Top',
    search: 'Pretraga', searchPlaceholder: 'Pretraži knjigu, autora ili fandom', notifications: 'Obaveštenja', wallet: 'Novčanik',
    signIn: 'Prijava', profile: 'Profil', directions: 'Pravci čitanja', literature: 'Literatura', catalog: 'Katalog', myLibrary: 'Moja biblioteka',
  },
  ru: {
    home: 'Главная', publisher: 'Издательства', selfpub: 'Самиздат', fanfic: 'Фанфики', graphic: 'Комиксы и манга', top: 'Топ',
    search: 'Поиск', searchPlaceholder: 'Найти книгу, автора или фандом', notifications: 'Уведомления', wallet: 'Кошелёк',
    signIn: 'Войти', profile: 'Профиль', directions: 'Направления чтения', literature: 'Литература', catalog: 'Каталог', myLibrary: 'Моя библиотека',
  },
  en: {
    home: 'Home', publisher: 'Publishers', selfpub: 'Self-published', fanfic: 'Fan fiction', graphic: 'Comics & manga', top: 'Top',
    search: 'Search', searchPlaceholder: 'Search books, authors or fandoms', notifications: 'Notifications', wallet: 'Wallet',
    signIn: 'Sign in', profile: 'Profile', directions: 'Browse sections', literature: 'Literature', catalog: 'Catalog', myLibrary: 'My library',
  },
};

export default function SiteHeader({
  lang, session, walletLabel, notificationCount,
}: {
  lang: Lang;
  session: Session | null;
  walletLabel: string | null;
  notificationCount: number;
}) {
  const c = COPY[lang];
  const profileHref = session ? `/${lang}/u/${session.uid}` : `/${lang}/login`;
  return (
    <>
      <header className="top tlp-site-header" role="banner">
        <Link href={`/${lang}`} className="brand" aria-label="TeroLibrary — home">
          <span className="logo" aria-hidden="true">✦</span>
          <span>terolibrary</span>
        </Link>

<Suspense fallback={<nav className="tlp-direction-tabs" aria-label={c.directions} />}><DirectionTabs lang={lang} labels={c} libraryHref={session ? `/${lang}/u/${session.uid}?tab=library` : `/${lang}/login?next=${encodeURIComponent(`/${lang}/account`)}`} /></Suspense>

        <div className="right tlp-header-tools">
          <Suspense fallback={<span className="tlp-search-placeholder" />}>
            <GlobalSearchForm lang={lang} placeholder={c.searchPlaceholder} label={c.search} />
          </Suspense>
          <Link href={`/${lang}/catalog`} className="tlp-tool-button tlp-mobile-search" aria-label={c.search} title={c.search}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>
          </Link>
          <Suspense fallback={<span className="tlp-header-language-placeholder" />}><LanguageSwitcher lang={lang} className="tlp-header-language" /></Suspense>
          <AppearanceSwitcher lang={lang} />
          <Link href={`/${lang}/notifications`} className="tlp-tool-button tlp-notification-link" aria-label={notificationCount ? `${c.notifications}: ${notificationCount}` : c.notifications} title={c.notifications}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/></svg>
            {notificationCount > 0 ? <span className="tlp-notification-count">{notificationCount > 99 ? '99+' : notificationCount}</span> : null}
          </Link>
          {session ? (
            <>
              <Link href={`/${lang}/account`} className="tlp-wallet-link" title={c.wallet}>
                <span className="tlp-wallet-symbol" aria-hidden="true">●</span>
                <span className="tlp-wallet-value">{walletLabel || c.wallet}</span>
              </Link>
              <Link href={profileHref} className="tlp-profile-link" title={c.profile}>
                <span className="tlp-profile-avatar" aria-hidden="true">{session.name.trim().slice(0, 1).toLocaleUpperCase() || '☺'}</span>
                <span className="tlp-profile-name">{session.name}</span>
              </Link>
            </>
          ) : (
            <Link href={`/${lang}/login`} className="btn primary tlp-sign-in">{c.signIn}</Link>
          )}
        </div>
      </header>
    </>
  );
}
