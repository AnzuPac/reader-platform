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

  const isTestSlug = (slug: string) =>
    /^(edit-work-|ed-work-|st-work-|tr-work-|ead-work-)/.test(slug) || /-\d{13}$/.test(slug);

  const items: CatalogWork[] = works
    .filter((w) => !isTestSlug(w.slug))
    .map((w) => {
      const category: CatalogWork['category'] =
        w.kind === 'fanfic' ? 'fanfic' : w.type === 'comic' ? 'manga' : 'book';
      return {
        id: w.id,
        slug: w.slug,
        title: w.title,
        author: w.author_name,
        description: w.description || '',
        category,
        rating: Number(w.rating_avg) || 0,
        classic: Boolean(w.is_classic),
        completed: w.completion === 'completed',
        tone: category === 'manga' ? 'orange' : category === 'fanfic' ? 'violet' : 'blue',
      };
    });

  return <BookverseCatalog lang={l} works={items} initialQuery={q} initialSection={initialSection} />;
}
