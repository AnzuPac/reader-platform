import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLang, type Lang } from '@/lib/i18n';
import { getChapter, listChapters, query, one } from '@/lib/repo-extra';
import { readSession } from '@/lib/auth';
import ReaderClient from '@/components/ReaderClient';
import AdSlot from '@/components/AdSlot';
import ReaderSettings from '@/components/ReaderSettings';
import ChapterBody from '@/components/ChapterBody';
import Comments from '@/components/Comments';

export const dynamic = 'force-dynamic';

export default async function ReadPage({
  params,
}: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const chapterId = Number(id);
  if (!Number.isFinite(chapterId)) notFound();
  const ch = await getChapter(chapterId);
  if (!ch) notFound();

  const session = await readSession();
  let locked = false;
  if (ch.access !== 'free') {
    if (!session) locked = true;
    else {
      const ent = await one(
        `SELECT 1 AS ok FROM entitlements WHERE user_id=$1 AND ((target_type='chapter' AND target_id=$2)
            OR (target_type='work' AND target_id=$3))
         UNION ALL
         SELECT 1 AS ok FROM subscriptions WHERE user_id=$1 AND status='active' AND current_period_end > now() LIMIT 1`,
        [session.uid, ch.id, ch.work_id]
      );
      locked = !ent;
    }
  }

  const chapters = await listChapters(ch.work_id);
  const idx = chapters.findIndex((c) => c.id === ch.id);
  const prev = idx > 0 ? chapters[idx - 1] : null;
  const next = idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <div className="mb-6 flex items-center gap-3 text-sm muted">
        <Link href={`/${l}/work/${ch.work_slug}`} className="hover:text-violet">← {ch.work_title}</Link>
        <span>·</span>
        <span>Glava {ch.number}</span>
      </div>
      <h1 className="mb-8 text-2xl font-bold">{ch.title || `Glava ${ch.number}`}</h1>

      {ch.font_path && ch.font_family ? (
        <style dangerouslySetInnerHTML={{ __html: `
          @font-face { font-family: '${ch.font_family}'; src: url('${ch.font_path}'); font-display: swap; }
          .reader-surface .prose-reader { font-family: '${ch.font_family}', Georgia, serif; }
        ` }} />
      ) : null}

      {locked ? (
        <div className="card p-6">
          <h2 className="mb-2 text-lg font-semibold">🔒 Ova glava je za pretplatnike</h2>
          <p className="muted">Pretplati se da nastaviš čitanje. Prve glave su uvek besplatne.</p>
          <Link href={`/${l}/subscribe`} className="btn btn-primary mt-4 inline-flex">Pretplata</Link>
        </div>
      ) : (
        <ChapterBody chapterId={ch.id} initialHtml={ch.content} />
      )}

      <AdSlot slot="chapter_end" />

      <ReaderClient chapterId={ch.id} workId={ch.work_id} />
      <Comments workId={ch.work_id} chapterId={ch.id} />
      <ReaderSettings />

      <nav className="mt-12 flex items-center justify-between text-sm">
        {prev ? <Link className="btn btn-ghost" href={`/${l}/read/${prev.id}`}>← Glava {prev.number}</Link> : <span />}
        {next ? <Link className="btn btn-ghost" href={`/${l}/read/${next.id}`}>Glava {next.number} →</Link> : <span />}
      </nav>
    </main>
  );
}
