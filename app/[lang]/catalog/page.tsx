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
};

type Genre = { id: number; slug: string; name_sr: string; name_en: string; name_ru: string };

function genreName(g: Genre, l: Lang) {
  return l === 'en' ? g.name_en : l === 'ru' ? g.name_ru : g.name_sr;
}

export default async function CatalogPage({
  params, searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string; genre?: string; type?: string; sort?: string }>;
}) {
  const { lang } = await params;
  const { q, genre, type, sort } = await searchParams;
  const l = (isLang(lang) ? lang : 'sr') as Lang;

  let works: WorkRow[] = [];
  let genres: Genre[] = [];
  try {
    [works, genres] = await Promise.all([
      listWorks({ q, genre, type, sort, limit: 36 }) as unknown as Promise<WorkRow[]>,
      listGenres() as unknown as Promise<Genre[]>,
    ]);
  } catch {
    works = [];
  }

  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (genre) p.set('genre', genre);
    if (type) p.set('type', type);
    if (sort) p.set('sort', sort);
    Object.entries(extra).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{t(l, 'catalog_title')}</h1>
        <span className="text-sm muted">{works.length} dela</span>
      </div>

      <form action={`/${l}/catalog`} className="mb-4 flex gap-2">
        {genre ? <input type="hidden" name="genre" value={genre} /> : null}
        {type ? <input type="hidden" name="type" value={type} /> : null}
        <input className="input" name="q" defaultValue={q || ''} placeholder={t(l, 'search_placeholder')} />
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

      <div className="mb-7 flex flex-wrap gap-2">
        <Link
          href={`/${l}/catalog${qs({ genre: '' })}`}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            !genre ? 'bg-brand text-white' : 'border border-line text-mist hover:text-ink'
          }`}
        >
          Sve
        </Link>
        {genres.map((g) => (
          <Link
            key={g.id}
            href={`/${l}/catalog${qs({ genre: g.slug })}`}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              genre === g.slug ? 'bg-brand text-white' : 'border border-line text-mist hover:text-ink'
            }`}
          >
            {genreName(g, l)}
          </Link>
        ))}
      </div>

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
              </div>
            </Link>
          ))}
        </div>
      )}

      <AdSlot slot="catalog_bottom" label="Reklama" />
    </main>
  );
}
