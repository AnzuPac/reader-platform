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
}> = {
  sr: {
    hello: 'Dobro došli nazad', continueReading: 'Nastavi čitanje', continueBtn: 'Nastavi',
    fresh: 'Novo na platformi', freshSub: 'Sveže objavljeno — prvo poglavlje obično besplatno',
    popular: 'Najčitanije', popularSub: 'Ono što čitaoci najviše otvaraju',
    allCatalog: 'Ceo katalog', books: 'Knjige', comics: 'Stripovi', fanfics: 'Fanfikcija',
    empty: 'Još nema objavljenih dela u ovom izboru.',
  },
  ru: {
    hello: 'С возвращением', continueReading: 'Продолжить чтение', continueBtn: 'Дальше',
    fresh: 'Новое на платформе', freshSub: 'Свежие публикации — первая глава обычно бесплатна',
    popular: 'Самое читаемое', popularSub: 'То, что читатели открывают чаще всего',
    allCatalog: 'Весь каталог', books: 'Книги', comics: 'Комиксы', fanfics: 'Фанфики',
    empty: 'В этой подборке пока нет опубликованных произведений.',
  },
  en: {
    hello: 'Welcome back', continueReading: 'Continue reading', continueBtn: 'Continue',
    fresh: 'New on the platform', freshSub: 'Freshly published — the first chapter is usually free',
    popular: 'Most read', popularSub: 'What readers open the most',
    allCatalog: 'Full catalog', books: 'Books', comics: 'Comics', fanfics: 'Fan fiction',
    empty: 'No published works in this selection yet.',
  },
};

function Grid({ items, lang, empty }: { items: Card[]; lang: Lang; empty: string }) {
  if (items.length === 0) return <div className="card p-6 text-center text-sm muted">{empty}</div>;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((w) => (
        <Link key={w.id} href={`/${lang}/work/${w.slug}`} className="group">
          <div className="cover cover-sm relative overflow-hidden">
            {w.cover_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={w.cover_path} alt={w.title} loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <span className="relative line-clamp-3">{w.title}</span>
            )}
          </div>
          <div className="mt-2 line-clamp-1 text-sm font-semibold group-hover:text-brand">{w.title}</div>
          <div className="text-xs muted">{w.author_name}</div>
        </Link>
      ))}
    </div>
  );
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const x = TXT[l];

  const session = await readSession();
  const cont = session ? await getContinueReading(session.uid).catch(() => null) : null;

  const [fresh, popular, comics, fanfics] = await Promise.all([
    listWorks({ sort: 'new', limit: 8 }).catch(() => []),
    listWorks({ sort: 'views', limit: 8 }).catch(() => []),
    listWorks({ type: 'comic', sort: 'new', limit: 4 }).catch(() => []),
    listWorks({ fanfic: true, sort: 'new', limit: 4 }).catch(() => []),
  ]);

  return (
    <main id="main" className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">
            {session ? `${x.hello}, ${session.name}` : t(l, 'brand')}
          </h1>
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

      <section className="mb-10">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{x.fresh}</h2>
            <p className="text-xs muted">{x.freshSub}</p>
          </div>
          <Link href={`/${l}/catalog?filter=fresh`} className="text-sm text-brand hover:underline">→</Link>
        </div>
        <Grid items={fresh as unknown as Card[]} lang={l} empty={x.empty} />
      </section>

      <section className="mb-10">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{x.popular}</h2>
            <p className="text-xs muted">{x.popularSub}</p>
          </div>
          <Link href={`/${l}/catalog?filter=popular`} className="text-sm text-brand hover:underline">→</Link>
        </div>
        <Grid items={popular as unknown as Card[]} lang={l} empty={x.empty} />
      </section>

      {comics.length > 0 ? (
        <section className="mb-10">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="text-xl font-bold">{x.comics}</h2>
            <Link href={`/${l}/catalog?kind=comic`} className="text-sm text-brand hover:underline">→</Link>
          </div>
          <Grid items={comics as unknown as Card[]} lang={l} empty={x.empty} />
        </section>
      ) : null}

      {fanfics.length > 0 ? (
        <section className="mb-10">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="text-xl font-bold">{x.fanfics}</h2>
            <Link href={`/${l}/catalog?kind=fanfic`} className="text-sm text-brand hover:underline">→</Link>
          </div>
          <Grid items={fanfics as unknown as Card[]} lang={l} empty={x.empty} />
        </section>
      ) : null}
    </main>
  );
}
