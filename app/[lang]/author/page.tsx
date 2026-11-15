import { notFound } from 'next/navigation';
import { isLang, type Lang } from '@/lib/i18n';
import { requireAuthor } from '@/lib/author';
import AuthorWorks from '@/components/AuthorWorks';
import AuthorDonations from '@/components/AuthorDonations';
import AuthorIncome from '@/components/AuthorIncome';
import { authorIncome } from '@/lib/earnings';
import EpubImportForm from '@/components/EpubImportForm';

export const dynamic = 'force-dynamic';

export default async function AuthorPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const s = await requireAuthor();
  if (!s) notFound();
  const income = await authorIncome(s.uid);

  return (
    <main id="main" className="mx-auto max-w-4xl px-5 py-10">
      <h1 className="mb-6 text-2xl font-bold">Кабинет автора</h1>
      <EpubImportForm />
      <AuthorWorks lang={l} />
      <div className="mt-8">
        <AuthorIncome initial={income} />
      </div>
      <div className="mt-8">
        <AuthorDonations />
      </div>
    </main>
  );
}
