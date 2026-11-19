import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLang, type Lang } from '@/lib/i18n';
import { getWork, listChapters, isInLibrary, workGenres, listRelatedWorks } from '@/lib/repo';
import { query } from '@/lib/db';
import { readSession } from '@/lib/auth';
import LibraryButton from '@/components/LibraryButton';
import CollectionAddButton from '@/components/CollectionAddButton';
import BuyButton from '@/components/BuyButton';
import { WorkCover } from '@/lib/cover';
import RatingStars from '@/components/RatingStars';
import Comments from '@/components/Comments';
import DonateButton from '@/components/DonateButton';
import ChapterBuyButton from '@/components/ChapterBuyButton';
import { workPrice, hasWorkAccess, hasActiveSubscription, effectiveChapterPrice, chapterPriceSummary } from '@/lib/purchases';
import { formatRsd, coinsWithRsd } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { slug } = await params;
  const w = await getWork(slug).catch(() => null);
  if (!w) return { title: 'Nije pronađeno' };
  return {
    title: `${w.title} — ${w.author_name}`,
    description: (w.description || '').slice(0, 160),
    openGraph: {
      title: w.title,
      description: (w.description || '').slice(0, 160),
      images: w.cover_path ? [w.cover_path] : undefined,
      type: 'book',
    },
  };
}

export default async function WorkPage({
  params,
}: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const work = await getWork(slug);
  if (!work) notFound();
  await query('UPDATE works SET views_total = views_total + 1 WHERE id = $1', [work.id]);
  const chapters = await listChapters(work.id);
  const session = await readSession();
  const inLib = session ? await isInLibrary(session.uid, work.id) : false;
  const first = chapters[0];
  const genres = await workGenres(work.id);
  const related = await listRelatedWorks(work.id).catch(() => []);
  const price = await workPrice(work.id);
  const owned = session ? await hasWorkAccess(session.uid, work.id) : false;
  const subscribed = session ? await hasActiveSubscription(session.uid) : false;
  const canDonate = !!session && session.uid !== work.author_id;

  // Все платные glave: цена в монетах и потолок «вся книга не дороже N RSD».
  const chapterPrices = new Map<number, { coins: number; amount_cents: number; currency: string } | null>();
  if (!owned) {
    await Promise.all(
      chapters
        .filter((c) => c.access === 'paid')
        .map(async (c) => {
          chapterPrices.set(c.id, await effectiveChapterPrice({ id: c.id, work_id: work.id, price_cents: c.price_cents }));
        })
    );
  }
  const paidCoins = [...chapterPrices.values()].filter(Boolean).map((v) => v!.coins);
  const minCoins = paidCoins.length ? Math.min(...paidCoins) : 0;
  const maxCoins = paidCoins.length ? Math.max(...paidCoins) : 0;
  const cap = await chapterPriceSummary(work.id);
  const bookRsd = price ? formatRsd(price.amount_cents) : null;

  return (
    <main id="main" className="mx-auto max-w-5xl px-5 py-8">
      <div className="card mb-8 p-5 sm:p-7">
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="w-[170px] shrink-0">
            <WorkCover title={work.title} cover={work.cover_path} size="cover-lg" />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="mb-2 text-2xl font-extrabold leading-tight sm:text-3xl">{work.title}</h1>
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm muted">
              <span>{work.author_name}</span>
              <RatingStars workId={work.id} initialAvg={String(work.rating_avg)} />
              <span>{work.words_total} {work.type === 'comic' ? 'stranica' : 'reči'}</span>
              <span>{chapters.length} glava</span>
              {work.completion === 'completed' ? <span className="badge-hot">Završeno</span> : null}
              {work.age_rating ? <span className="badge-hot">{work.age_rating}+</span> : null}
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {genres.map((g) => (
                <span key={g.slug} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-mist">
                  {l === 'ru' ? g.name_ru : l === 'en' ? g.name_en : g.name_sr}
                </span>
              ))}
              {work.type === 'comic' ? (
                <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-mist">
                  {l === 'ru' ? 'Комикс' : l === 'en' ? 'Comic' : 'Strip'}
                </span>
              ) : null}
              {work.kind === 'fanfic' ? (
                <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-mist">
                  {l === 'ru' ? 'Фанфик' : l === 'en' ? 'Fan fiction' : 'Fanfikcija'}
                </span>
              ) : null}
              {work.fandom ? (
                <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-mist">
                  {l === 'ru' ? 'Фандом' : l === 'en' ? 'Fandom' : 'Fandom'}: {work.fandom}
                </span>
              ) : null}
              {work.pairing ? (
                <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-mist">
                  {l === 'ru' ? 'Пейринг' : l === 'en' ? 'Pairing' : 'Paring'}: {work.pairing}
                </span>
              ) : null}
              {work.comic_format ? (
                <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-mist">
                  {work.comic_format}
                  {work.reading_direction === 'rtl' ? ` · ${l === 'ru' ? 'справа налево' : l === 'en' ? 'right to left' : 'zdesna nalevo'}` : ''}
                </span>
              ) : null}
              {work.content_warnings ? (
                <span className="rounded-full border border-sakura/60 px-2.5 py-0.5 text-xs text-sakura">
                  ⚠ {work.content_warnings}
                </span>
              ) : null}
            </div>
            <p className="mb-5 whitespace-pre-line text-sm leading-relaxed text-ink/80">{work.description}</p>

            <div className="mb-4 rounded-lg border border-line p-3 text-sm">
              <div className="mb-1 font-semibold">Cena</div>
              <ul className="space-y-1">
                <li>
                  <span className="badge-hot">U pretplati</span>{' '}
                  <Link href={`/${l}/subscribe`} className="underline">mesečno 699 RSD — bez ograničenja</Link>
                </li>
                {bookRsd ? (
                  <li>Kupi zauvek — <strong>{bookRsd}</strong> · trajni pristup, ostaje posle uklanjanja iz kataloga</li>
                ) : null}
                {minCoins > 0 ? (
                  <li>
                    Glave:{' '}
                    <strong>{minCoins === maxCoins ? `${minCoins} novčića` : `${minCoins}–${maxCoins} novčića`}</strong>{' '}
                    ({minCoins === maxCoins ? `${minCoins} RSD` : `${minCoins}–${maxCoins} RSD`}) po glavi
                    {bookRsd ? `, cela knjiga ne više od ${bookRsd}` : ''}
                  </li>
                ) : null}
                {canDonate ? <li>Podrži autora — dobrovoljni donat, bez obaveze</li> : null}
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {owned ? (
                first ? <Link href={`/${l}/read/${first.id}`} className="btn btn-primary">Čitaj</Link> : null
              ) : price && !subscribed ? (
                <BuyButton workId={work.id} priceCents={price.amount_cents} currency={price.currency} lang={l} label="Kupi zauvek" />
              ) : first ? (
                <Link href={`/${l}/read/${first.id}`} className="btn btn-primary">Čitaj prvu glavu</Link>
              ) : null}
              {!owned && price ? (
                <span className="text-sm muted">{bookRsd} · trajni pristup</span>
              ) : null}
              <LibraryButton workId={work.id} initial={inLib} />
              {session ? <CollectionAddButton workId={work.id} lang={l} /> : null}
              {canDonate ? <DonateButton workId={work.id} authorName={work.author_name} lang={l} /> : null}
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
              {c.access === 'paid' && !owned && chapterPrices.get(c.id) ? (
                <div className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span className="w-9 shrink-0 text-sm muted">{c.number}</span>
                  <Link href={`/${l}/read/${c.id}`} className="min-w-0 flex-1 truncate text-sm hover:text-brand">
                    {c.title || `Glava ${c.number}`}
                  </Link>
                  <span className="badge-hot">🔒 Kupovina</span>
                  <ChapterBuyButton
                    chapterId={c.id}
                    coins={chapterPrices.get(c.id)!.coins}
                    priceLabel={coinsWithRsd(chapterPrices.get(c.id)!.coins)}
                    label="Kupi glavu"
                  />
                  <span className="text-xs muted">{c.word_count} {work.type === 'comic' ? 'str.' : 'reči'}</span>
                </div>
              ) : (
                <Link href={`/${l}/read/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-[#f2f6ff]">
                  <span className="w-9 shrink-0 text-sm muted">{c.number}</span>
                  <span className="flex-1 text-sm">{c.title || `Glava ${c.number}`}</span>
                  {c.access === 'paid' ? (
                    <span className="badge-hot">🔒 Kupovina</span>
                  ) : c.access !== 'free' ? (
                    <span className="badge-hot">🔒 Pretplatnici</span>
                  ) : null}
                  <span className="text-xs muted">{c.word_count} {work.type === 'comic' ? 'str.' : 'reči'}</span>
                </Link>
              )}
            </li>
          ))}
          {chapters.length === 0 ? (
            <li className="px-5 py-6 text-sm muted">Još nema objavljenih glava.</li>
          ) : null}
        </ol>
      </div>

      <Comments workId={work.id} />
      {related.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-xl font-bold">{l === 'ru' ? 'Похожие произведения' : l === 'en' ? 'Related works' : 'Slična dela'}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((r) => (
              <Link key={r.id} href={`/${l}/work/${r.slug}`} className="group">
                <div className="cover cover-sm relative overflow-hidden">
                  {r.cover_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.cover_path} alt={r.title} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <span className="relative line-clamp-3">{r.title}</span>
                  )}
                </div>
                <div className="mt-2 line-clamp-1 text-sm font-semibold group-hover:text-brand">{r.title}</div>
                <div className="text-xs muted">{r.author_name}</div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
