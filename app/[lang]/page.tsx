import Link from 'next/link';
import { isLang, t, type Lang } from '@/lib/i18n';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

type WorkRow = { id: number; slug: string; title: string; description: string; rating_avg: string; words_total: number };

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;

  let works: WorkRow[] = [];
  try {
    works = await query<WorkRow>(
      `SELECT id, slug, title, description, rating_avg, words_total
         FROM works WHERE status = 'published' ORDER BY published_at DESC NULLS LAST LIMIT 12`
    );
  } catch {
    works = [];
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-14">
      <section className="mb-14">
        <h1 className="mb-3 text-4xl font-bold tracking-tight md:text-5xl">{t(l, 'hero_title')}</h1>
        <p className="mb-6 max-w-2xl text-lg muted">{t(l, 'hero_sub')}</p>
        <Link href={`/${l}/catalog`} className="btn btn-primary">{t(l, 'cta_read')}</Link>
      </section>

      <h2 className="mb-5 text-2xl font-semibold">{t(l, 'catalog_title')}</h2>
      {works.length === 0 ? (
        <p className="muted">{t(l, 'catalog_empty')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {works.map((w) => (
            <Link key={w.id} href={`/${l}/work/${w.slug}`} className="card p-4 transition hover:border-violet/60">
              <div className="mb-1 font-semibold">{w.title}</div>
              <div className="line-clamp-3 text-sm muted">{w.description}</div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
