import Link from 'next/link';
import { isLang, t, type Lang } from '@/lib/i18n';
import { listWorks } from '@/lib/repo';
import AdSlot from '@/components/AdSlot';

export const dynamic = 'force-dynamic';

type WorkRow = {
  id: number; slug: string; title: string; description: string;
  rating_avg: string; words_total: number; views_total: number;
  age_rating: number; completion: string; author_name: string;
};

export default async function CatalogPage({
  params, searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { lang } = await params;
  const { q } = await searchParams;
  const l = (isLang(lang) ? lang : 'sr') as Lang;

  let works: WorkRow[] = [];
  try {
    works = (await listWorks({ q, limit: 36 })) as unknown as WorkRow[];
  } catch {
    works = [];
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{t(l, 'catalog_title')}</h1>
        <span className="text-sm muted">{works.length} dela</span>
      </div>

      <form action={`/${l}/catalog`} className="mb-6 flex gap-2">
        <input className="input" name="q" defaultValue={q || ''} placeholder={t(l, 'search_placeholder')} />
        <button className="btn btn-primary">Traži</button>
      </form>

      {works.length === 0 ? (
        <div className="card p-8 text-center muted">{t(l, 'catalog_empty')}</div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {works.map((w, i) => (
            <Link key={w.id} href={`/${l}/work/${w.slug}`} className="group">
              <div className="cover cover-sm relative">
                <span className="absolute left-0 top-0 h-full w-full bg-black/10" />
                <span className="relative line-clamp-3">{w.title}</span>
                {i < 3 ? <span className="badge-rank">TOP {i + 1}</span> : null}
              </div>
              <div className="mt-2 flex items-start gap-1">
                <span className="line-clamp-1 flex-1 text-sm font-semibold group-hover:text-brand">{w.title}</span>
                {w.age_rating ? <span className="badge-hot">{w.age_rating}+</span> : null}
              </div>
              <div className="line-clamp-1 text-xs muted">{w.author_name}</div>
              <div className="mt-1 flex items-center gap-2 text-xs muted">
                <span>★ {w.rating_avg}</span>
                <span>{w.words_total} reči</span>
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
