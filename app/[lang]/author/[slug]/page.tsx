import { notFound } from 'next/navigation';
import Link from 'next/link';
import { isLang, type Lang } from '@/lib/i18n';
import { requireAuthor } from '@/lib/author';
import { getAuthorWork } from '@/lib/repo';
import ChapterEditor from '@/components/ChapterEditor';

export const dynamic = 'force-dynamic';

export default async function AuthorWorkPage({
  params,
}: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const s = await requireAuthor();
  if (!s) notFound();
  const work = await getAuthorWork(slug, s.uid);
  if (!work) notFound();

  return (
    <main className="mx-auto max-w-4xl px-5 py-8">
      <div className="mb-5 flex items-center gap-3">
        <Link href={`/${l}/author`} className="text-sm muted hover:text-brand">← Кабинет автора</Link>
        <span className="text-sm muted">·</span>
        <span className="text-sm">{work.title}</span>
      </div>
      <ChapterEditor workSlug={slug} />
    </main>
  );
}
