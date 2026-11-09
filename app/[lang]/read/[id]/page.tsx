import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLang, type Lang } from '@/lib/i18n';
import { getChapter, listChapters, query, one } from '@/lib/repo-extra';
import { readSession } from '@/lib/auth';
import { canReadChapter } from '@/lib/access';
import ReaderClient from '@/components/ReaderClient';
import AdSlot from '@/components/AdSlot';
import ReaderSettings from '@/components/ReaderSettings';
import ChapterBody from '@/components/ChapterBody';
import Comments from '@/components/Comments';
import ComicReader from '@/components/ComicReader';

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
  let hasEntitlement = false;
  let hasActiveSubscription = false;
  if (session) {
    const ent = await one(
      `SELECT 1 AS ok FROM entitlements WHERE user_id=$1 AND ((target_type='chapter' AND target_id=$2)
          OR (target_type='work' AND target_id=$3))`,
      [session.uid, ch.id, ch.work_id]
    );
    hasEntitlement = !!ent;
    const sub = await one(
      `SELECT 1 AS ok FROM subscriptions WHERE user_id=$1 AND status='active' AND current_period_end > now() LIMIT 1`,
      [session.uid]
    );
    hasActiveSubscription = !!sub;
  }
  const locked = !canReadChapter({
    access: ch.access, loggedIn: !!session, hasEntitlement, hasActiveSubscription,
  });

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
      <details className="card mb-6 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold">Sadržaj · {chapters.length} glava</summary>
        <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto text-sm">
          {chapters.map((c) => (
            <li key={c.id}>
              <Link href={`/${l}/read/${c.id}`}
                className={`flex items-center gap-2 rounded px-2 py-1 hover:bg-[#221a35] ${c.id === ch.id ? 'text-brand' : 'text-mist'}`}>
                <span className="w-8">{c.number}.</span>
                <span className="flex-1">{c.title || `Glava ${c.number}`}</span>
                {c.access !== 'free' ? <span className="text-xs">🔒</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      </details>

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
        ch.work_type === 'comic' ? <ComicReader chapterId={ch.id} /> : <ChapterBody chapterId={ch.id} initialHtml={ch.content} />
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
