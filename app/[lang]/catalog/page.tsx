import { isLang, type Lang } from '@/lib/i18n';
import { listWorks } from '@/lib/repo';
import BookverseCatalog, { type CatalogWork, type SectionId } from '@/components/bookverse/BookverseCatalog';

export const dynamic = 'force-dynamic';

type Row = {
  id: number; slug: string; title: string; description: string;
  rating_avg: string; completion: string; author_name: string;
  type?: string; kind?: string; category?: string; is_classic?: number;
};

export default async function CatalogPage({
  params, searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string; kind?: string; type?: string; source?: string }>;
}) {
  const { lang } = await params;
  const sp = await searchParams;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const q = typeof sp.q === 'string' ? sp.q : '';
  const kind = typeof sp.kind === 'string' ? sp.kind : '';

  const initialSection: SectionId =
    kind === 'fanfic' ? 'fanfics' : kind === 'comic' || kind === 'manga' ? 'comics' : 'books';

  let works: Row[] = [];
  try {
    works = (await listWorks({ q, limit: 120, sort: 'new' })) as unknown as Row[];
  } catch {
    works = [];
  }

  const items: CatalogWork[] = works.map((w) => {
    const category: CatalogWork['category'] =
      w.kind === 'fanfic' ? 'fanfic' : w.type === 'comic' ? 'manga' : 'book';
    return {
      id: w.id,
      slug: w.slug,
      title: w.title,
      author: w.author_name,
      description: w.description || '',
      category,
      genre: category === 'manga' ? 'Манга · стрип' : category === 'fanfic' ? 'Фанфик' : 'Књига',
      badge: w.is_classic ? 'Класика' : w.completion === 'completed' ? 'Завршено' : undefined,
      rating: Number(w.rating_avg) || 0,
      completion: w.completion,
      tone: category === 'manga' ? 'orange' : category === 'fanfic' ? 'violet' : 'blue',
    };
  });

  return <BookverseCatalog lang={l} works={items} initialQuery={q} initialSection={initialSection} />;
}
