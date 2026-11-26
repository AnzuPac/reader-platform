import Link from 'next/link';
import { Suspense } from 'react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import MobileHeaderMenu from '@/components/MobileHeaderMenu';
import AppearanceSwitcher from '@/components/AppearanceSwitcher';
import type { Lang } from '@/lib/i18n';
import type { Session } from '@/lib/auth';
import DirectionTabs from '@/components/DirectionTabs';
import DesktopPrimaryNav from '@/components/DesktopPrimaryNav';
import SearchOverlay from '@/components/SearchOverlay';

const COPY: Record<Lang, {
  books: string; fanfic: string; graphic: string; search: string; notifications: string; wallet: string;
  signIn: string; profile: string; directions: string; myLibrary: string;
}> = {
  sr: { books: 'Knjige', fanfic: 'Fanfikcija', graphic: 'Grafička literatura', search: 'Pretraga', notifications: 'Obaveštenja', wallet: 'Novčanik', signIn: 'Prijava', profile: 'Profil', directions: 'Vrste sadržaja', myLibrary: 'Moja biblioteka' },
  ru: { books: 'Книги', fanfic: 'Фанфики', graphic: 'Графическая литература', search: 'Поиск', notifications: 'Уведомления', wallet: 'Кошелёк', signIn: 'Войти', profile: 'Профиль', directions: 'Типы контента', myLibrary: 'Моя библиотека' },
  en: { books: 'Books', fanfic: 'Fan fiction', graphic: 'Graphic literature', search: 'Search', notifications: 'Notifications', wallet: 'Wallet', signIn: 'Sign in', profile: 'Profile', directions: 'Content types', myLibrary: 'My library' },
};

export default function SiteHeader({ lang, session, walletLabel, notificationCount }: {
  lang: Lang; session: Session | null; walletLabel: string | null; notificationCount: number;
}) {
  const c = COPY[lang];
  const profileHref = session ? `/${lang}/u/${session.uid}` : `/${lang}/login`;
  return (
    <header className="top tlp-site-header" role="banner">
      <div className="tlp-header-main-row">
        <Link href={`/${lang}`} className="brand" aria-label="TeroLibrary — home">
          <span className="logo tlp-brand-mark" aria-hidden="true"><span className="tlp-brand-mark__art" /></span>
          <span>terolibrary</span>
        </Link>

        <Suspense fallback={<nav className="tlp-desktop-primary-nav" aria-hidden="true" />}>
          <DesktopPrimaryNav lang={lang} />
        </Suspense>

        <div className="right tlp-header-tools">
          <SearchOverlay lang={lang} />
          <Link href={`/${lang}/library`} className="tlp-tool-button tlp-library-tool" aria-label={c.myLibrary} title={c.myLibrary}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 6h13M8 7v13"/></svg>
            <span className="tlp-library-tool-label">{c.myLibrary}</span>
          </Link>
          <Suspense fallback={null}><MobileHeaderMenu lang={lang} /></Suspense>
          <Suspense fallback={<span className="tlp-header-language-placeholder" />}><LanguageSwitcher lang={lang} className="tlp-header-language" /></Suspense>
          <AppearanceSwitcher lang={lang} />
          <Link href={`/${lang}/notifications`} className="tlp-tool-button tlp-notification-link" aria-label={notificationCount ? `${c.notifications}: ${notificationCount}` : c.notifications} title={c.notifications}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/></svg>
            {notificationCount > 0 ? <span className="tlp-notification-count">{notificationCount > 99 ? '99+' : notificationCount}</span> : null}
          </Link>
          {session ? (
            <>
              <Link href={`/${lang}/account`} className="tlp-wallet-link" title={c.wallet}>
                <span className="tlp-wallet-symbol" aria-hidden="true">●</span><span className="tlp-wallet-value">{walletLabel || c.wallet}</span>
              </Link>
              <Link href={profileHref} className="tlp-profile-link" title={c.profile}>
                <span className="tlp-profile-avatar" aria-hidden="true">{session.name.trim().slice(0, 1).toLocaleUpperCase() || '☺'}</span>
                <span className="tlp-profile-name">{session.name}</span>
              </Link>
            </>
          ) : <Link href={`/${lang}/login`} className="btn primary tlp-sign-in">{c.signIn}</Link>}
        </div>
      </div>

      <div className="tlp-header-discover-row">
        <Suspense fallback={<nav className="tlp-main-navigation" aria-label={c.directions} />}>
          <DirectionTabs lang={lang} labels={c} />
        </Suspense>
        <span className="tlp-header-discover-hint">{lang === 'ru' ? 'Истории, которые хочется дочитать' : lang === 'en' ? 'Stories worth staying for' : 'Priče kojima se vraćaš'}</span>
      </div>
    </header>
  );
}
