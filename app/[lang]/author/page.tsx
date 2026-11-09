import { notFound } from 'next/navigation';
import { isLang, type Lang } from '@/lib/i18n';
import { requireAuthor } from '@/lib/author';
import AuthorWorks from '@/components/AuthorWorks';

export const dynamic = 'force-dynamic';

export default async function AuthorPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const s = await requireAuthor();
  if (!s) notFound();

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <h1 className="mb-6 text-2xl font-bold">Кабинет автора</h1>
      <AuthorWorks lang={l} />
    </main>
  );
}
