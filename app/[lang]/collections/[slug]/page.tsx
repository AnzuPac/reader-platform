import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLang, type Lang } from '@/lib/i18n';
import { readSession } from '@/lib/auth';
import { getCollectionBySlug } from '@/lib/collections';
import CollectionItemControls from '@/components/CollectionItemControls';

export const dynamic = 'force-dynamic';

const TXT: Record<Lang, { back: string; empty: string; edit: string }> = {
  sr: { back: '← Kolekcije', empty: 'U ovoj kolekciji još nema dela.', edit: 'Uredi' },
  ru: { back: '← Подборки', empty: 'В этой подборке пока нет произведений.', edit: 'Изменить' },
  en: { back: '← Collections', empty: 'No works in this collection yet.', edit: 'Edit' },
};

export default async function CollectionPage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const t = TXT[l];

  const session = await readSession();
  const data = await getCollectionBySlug(slug, session ? { uid: session.uid, role: session.role } : null);
  if (!data) notFound();

  const { collection, items, canEdit } = data;

  return (
    <main id="main" className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-2">
        <Link href={`/${l}/collections`} className="text-sm muted hover:text-brand">{t.back}</Link>
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{collection.title}</h1>
          {collection.description ? <p className="mt-1 text-sm muted">{collection.description}</p> : null}
        </div>
        <span className="text-xs muted">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="card p-8 text-center muted">{t.empty}</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((w) => (
            <div key={w.id} className="group">
              <Link href={`/${l}/work/${w.slug}`}>
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
              {canEdit ? <CollectionItemControls collectionId={collection.id} workId={w.id} lang={l} /> : null}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
