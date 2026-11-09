import Link from 'next/link';
import { isLang, t, type Lang } from '@/lib/i18n';
import { listWorks, getContinueReading } from '@/lib/repo';
import { readSession } from '@/lib/auth';
import AdSlot from '@/components/AdSlot';

export const dynamic = 'force-dynamic';

type WorkRow = {
  id: number; slug: string; title: string; description: string;
  rating_avg: string; words_total: number; views_total: number;
  age_rating: number; completion: string; author_name: string;
};

function Cover({ work, size = 'cover-sm' }: { work: WorkRow; size?: string }) {
  return (
    <div className={`cover ${size}`}>
      <span className="absolute left-0 top-0 h-full w-full bg-black/10" />
      <span className="relative line-clamp-3">{work.title}</span>
    </div>
  );
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;

  let works: WorkRow[] = [];
  try {
    works = (await listWorks({ limit: 12 })) as unknown as WorkRow[];
  } catch {
    works = [];
  }
  const session = await readSession();
  const cont = session ? await getContinueReading(session.uid) : null;
  const popular = works.slice(0, 3);
  const fresh = works.slice(3, 12);

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      {/* hero */}
      <section className="mb-10 overflow-hidden rounded-2xl border border-[#3a2c56] bg-gradient-to-br from-[#1b1330] via-[#2d1a4d] to-[#3a1f5c] px-7 py-10 text-white sm:px-10 sm:py-14">
        <div className="max-w-xl">
          <h1 className="mb-3 text-3xl font-extrabold leading-tight sm:text-4xl">{t(l, 'hero_title')}</h1>
          <p className="mb-6 text-sm leading-relaxed text-white/80 sm:text-base">{t(l, 'hero_sub')}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/${l}/catalog`} className="btn bg-white text-[#2d1a4d] hover:bg-white/90">
              {t(l, 'cta_read')}
            </Link>
            <Link href={`/${l}/subscribe`} className="btn border border-white/40 text-white hover:bg-white/10">
              Pretplata
            </Link>
          </div>
        </div>
      </section>

      {cont ? (
        <section className="mb-8">
          <Link href={`/${l}/read/${cont.chapter_id}`} className="card flex items-center gap-4 p-4 transition hover:border-brand">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand/20 text-xl">📖</span>
            <div className="min-w-0 flex-1">
              <div className="text-xs muted">Nastavi čitanje · {cont.percent}%</div>
              <div className="line-clamp-1 font-semibold">{cont.work_title} — {cont.chapter_title || `Glava ${cont.number}`}</div>
            </div>
            <span className="btn btn-primary">Nastavi</span>
          </Link>
        </section>
      ) : null}

      {/* popular */}
      <section className="mb-10">
        <div className="section-title">
          <span className="text-hot">🔥</span> Popularno
          <Link href={`/${l}/catalog`} className="ml-auto text-sm font-medium text-brand">Sve →</Link>
        </div>
        {popular.length === 0 ? (
          <p className="muted">{t(l, 'catalog_empty')}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {popular.map((w, i) => (
              <Link key={w.id} href={`/${l}/work/${w.slug}`} className="card overflow-hidden transition hover:shadow-md">
                <div className="relative">
                  <Cover work={w} size="cover-lg" />
                  <span className="badge-rank">#{i + 1}</span>
                </div>
                <div className="p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-semibold">{w.title}</span>
                    {w.completion === 'completed' ? <span className="badge-hot">Završeno</span> : null}
                  </div>
                  <div className="text-xs muted">{w.author_name} · ★ {w.rating_avg}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* new */}
      <section>
        <div className="section-title">
          ✨ Novo
          <Link href={`/${l}/catalog`} className="ml-auto text-sm font-medium text-brand">Sve →</Link>
        </div>
        {fresh.length === 0 && popular.length === 0 ? (
          <p className="muted">{t(l, 'catalog_empty')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {(fresh.length ? fresh : popular).map((w) => (
              <Link key={w.id} href={`/${l}/work/${w.slug}`} className="group">
                <Cover work={w} size="cover-sm" />
                <div className="mt-2 line-clamp-1 text-sm font-semibold group-hover:text-brand">{w.title}</div>
                <div className="text-xs muted">{w.author_name}</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <AdSlot slot="catalog_bottom" label="Reklama" />
    </main>
  );
}
