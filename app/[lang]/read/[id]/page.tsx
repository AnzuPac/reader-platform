import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLang, type Lang } from '@/lib/i18n';
import { getChapter, listChapters } from '@/lib/repo-extra';
import { readSession } from '@/lib/auth';
import { chapterGate, workPrice, effectiveChapterPrice } from '@/lib/purchases';
import { translitSr } from '@/lib/sr';
import { flag } from '@/lib/search';
import { one } from '@/lib/db';
import ReaderClient from '@/components/ReaderClient';
import ReaderTTS from '@/components/ReaderTTS';
import AdSlot from '@/components/AdSlot';
import ReaderSettings from '@/components/ReaderSettings';
import ChapterBody from '@/components/ChapterBody';
import Comments from '@/components/Comments';
import ComicReader from '@/components/ComicReader';
import BuyButton from '@/components/BuyButton';
import ChapterBuyButton from '@/components/ChapterBuyButton';
import { coinsWithRsd } from '@/lib/money';
import DonateButton from '@/components/DonateButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<{ script?: string }>;
}) {
  const { lang, id } = await params;
  const { script: scriptParam } = await searchParams;
  const script = scriptParam === 'lat' ? 'lat' : 'cir';
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const chapterId = Number(id);
  if (!Number.isFinite(chapterId)) notFound();
  const ch = await getChapter(chapterId);
  if (!ch) notFound();

  const session = await readSession();
  const gate = await chapterGate({ id: ch.id, work_id: ch.work_id, access: ch.access }, session);
  const locked = !gate.allowed;
  const bookPrice = ch.access === 'paid' ? await workPrice(ch.work_id) : null;
  const chapterPrice = ch.access === 'paid'
    ? await effectiveChapterPrice({ id: ch.id, work_id: ch.work_id, price_cents: ch.price_cents })
    : null;
  const chapterPriceCents = chapterPrice?.amount_cents ?? 0;
  const chapterCoins = chapterPrice?.coins ?? 0;
  const authorRow = await one<{ author_id: number }>('SELECT author_id FROM works WHERE id = $1', [ch.work_id]);
  const canDonate = !!session && authorRow?.author_id !== session.uid;

  const chapters = await listChapters(ch.work_id);
  const idx = chapters.findIndex((c) => c.id === ch.id);
  const prev = idx > 0 ? chapters[idx - 1] : null;
  const next = idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : null;

  return (
    <main id="main" className="mx-auto max-w-3xl px-5 py-10">
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

      <h1 className="mb-3 text-2xl font-bold">{ch.title || `Glava ${ch.number}`}</h1>
      {ch.translit_allowed ? (
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Link href={`/${l}/read/${ch.id}?script=cir`}
                className={script === 'cir' ? 'rounded border border-violet px-2 py-1' : 'rounded border border-white/20 px-2 py-1 muted'}>
            Ćirilica
          </Link>
          <Link href={`/${l}/read/${ch.id}?script=lat`}
                className={script === 'lat' ? 'rounded border border-violet px-2 py-1' : 'rounded border border-white/20 px-2 py-1 muted'}>
            Latinica
          </Link>
        </div>
      ) : null}

      {ch.font_path && ch.font_family ? (
        <style dangerouslySetInnerHTML={{ __html: `
          @font-face { font-family: '${ch.font_family}'; src: url('${ch.font_path}'); font-display: swap; }
          .reader-surface .prose-reader { font-family: '${ch.font_family}', Georgia, serif; }
        ` }} />
      ) : null}

      {locked ? (
        <div className="card p-6">
          {gate.reason === 'payment_required' ? (
            <>
              <h2 className="mb-2 text-lg font-semibold">🔒 Ova glava se kupuje</h2>
              <p className="muted mb-4">
                Kupi glavu za novčiće ili celu knjigu u dinarima — pristup ostaje tvoj zauvek.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {chapterCoins > 0 ? (
                  <ChapterBuyButton
                    chapterId={ch.id}
                    coins={chapterCoins}
                    priceLabel={coinsWithRsd(chapterCoins)}
                    label="Kupi glavu"
                  />
                ) : null}
                {bookPrice ? (
                  <BuyButton
                    workId={ch.work_id}
                    priceCents={bookPrice.amount_cents}
                    currency={bookPrice.currency}
                    lang={l}
                    label="Kupi celu knjigu"
                  />
                ) : null}
                {session ? null : (
                  <Link href={`/${l}/login`} className="btn btn-ghost">Prijava</Link>
                )}
              </div>
            </>
          ) : gate.reason === 'login_required' ? (
            <>
              <h2 className="mb-2 text-lg font-semibold">🔒 Prijavi se da nastaviš</h2>
              <p className="muted mb-4">Ova glava je dostupna prijavljenim čitaocima.</p>
              <Link href={`/${l}/login`} className="btn btn-primary inline-flex">Prijava</Link>
            </>
          ) : (
            <>
              <h2 className="mb-2 text-lg font-semibold">🔒 Ova glava je za pretplatnike</h2>
              <p className="muted">Pretplati se da nastaviš čitanje. Prve glave su uvek besplatne.</p>
              <Link href={`/${l}/subscribe`} className="btn btn-primary mt-4 inline-flex">Pretplata</Link>
            </>
          )}
        </div>
      ) : (
        ch.work_type === 'comic' ? (
          <ComicReader
            chapterId={ch.id}
            workId={ch.work_id}
            workSlug={ch.work_slug}
            coins={chapterCoins}
            lang={l}
          />
        ) : (
          <ChapterBody
            chapterId={ch.id}
            initialHtml={ch.access === 'free' ? (script === 'lat' && ch.translit_allowed ? translitSr(ch.content, 'lat') : ch.content) : ''}
            protected={ch.access !== 'free'}
            fetchOnMount={ch.access !== 'free'}
            script={script}
            translitAllowed={flag(ch.translit_allowed)}
            paragraphCommentsEnabled={flag(ch.paragraph_comments_enabled)}
          />
        )
      )}

      {!locked && canDonate ? (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <DonateButton workId={ch.work_id} chapterId={ch.id} authorName={ch.work_title} lang={l} />
          <span className="text-xs muted">Podrška ide autoru, ne platformi.</span>
        </div>
      ) : null}

      {/* Озвучка — только если правообладатель разрешил (works.tts_allowed)
          и только для текстовых глав. Скачивание глав намеренно отсутствует:
          локальная копия платного текста = готовый способ пиратить. */}
      {!locked && ch.work_type !== 'comic' ? (
        <div className="mt-6 flex flex-wrap items-center gap-4">
          {flag(ch.tts_allowed) ? <ReaderTTS lang={l} /> : null}
        </div>
      ) : null}

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
