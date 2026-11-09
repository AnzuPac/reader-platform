import Link from 'next/link';
import { isLang, t, type Lang } from '@/lib/i18n';
import { listWorks } from '@/lib/repo';
import AdSlot from '@/components/AdSlot';

export const dynamic = 'force-dynamic';

export default async function CatalogPage({
  params, searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { lang } = await params;
  const { q } = await searchParams;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const works = await listWorks({ q });

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="mb-6 text-3xl font-bold">{t(l, 'catalog_title')}</h1>
      <form className="mb-8 flex gap-3" action={`/${l}/catalog`}>
        <input className="input" name="q" defaultValue={q || ''} placeholder={t(l, 'search_placeholder')} />
        <button className="btn btn-ghost">🔍</button>
      </form>

      {works.length === 0 ? (
        <p className="muted">{t(l, 'catalog_empty')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {works.map((w) => (
            <Link key={w.id} href={`/${l}/work/${w.slug}`} className="card p-4 transition hover:border-violet/60">
              <div className="mb-1 flex items-start justify-between gap-2">
                <span className="font-semibold">{w.title}</span>
                {w.age_rating ? <span className="rounded bg-sakura/20 px-2 py-0.5 text-xs text-sakura">{w.age_rating}+</span> : null}
              </div>
              <div className="mb-2 text-xs muted">{w.author_name} · {w.completion === 'completed' ? '✔' : '…'}</div>
              <p className="line-clamp-3 text-sm muted">{w.description}</p>
            </Link>
          ))}
        </div>
      )}
      <AdSlot slot="catalog_bottom" />
    </main>
  );
}
