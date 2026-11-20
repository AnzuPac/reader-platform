import { notFound } from 'next/navigation';
import Link from 'next/link';
import { isLang, type Lang } from '@/lib/i18n';
import { readSession } from '@/lib/auth';
import { walletBalance } from '@/lib/coins';
import { coinsWithRsd } from '@/lib/money';
import { countLibraryUpdates } from '@/lib/repo';
import { countFollowUpdates } from '@/lib/follows';
import Chrome from '@/components/Chrome';
import SessionKeeper from '@/components/SessionKeeper';
import SiteHeader from '@/components/SiteHeader';

export const dynamic = 'force-dynamic';

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

  const session = await readSession().catch(() => null);
  const [balance, libraryUpdates, followUpdates] = session
    ? await Promise.all([
        walletBalance(session.uid).catch(() => 0),
        countLibraryUpdates(session.uid).catch(() => 0),
        countFollowUpdates(session.uid).catch(() => 0),
      ])
    : [0, 0, 0];
  const notificationCount = libraryUpdates + followUpdates;

  const footerCopy: Record<Lang, { help: string; rules: string; about: string; authors: string; publishers: string }> = {
    sr: { help: 'Pomoć', rules: 'Pravila', about: 'O platformi', authors: 'Za autore', publishers: 'Za izdavače' },
    ru: { help: 'Помощь', rules: 'Правила', about: 'О платформе', authors: 'Авторам', publishers: 'Издательствам' },
    en: { help: 'Help', rules: 'Rules', about: 'About', authors: 'For authors', publishers: 'For publishers' },
  };
  const f = footerCopy[l];

  return (
    <Chrome lang={l} userId={session?.uid ?? null}>
      <SiteHeader
        lang={l}
        session={session}
        walletLabel={session ? (l === 'sr' ? coinsWithRsd(balance) : l === 'ru' ? `${balance} монет (${balance} RSD)` : `${balance} coins (${balance} RSD)`) : null}
        notificationCount={notificationCount}
      />
      <SessionKeeper />
      {children}
      <footer className="footer tlp-site-footer">
        <span>© {new Date().getFullYear()} TeroLibrary</span>
        <nav aria-label={l === 'ru' ? 'Информация' : l === 'en' ? 'Information' : 'Informacije'}>
          <Link href={`/${l}/about`}>{f.about}</Link>
          <Link href={`/${l}/rules`}>{f.rules}</Link>
          <Link href={`/${l}/help`}>{f.help}</Link>
          <Link href={`/${l}/author`}>{f.authors}</Link>
          <Link href={`/${l}/publisher`}>{f.publishers}</Link>
        </nav>
      </footer>
    </Chrome>
  );
}
