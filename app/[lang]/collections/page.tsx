import Link from 'next/link';
import { isLang, type Lang } from '@/lib/i18n';
import { readSession } from '@/lib/auth';
import { ensureSystemCollections, listCollections } from '@/lib/collections';
import NewCollectionForm from '@/components/NewCollectionForm';

export const dynamic = 'force-dynamic';

const TXT: Record<Lang, {
  title: string; system: string; editorial: string; mine: string; empty: string;
  items: string; loginHint: string; publicLabel: string; privateLabel: string;
}> = {
  sr: { title: 'Kolekcije', system: 'Preporučujemo', editorial: 'Izbor urednika', mine: 'Moje kolekcije', empty: 'Još nema kolekcija.', items: 'dela', loginHint: 'Prijavi se da napraviš svoju kolekciju.', publicLabel: 'javna', privateLabel: 'privatna' },
  ru: { title: 'Подборки', system: 'Рекомендуем', editorial: 'Выбор редакции', mine: 'Мои подборки', empty: 'Подборок пока нет.', items: 'произведений', loginHint: 'Войди, чтобы создать свою подборку.', publicLabel: 'публичная', privateLabel: 'приватная' },
  en: { title: 'Collections', system: 'Recommended', editorial: 'Editor’s choice', mine: 'My collections', empty: 'No collections yet.', items: 'works', loginHint: 'Sign in to create your own collection.', publicLabel: 'public', privateLabel: 'private' },
};

function Cards({ items, lang, t }: {
  items: Awaited<ReturnType<typeof listCollections>>;
  lang: Lang;
  t: (typeof TXT)[Lang];
}) {
  if (items.length === 0) return <div className="card p-6 text-center text-sm muted">{t.empty}</div>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((c) => (
        <Link key={c.id} href={`/${lang}/collections/${c.slug}`} className="card p-4 hover:border-brand">
          <div className="mb-1 flex items-center gap-2">
            <strong className="line-clamp-1">{c.title}</strong>
            {c.kind === 'user' ? (
              <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] text-brand">
                {(c.is_public === 1 || c.is_public === true) ? t.publicLabel : t.privateLabel}
              </span>
            ) : null}
          </div>
          {c.description ? <p className="line-clamp-2 text-xs muted">{c.description}</p> : null}
          <div className="mt-2 text-xs muted">{Number(c.items_count || 0)} {t.items}</div>
        </Link>
      ))}
    </div>
  );
}

export default async function CollectionsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const t = TXT[l];

  const session = await readSession();
  await ensureSystemCollections();

  const all = await listCollections(session ? { uid: session.uid, role: session.role } : null);
  const system = all.filter((c) => c.kind === 'system');
  const editorial = all.filter((c) => c.kind === 'editorial');
  const mine = session ? all.filter((c) => c.kind === 'user' && c.owner_id === session.uid) : [];

  return (
    <main id="main" className="tl-screen tl-screen--collections mx-auto max-w-6xl px-5 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t.title}</h1>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">{t.system}</h2>
        <Cards items={system} lang={l} t={t} />
      </section>

      {editorial.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">{t.editorial}</h2>
          <Cards items={editorial} lang={l} t={t} />
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t.mine}</h2>
        {session ? (
          <div className="space-y-4">
            <NewCollectionForm lang={l} />
            <Cards items={mine} lang={l} t={t} />
          </div>
        ) : (
          <div className="card p-6 text-center text-sm muted">
            <Link href={`/${l}/login`} className="text-brand hover:underline">{t.loginHint}</Link>
          </div>
        )}
      </section>
    </main>
  );
}
