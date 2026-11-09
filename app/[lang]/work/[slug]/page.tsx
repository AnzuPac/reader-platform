import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLang, type Lang } from '@/lib/i18n';
import { getWork, listChapters } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export default async function WorkPage({
  params,
}: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const work = await getWork(slug);
  if (!work) notFound();
  const chapters = await listChapters(work.id);

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="mb-2 text-3xl font-bold">{work.title}</h1>
      <p className="mb-6 text-sm muted">{work.author_name} · {work.words_total} слов · ★ {work.rating_avg}</p>
      <p className="mb-8 whitespace-pre-line muted">{work.description}</p>

      <h2 className="mb-3 text-xl font-semibold">Sadržaj</h2>
      <ol className="divide-y divide-line/60">
        {chapters.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-3">
            <span className="w-10 text-sm muted">{c.number}.</span>
            <Link href={`/${l}/read/${c.id}`} className="flex-1 hover:text-violet">{c.title || `Glava ${c.number}`}</Link>
            {c.access !== 'free' ? <span className="text-xs text-sakura">🔒</span> : null}
          </li>
        ))}
        {chapters.length === 0 ? <li className="py-3 muted">Još nema objavljenih glava.</li> : null}
      </ol>
    </main>
  );
}
