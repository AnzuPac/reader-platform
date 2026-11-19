import Link from 'next/link';
import { isLang, t, type Lang } from '@/lib/i18n';
import { readSession } from '@/lib/auth';
import { listWorks, getContinueReading } from '@/lib/repo';

export const dynamic = 'force-dynamic';

type Card = {
  id: number; slug: string; title: string; author_name: string;
  cover_path: string | null; rating_avg: string; completion: string; type?: string; kind?: string;
};

const TXT: Record<Lang, {
  hello: string; continueReading: string; continueBtn: string;
  fresh: string; freshSub: string; popular: string; popularSub: string;
  allCatalog: string; books: string; comics: string; fanfics: string; empty: string;
  heroTitle: string; heroText: string; discover: string; search: string; genres: string;
  recommendations: string; top: string; browseAll: string; manga: string;
}> = {
  sr: {
    hello: 'Dobro došli nazad', continueReading: 'Nastavi čitanje', continueBtn: 'Nastavi',
    fresh: 'Novo na platformi', freshSub: 'Sveže objavljeno — prvo poglavlje obično besplatno',
    popular: 'Najčitanije', popularSub: 'Ono što čitaoci najviše otvaraju',
    allCatalog: 'Ceo katalog', books: 'Knjige', comics: 'Stripovi', fanfics: 'Fanfikcija',
    empty: 'Još nema objavljenih dela u ovom izboru.',
    heroTitle: 'Priče koje ostaju sa tobom', heroText: 'Otkrij knjige, stripove i fanfikciju. Pronađi sledeće omiljeno čitanje.', discover: 'Istraži katalog', search: 'Naslov, autor ili fandom…', genres: 'Istraži po žanru',
    recommendations: 'Preporuke', top: 'Nedeljni top', browseAll: 'Sva dela', manga: 'Manga i stripovi',
  },
  ru: {
    hello: 'С возвращением', continueReading: 'Продолжить чтение', continueBtn: 'Дальше',
    fresh: 'Новое на платформе', freshSub: 'Свежие публикации — первая глава обычно бесплатна',
    popular: 'Самое читаемое', popularSub: 'То, что читатели открывают чаще всего',
    allCatalog: 'Весь каталог', books: 'Книги', comics: 'Комиксы', fanfics: 'Фанфики',
    empty: 'В этой подборке пока нет опубликованных произведений.',
    heroTitle: 'Истории, которые остаются с тобой', heroText: 'Открой книги, комиксы и фанфики. Найди своё следующее любимое чтение.', discover: 'Исследовать каталог', search: 'Название, автор или фандом…', genres: 'Популярные жанры',
    recommendations: 'Рекомендации', top: 'Топ недели', browseAll: 'Все произведения', manga: 'Манга и комиксы',
  },
  en: {
    hello: 'Welcome back', continueReading: 'Continue reading', continueBtn: 'Continue',
    fresh: 'New on the platform', freshSub: 'Freshly published — the first chapter is usually free',
    popular: 'Most read', popularSub: 'What readers open the most',
    allCatalog: 'Full catalog', books: 'Books', comics: 'Comics', fanfics: 'Fan fiction',
    empty: 'No published works in this selection yet.',
    heroTitle: 'Stories that stay with you', heroText: 'Discover books, comics and fan fiction. Find your next favourite read.', discover: 'Explore catalog', search: 'Title, author or fandom…', genres: 'Explore by genre',
    recommendations: 'Recommended', top: 'Weekly top', browseAll: 'Browse all', manga: 'Manga & comics',
  },
};

function Grid({ items, lang, empty }: { items: Card[]; lang: Lang; empty: string }) {
  if (items.length === 0) return <div className="card p-6 text-center text-sm muted">{empty}</div>;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((w) => (
        <Link key={w.id} href={`/${lang}/work/${w.slug}`} className="work-card group">
          <div className="cover cover-sm relative overflow-hidden">
            {w.cover_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={w.cover_path} alt={w.title} loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <span className="relative line-clamp-3">{w.title}</span>
            )}
          </div>
          <div className="work-card-title line-clamp-2 group-hover:text-brand">{w.title}</div>
          <div className="work-card-author line-clamp-1">{w.author_name}</div>
        </Link>
      ))}
    </div>
  );
}

/** Блок категории: рекомендации (новое) + топ по прочтениям. */
function CategoryBlock({
  title, recommendations, top, lang, empty, href, accent, recLabel, topLabel, browseAll,
}: {
  title: string; recommendations: Card[]; top: Card[]; lang: Lang; empty: string;
  href: string; accent: string; recLabel: string; topLabel: string; browseAll: string;
}) {
  const sep = href.includes('?') ? '&' : '?';
  return (
    <section className={`mb-10 rounded-2xl border p-4 sm:p-6 ${accent}`}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-extrabold sm:text-2xl">{title}</h2>
        <Link className="btn btn-ghost text-sm" href={href}>{browseAll} →</Link>
      </div>

      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">{recLabel}</h3>
          <Link href={`${href}${sep}filter=fresh`} className="text-sm text-brand hover:underline">→</Link>
        </div>
        <Grid items={recommendations} lang={lang} empty={empty} />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">{topLabel}</h3>
          <Link href={`${href}${sep}filter=popular`} className="text-sm text-brand hover:underline">→</Link>
        </div>
        <Grid items={top} lang={lang} empty={empty} />
      </div>
    </section>
  );
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const x = TXT[l];

  const session = await readSession();
  const cont = session ? await getContinueReading(session.uid).catch(() => null) : null;

  const [booksFresh, booksTop, fanficFresh, fanficTop, mangaFresh, mangaTop] = await Promise.all([
    listWorks({ type: 'novel', fanfic: false, sort: 'new', limit: 4 }).catch(() => []),
    listWorks({ type: 'novel', fanfic: false, sort: 'views', limit: 4 }).catch(() => []),
    listWorks({ fanfic: true, sort: 'new', limit: 4 }).catch(() => []),
    listWorks({ fanfic: true, sort: 'views', limit: 4 }).catch(() => []),
    listWorks({ type: 'comic', sort: 'new', limit: 4 }).catch(() => []),
    listWorks({ type: 'comic', sort: 'views', limit: 4 }).catch(() => []),
  ]);

  return (
    <main id="main" className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
      <section className="relative mb-8 overflow-hidden rounded-3xl border border-[#e5dfed] bg-gradient-to-br from-[#f1edf8] via-white to-[#f7f1ee] p-6 sm:p-10 lg:p-12">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[#d9cbea]/50 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-brand">TeroLibrary · digital library</p>
          <h1 className="max-w-xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{x.heroTitle}</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-mist sm:text-base">{x.heroText}</p>
          <form action={`/${l}/catalog`} className="mt-6 flex max-w-xl flex-col gap-2 sm:flex-row">
            <input className="input flex-1 bg-white" name="q" placeholder={x.search} />
            <button className="btn btn-primary" type="submit">⌕ {x.discover}</button>
          </form>
          <div className="mt-5 flex flex-wrap gap-2">
            {[x.books, x.comics, x.fanfics].map((label, i) => <Link key={label} href={`/${l}/catalog${i === 1 ? '?kind=comic' : i === 2 ? '?kind=fanfic' : ''}`} className="rounded-full border border-[#ded6e9] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#55466f] hover:border-brand">{label} ↗</Link>)}
          </div>
        </div>
      </section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold sm:text-2xl">
            {session ? `${x.hello}, ${session.name}` : t(l, 'brand')}
          </h2>
          <p className="mt-1 text-sm muted">{x.freshSub}</p>
        </div>
        <Link href={`/${l}/catalog`} className="btn btn-primary">{x.allCatalog} →</Link>
      </div>

      {cont ? (
        <Link
          href={`/${l}/read/${cont.chapter_id}`}
          className="card mb-8 flex items-center gap-4 p-4 hover:border-brand"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand/20 text-lg">📖</span>
          <div className="min-w-0 flex-1">
            <div className="text-xs muted">{x.continueReading} · {cont.percent}%</div>
            <div className="line-clamp-1 font-semibold">
              {cont.work_title} — {cont.chapter_title || `${l === 'ru' ? 'Глава' : l === 'en' ? 'Chapter' : 'Glava'} ${cont.number}`}
            </div>
          </div>
          <span className="btn btn-primary">{x.continueBtn}</span>
        </Link>
      ) : null}

      <CategoryBlock
        title={`📚 ${x.books}`}
        recommendations={booksFresh as unknown as Card[]}
        top={booksTop as unknown as Card[]}
        lang={l}
        empty={x.empty}
        href={`/${l}/catalog`}
        accent="home-category-books"
        recLabel={x.recommendations}
        topLabel={x.top}
        browseAll={x.browseAll}
      />

      <CategoryBlock
        title={`✦ ${x.fanfics}`}
        recommendations={fanficFresh as unknown as Card[]}
        top={fanficTop as unknown as Card[]}
        lang={l}
        empty={x.empty}
        href={`/${l}/catalog?kind=fanfic`}
        accent="home-category-fanfics"
        recLabel={x.recommendations}
        topLabel={x.top}
        browseAll={x.browseAll}
      />

      <CategoryBlock
        title={`▣ ${x.manga}`}
        recommendations={mangaFresh as unknown as Card[]}
        top={mangaTop as unknown as Card[]}
        lang={l}
        empty={x.empty}
        href={`/${l}/catalog?kind=comic`}
        accent="home-category-manga"
        recLabel={x.recommendations}
        topLabel={x.top}
        browseAll={x.browseAll}
      />
    </main>
  );
}
