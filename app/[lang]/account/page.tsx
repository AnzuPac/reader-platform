import { notFound } from 'next/navigation';
import { requireAuthor } from '@/lib/author';
import { readSession } from '@/lib/auth';
import AccountForm from '@/components/AccountForm';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const s = await readSession();
  if (!s) notFound();
  return (
    <main className="mx-auto max-w-xl px-5 py-10">
      <h1 className="mb-6 text-2xl font-bold">Nalog</h1>
      <AccountForm initialName={s.name} email={s.email} role={s.role} />
    </main>
  );
}
