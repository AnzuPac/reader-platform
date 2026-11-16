import { notFound } from 'next/navigation';
import { requireAuthor } from '@/lib/author';
import { readSession } from '@/lib/auth';
import AccountForm from '@/components/AccountForm';
import WalletPanel from '@/components/WalletPanel';
import { ensureWallet, listCoinPackages, listWalletHistory, getEconomySettings } from '@/lib/coins';

export const dynamic = 'force-dynamic';

/** SQLite отдаёт null-prototype строки — в klijentский компонент их передавать нельзя. */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export default async function AccountPage() {
  const s = await readSession();
  if (!s) notFound();
  await ensureWallet(s.uid);
  const [balance, packages, history, settings] = await Promise.all([
    ensureWallet(s.uid),
    listCoinPackages(),
    listWalletHistory(s.uid, 40),
    getEconomySettings(s.uid),
  ]);
  return (
    <main className="mx-auto max-w-xl px-5 py-10">
      <h1 className="mb-6 text-2xl font-bold">Nalog</h1>
      <AccountForm initialName={s.name} email={s.email} role={s.role} />
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
    </main>
  );
}
