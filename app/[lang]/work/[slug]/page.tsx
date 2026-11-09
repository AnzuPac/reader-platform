import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLang, type Lang } from '@/lib/i18n';
import { getWork, listChapters, isInLibrary, workGenres } from '@/lib/repo';
import { readSession } from '@/lib/auth';
import LibraryButton from '@/components/LibraryButton';
import { WorkCover } from '@/lib/cover';

export const dynamic = 'force-dynamic';

export default async function WorkPage({
  params,
}: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const work = await getWork(slug);
  if (!work) notFound();
  const chapters = await listChapters(work.id);
  const session = await readSession();
  const inLib = session ? await isInLibrary(session.uid, work.id) : false;
  const first = chapters[0];
  const genres = await workGenres(work.id);

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <div className="card mb-8 p-5 sm:p-7">
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="w-[170px] shrink-0">
            <WorkCover title={work.title} cover={work.cover_path} size="cover-lg" />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="mb-2 text-2xl font-extrabold leading-tight sm:text-3xl">{work.title}</h1>
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm muted">
              <span>{work.author_name}</span>
              <span>★ {work.rating_avg}</span>
              <span>{work.words_total} reči</span>
              <span>{chapters.length} glava</span>
              {work.completion === 'completed' ? <span className="badge-hot">Završeno</span> : null}
              {work.age_rating ? <span className="badge-hot">{work.age_rating}+</span> : null}
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {genres.map((g) => (
                <span key={g.slug} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-mist">{g.name_sr}</span>
              ))}
            </div>
            <p className="mb-5 whitespace-pre-line text-sm leading-relaxed text-ink/80">{work.description}</p>

            <div className="flex flex-wrap items-center gap-3">
              {first ? (
                <Link href={`/${l}/read/${first.id}`} className="btn btn-primary">Čitaj prvu glavu</Link>
              ) : null}
              <LibraryButton workId={work.id} initial={inLib} />
              <Link href={`/${l}/subscribe`} className="btn btn-ghost">Pretplata</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-bold">Sadržaj</h2>
          <span className="text-sm muted">{chapters.length} glava</span>
        </div>
        <ol className="divide-y divide-line">
          {chapters.map((c) => (
            <li key={c.id}>
              <Link href={`/${l}/read/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-[#f2f6ff]">
                <span className="w-9 shrink-0 text-sm muted">{c.number}</span>
                <span className="flex-1 text-sm">{c.title || `Glava ${c.number}`}</span>
                {c.access !== 'free' ? <span className="badge-hot">🔒 Pretplatnici</span> : null}
                <span className="text-xs muted">{c.word_count} reči</span>
              </Link>
            </li>
          ))}
          {chapters.length === 0 ? (
            <li className="px-5 py-6 text-sm muted">Još nema objavljenih glava.</li>
          ) : null}
        </ol>
      </div>
    </main>
  );
}
