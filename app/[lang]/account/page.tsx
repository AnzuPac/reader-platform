import { notFound } from 'next/navigation';
import { requireAuthor } from '@/lib/author';
import { readSession } from '@/lib/auth';
import AccountForm from '@/components/AccountForm';
import ProfileSettings from '@/components/ProfileSettings';
import WalletPanel from '@/components/WalletPanel';
import AccountDangerZone from '@/components/AccountDangerZone';
import { ensureWallet, listCoinPackages, listWalletHistory, getEconomySettings } from '@/lib/coins';
import { one } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** SQLite отдаёт null-prototype строки — в klijentский компонент их передавать нельзя. */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export default async function AccountPage() {
  const s = await readSession();
  if (!s) notFound();
  const localeRow = await one<{ locale: string }>('SELECT locale FROM users WHERE id = $1', [s.uid]);
  const profileRow = await one<{ bio: string | null; profile_public: number | boolean | null }>(
    'SELECT bio, profile_public FROM users WHERE id = $1', [s.uid],
  );
  await ensureWallet(s.uid);
  const [balance, packages, history, settings] = await Promise.all([
    ensureWallet(s.uid),
    listCoinPackages(),
    listWalletHistory(s.uid, 40),
    getEconomySettings(s.uid),
  ]);
  return (
    <main id="main" className="mx-auto max-w-xl px-5 py-10">
      <h1 className="mb-6 text-2xl font-bold">Nalog</h1>
      <AccountForm initialName={s.name} email={s.email} role={s.role} />
      <ProfileSettings
        lang={(localeRow?.locale === 'ru' || localeRow?.locale === 'en' ? localeRow.locale : 'sr') as 'sr' | 'ru' | 'en'}
        initialName={s.name}
        initialBio={profileRow?.bio || ''}
        initialPublic={profileRow?.profile_public === null || profileRow?.profile_public === undefined
          ? true
          : (profileRow.profile_public === 1 || profileRow.profile_public === true)}
      />
      <div className="mt-8">
        <WalletPanel
          initial={{
            balance_coins: balance,
            packages: plain(packages),
            history: plain(history),
            settings: plain(settings),
          }}
        />
      </div>
      <AccountDangerZone lang={localeRow?.locale || 'sr'} />
    </main>
  );
}
