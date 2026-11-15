import Link from 'next/link';
import { isLang, t, type Lang } from '@/lib/i18n';
import { listWorks, listGenres } from '@/lib/repo';
import AdSlot from '@/components/AdSlot';
import { WorkCover } from '@/lib/cover';

export const dynamic = 'force-dynamic';

type WorkRow = {
  id: number; slug: string; title: string; description: string;
  rating_avg: string; words_total: number; views_total: number;
  age_rating: number; completion: string; author_name: string; cover_path: string | null;
  kind?: string; is_classic?: number; publisher_id?: number | null;
};

type Genre = { id: number; slug: string; name_sr: string; name_en: string; name_ru: string };

function genreName(g: Genre, l: Lang) {
  return l === 'en' ? g.name_en : l === 'ru' ? g.name_ru : g.name_sr;
}

const SOURCES = [
  { key: '', label: 'Sve' },
  { key: 'publisher', label: 'Izdavačko' },
  { key: 'selfpub', label: 'Samizdat' },
  { key: 'fanfic', label: 'Fanfik' },
  { key: 'classic', label: 'Klasika' },
];

export default async function CatalogPage({
  params, searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{
    q?: string; genre?: string; type?: string; sort?: string; source?: string;
    free?: string; sub?: string; done?: string; tag?: string; without?: string;
  }>;
}) {
  const { lang } = await params;
  const sp = await searchParams;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const q = sp.q;
  const genre = sp.genre;
  const type = sp.type;
  const sort = sp.sort;
  const source = sp.source;
  const free = sp.free === '1';
  const subscribed = sp.sub === '1';
  const completed = sp.done === '1';
  const tag = sp.tag;
  const without = sp.without;

  let works: WorkRow[] = [];
  let genres: Genre[] = [];
  try {
    [works, genres] = await Promise.all([
      listWorks({
        q, genre, type, sort, source, free, subscribed, tag,
        completion: completed ? 'completed' : undefined,
        excludeTags: without ? without.split(',') : [],
        limit: 36,
      }) as unknown as Promise<WorkRow[]>,
      listGenres() as unknown as Promise<Genre[]>,
    ]);
  } catch {
    works = [];
  }

  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | undefined> = {
      q, genre, type, sort, source, tag, without,
      free: free ? '1' : undefined,
      sub: subscribed ? '1' : undefined,
      done: completed ? '1' : undefined,
    };
    Object.entries({ ...base, ...extra }).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-semibold ${
      active ? 'bg-brand text-white' : 'border border-line text-mist hover:text-ink'
    }`;

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{t(l, 'catalog_title')}</h1>
        <span className="text-sm muted">{works.length} dela</span>
      </div>

      <form action={`/${l}/catalog`} className="mb-4 flex flex-wrap gap-2">
        {genre ? <input type="hidden" name="genre" value={genre} /> : null}
        {type ? <input type="hidden" name="type" value={type} /> : null}
        {source ? <input type="hidden" name="source" value={source} /> : null}
        <input
          className="input flex-1"
          name="q"
          defaultValue={q || ''}
          placeholder={t(l, 'search_placeholder')}
          aria-label={t(l, 'search_placeholder')}
        />
        <button className="btn btn-primary">Traži</button>
      </form>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs muted">Sortiraj:</span>
        {[
          { key: 'new', label: 'Novo' },
          { key: 'rating', label: 'Ocena' },
          { key: 'views', label: 'Čitanost' },
          { key: 'words', label: 'Dužina' },
        ].map((s2) => (
          <Link key={s2.key} href={`/${l}/catalog${qs({ sort: s2.key })}`}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${(sort || 'new') === s2.key ? 'bg-brand text-white' : 'border border-line text-mist hover:text-ink'}`}>
            {s2.label}
          </Link>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {SOURCES.map((s2) => (
          <Link key={s2.key || 'all'} href={`/${l}/catalog${qs({ source: s2.key })}`}
            className={chip((source || '') === s2.key)}>
            {s2.label}
          </Link>
        ))}
        <span className="mx-1 w-px self-stretch bg-[#2c2340]" />
        <Link href={`/${l}/catalog${qs({ free: free ? '' : '1' })}`} className={chip(free)}>
          Besplatno
        </Link>
        <Link href={`/${l}/catalog${qs({ sub: subscribed ? '' : '1' })}`} className={chip(subscribed)}>
          U pretplati
        </Link>
        <Link href={`/${l}/catalog${qs({ done: completed ? '' : '1' })}`} className={chip(completed)}>
          Završeno
        </Link>
      </div>

      <div className="mb-3 flex gap-2">
        {[
          { key: '', label: 'Sve' },
          { key: 'novel', label: 'Romani' },
          { key: 'comic', label: 'Stripovi' },
        ].map((tab) => (
          <Link
            key={tab.key || 'all'}
            href={`/${l}/catalog${qs({ type: tab.key })}`}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              (type || '') === tab.key ? 'bg-hot text-white' : 'border border-line text-mist hover:text-ink'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={`/${l}/catalog${qs({ genre: '' })}`} className={chip(!genre)}>
          Sve
        </Link>
        {genres.map((g) => (
          <Link key={g.id} href={`/${l}/catalog${qs({ genre: g.slug })}`} className={chip(genre === g.slug)}>
            {genreName(g, l)}
          </Link>
        ))}
      </div>

      <details className="card mb-6 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-semibold">Filteri: tagovi</summary>
        <form action={`/${l}/catalog`} className="mt-3 flex flex-wrap items-end gap-3">
          {q ? <input type="hidden" name="q" value={q} /> : null}
          {source ? <input type="hidden" name="source" value={source} /> : null}
          {genre ? <input type="hidden" name="genre" value={genre} /> : null}
          <label className="flex-1 text-xs muted">
            Tag
            <input className="input mt-1" name="tag" defaultValue={tag || ''} placeholder="npr. horor" />
          </label>
          <label className="flex-1 text-xs muted">
            Bez tagova (kroz zapetu)
            <input className="input mt-1" name="without" defaultValue={without || ''} placeholder="npr. horor,romantika" />
          </label>
          <button className="btn btn-ghost">Primeni</button>
        </form>
      </details>

      {works.length === 0 ? (
        <div className="card p-8 text-center muted">{t(l, 'catalog_empty')}</div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {works.map((w, i) => (
            <Link key={w.id} href={`/${l}/work/${w.slug}`} className="group">
              <div className="relative">
                <WorkCover title={w.title} cover={w.cover_path} />
                {i < 3 ? <span className="badge-rank">TOP {i + 1}</span> : null}
              </div>
              <div className="mt-2 flex items-start gap-1">
                <span className="line-clamp-1 flex-1 text-sm font-semibold group-hover:text-brand">{w.title}</span>
                {w.age_rating ? <span className="badge-hot">{w.age_rating}+</span> : null}
              </div>
              <div className="line-clamp-1 text-xs muted">{w.author_name}</div>
              <div className="mt-1 flex items-center gap-2 text-xs muted">
                <span>★ {w.rating_avg}</span>
                <span>{w.words_total}</span>
                {w.completion === 'completed' ? <span className="text-brand">Završeno</span> : null}
                {w.kind === 'fanfic' ? <span className="text-violet">Fanfik</span> : null}
                {Number(w.is_classic) ? <span className="text-mist">Klasika</span> : null}
              </div>
            </Link>
          ))}
        </div>
      )}

      <AdSlot slot="catalog_bottom" label="Reklama" />
    </main>
  );
}
