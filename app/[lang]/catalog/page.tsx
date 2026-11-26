import { isLang, type Lang } from '@/lib/i18n';
import { listWorks, listGenres, listTopWorks, listTags, progressByWork, countLibraryUpdates, type ListWorksOpts } from '@/lib/repo';
import { countFollowUpdates } from '@/lib/follows';
import { readSession } from '@/lib/auth';
import BookverseCatalog, { type CatalogWork, type SectionId, type CatalogFilter } from '@/components/bookverse/BookverseCatalog';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 24;

type Row = {
  id: number; slug: string; title: string; description: string;
  rating_avg: string; completion: string; author_name: string; cover_path: string | null;
  type?: string; kind?: string; category?: string; is_classic?: number; ai_usage?: 'not_declared'|'no_ai'|'assisted'|'generated';
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
  const workLang = str(sp.language);
  const tag = str(sp.tag);
  const fandom = str(sp.fandom);
  const comicFormat = str(sp.gfmt);
  const colorMode = str(sp.gcolor);
  const readingDirection = str(sp.gdir);
  const demographic = str(sp.gdemo);
  const free = str(sp.free) === '1';
  const listOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? v.split(',') : []).map((x) => x.trim()).filter(Boolean);
  const includeTags = listOf(sp.include);
  const excludeTags = listOf(sp.exclude);
  const includeMode = str(sp.includeMode) === 'any' ? 'any' as const : 'all' as const;
  const aiRawList = listOf(sp.ai);
  const aiUsages = aiRawList.filter((v): v is 'used' | 'no_ai' | 'not_declared' | 'assisted' | 'generated' =>
    ['used', 'no_ai', 'not_declared', 'assisted', 'generated'].includes(v));
  const rawFilter = str(sp.filter);
  const filter: CatalogFilter =
    rawFilter === 'popular' || rawFilter === 'fresh' || rawFilter === 'completed' ? rawFilter : 'forYou';
  const page = Math.max(1, Math.min(Number(str(sp.page)) || 1, 500));

  const section: SectionId =
    kind === 'top' || typeParam === 'top' ? 'top'
      : typeParam === 'manga' || kind === 'comic' || kind === 'manga' ? 'comics'
        : typeParam === 'fanfic' || kind === 'fanfic' ? 'fanfics'
          : 'books';
  const bookSource = kind === 'selfpub' || typeParam === 'selfpub' ? 'selfpub'
    : kind === 'publisher' ? 'publisher'
      : source;

  const periodRaw = str(sp.period);
  const period = periodRaw === 'year' || periodRaw === 'month' || periodRaw === 'week' ? periodRaw : 'all';

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
  // Книги — только издательские; самиздат — только авторский. Источник из URL
  // не должен «размывать» вкладку, поэтому задаётся разделом.
  if (section === 'books') {
    if (bookSource) opts.source = bookSource;
  } else if (source) opts.source = source;
  if (includeTags.length) { opts.includeTags = includeTags; opts.includeMode = includeMode; }
  if (excludeTags.length) opts.excludeTags = excludeTags;
  if (tag) opts.tag = tag;
  if (fandom) opts.fandom = fandom;
  if (aiUsages.length) opts.aiUsages = aiUsages;
  if (comicFormat) opts.comicFormat = comicFormat;
  if (colorMode) opts.colorMode = colorMode;
  if (readingDirection) opts.readingDirection = readingDirection;
  if (demographic) opts.demographic = demographic;
  if (free) opts.free = true;
  if (filter === 'completed') opts.completion = 'completed';
  if (section === 'comics') opts.type = 'comic';
  if (section === 'fanfics') opts.fanfic = true;
  if (section === 'books') opts.type = 'novel';
  if (workLang === 'sr' || workLang === 'ru' || workLang === 'en') opts.language = workLang;

  let rows: Row[] = [];
  if (section !== 'top') {
    try {
      rows = (await listWorks(opts)) as unknown as Row[];
    } catch {
      rows = [];
    }
  }

  // Состояние пользователя и прогресс — чтобы каталог не показывал «Guest»
  // залогиненному человеку и рисовал прогресс на карточках (аудит, п.24 и 28).
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
      aiUsage: w.ai_usage || 'not_declared',
      completed: w.completion === 'completed',
      cover: w.cover_path || null,
      tone: category === 'manga' ? 'orange' : category === 'fanfic' ? 'purple' : 'blue',
    };
  });

  // Топ по периодам: четыре категории, одна выборка на каждую.
  const toCards = (list: Awaited<ReturnType<typeof listTopWorks>>): CatalogWork[] => list.map((w) => {
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
      aiUsage: w.ai_usage || 'not_declared',
      completed: w.completion === 'completed',
      cover: w.cover_path || null,
      tone: category === 'manga' ? 'orange' : category === 'fanfic' ? 'purple' : 'blue',
    };
  });

  const tops = section === 'top'
    ? {
        publisher: toCards(await listTopWorks({ period, category: 'publisher', limit: 10 }).catch(() => [])),
        selfpub: toCards(await listTopWorks({ period, category: 'selfpub', limit: 10 }).catch(() => [])),
        fanfic: toCards(await listTopWorks({ period, category: 'fanfic', limit: 10 }).catch(() => [])),
        graphic: toCards(await listTopWorks({ period, category: 'graphic', limit: 10 }).catch(() => [])),
      }
    : undefined;

  const genresRaw = await listGenres().catch(() => []);
  const tags = (await listTags().catch(() => [])).map((t) => ({ slug: t.slug, name: t.name, count: t.count, kind: t.kind, group: t.group }));
  const genres = genresRaw.map((g) => ({ slug: g.slug, name: l === 'ru' ? g.name_ru : l === 'en' ? g.name_en : g.name_sr }));

  return (
    <BookverseCatalog
      lang={l}
      works={items}
      initialQuery={q}
      initialSection={section}
      initialFilter={filter}
      page={page}
      hasMore={hasMore}
      genre={genre}
      source={bookSource}
      language={workLang}
      tag={tag}
      fandom={fandom}
      aiUsages={aiUsages}
      includeTags={includeTags}
      excludeTags={excludeTags}
      includeMode={includeMode}
      comicFormat={comicFormat}
      colorMode={colorMode}
      readingDirection={readingDirection}
      demographic={demographic}
      free={free}
      genres={genres}
      tags={tags}
      tops={tops}
      period={period}
    />
  );
}
