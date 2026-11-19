import { isLang, type Lang } from '@/lib/i18n';
import { listWorks, listGenres, progressByWork, countLibraryUpdates, type ListWorksOpts } from '@/lib/repo';
import { countFollowUpdates } from '@/lib/follows';
import { readSession } from '@/lib/auth';
import BookverseCatalog, { type CatalogWork, type SectionId, type CatalogFilter } from '@/components/bookverse/BookverseCatalog';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 24;

type Row = {
  id: number; slug: string; title: string; description: string;
  rating_avg: string; completion: string; author_name: string; cover_path: string | null;
  type?: string; kind?: string; category?: string; is_classic?: number;
};

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export default async function CatalogPage({
  params, searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang } = await params;
  const sp = await searchParams;
  const l = (isLang(lang) ? lang : 'sr') as Lang;

  // Состояние каталога живёт в URL (аудит, п.8): refresh и ссылки его сохраняют.
  const q = str(sp.q);
  const kind = str(sp.kind);
  const typeParam = str(sp.type);
  const genre = str(sp.genre);
  const source = str(sp.source);
  const tag = str(sp.tag);
  const fandom = str(sp.fandom);
  const rawFilter = str(sp.filter);
  const filter: CatalogFilter =
    rawFilter === 'popular' || rawFilter === 'fresh' || rawFilter === 'completed' ? rawFilter : 'forYou';
  const page = Math.max(1, Math.min(Number(str(sp.page)) || 1, 500));

  const section: SectionId =
    typeParam === 'manga' || kind === 'comic' || kind === 'manga' ? 'comics'
      : typeParam === 'fanfic' || kind === 'fanfic' ? 'fanfics'
        : 'books';

  // Сортировка и фильтры выполняются на сервере, а не по обрезанной выборке.
  const opts: ListWorksOpts = {
    q,
    limit: PAGE_SIZE + 1, // +1 — чтобы честно узнать, есть ли следующая страница
    offset: (page - 1) * PAGE_SIZE,
    // Popular — по прочтениям, Fresh — по дате, Completed — по оценке.
    // Раньше Popular сортировал по рейтингу: книга с тремя пятёрками
    // обгоняла ту, которую прочитали тысячи (review-2, P2).
    sort: filter === 'popular' ? 'views' : filter === 'fresh' ? 'new' : 'rating',
  };
  if (genre) opts.genre = genre;
  if (source) opts.source = source;
  if (tag) opts.tag = tag;
  if (fandom) opts.fandom = fandom;
  if (filter === 'completed') opts.completion = 'completed';
  if (section === 'comics') opts.type = 'comic';
  if (section === 'fanfics') opts.fanfic = true;
  if (section === 'books') opts.type = 'novel';

  let rows: Row[] = [];
  try {
    rows = (await listWorks(opts)) as unknown as Row[];
  } catch {
    rows = [];
  }

  // Состояние пользователя и прогресс — чтобы каталог не показывал «Guest»
  // залогиненному человеку и рисовал прогресс на карточках (аудит, п.24 и 28).
  const genresRaw = await listGenres().catch(() => []);
  const genres = genresRaw.map((g) => ({ slug: g.slug, name: l === 'ru' ? g.name_ru : l === 'en' ? g.name_en : g.name_sr }));
  const session = await readSession().catch(() => null);
  const progress = session ? await progressByWork(session.uid).catch(() => ({})) : {};
  const unread = session
    ? (await Promise.all([
        countLibraryUpdates(session.uid).catch(() => 0),
        countFollowUpdates(session.uid).catch(() => 0),
      ])).reduce((a, b) => a + b, 0)
    : 0;

  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  const items: CatalogWork[] = pageRows.map((w) => {
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
      cover: w.cover_path || null,
      tone: category === 'manga' ? 'orange' : category === 'fanfic' ? 'violet' : 'blue',
    };
  });

  return (
    <BookverseCatalog
      lang={l}
      works={items}
      genres={genres}
      initialQuery={q}
      initialSection={section}
      initialFilter={filter}
      page={page}
      hasMore={hasMore}
      genre={genre}
      source={source}
      tag={tag}
      fandom={fandom}
      user={session ? { name: session.name } : null}
      progress={progress}
      notifications={unread}
    />
  );
}
