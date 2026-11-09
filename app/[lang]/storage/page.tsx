import { notFound } from 'next/navigation';
import { readSession } from '@/lib/auth';
import StorageManager from '@/components/StorageManager';

export const dynamic = 'force-dynamic';

export default async function StoragePage() {
  const s = await readSession();
  if (!s) notFound();
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="mb-6 text-2xl font-bold">Moj prostor</h1>
      <StorageManager />
    </main>
  );
}
