'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Lang } from '@/lib/i18n';

export type SectionId = 'books' | 'selfpub' | 'fanfics' | 'comics' | 'top';
export type CatalogFilter = 'forYou' | 'popular' | 'fresh' | 'completed';

export type CatalogWork = {
  id: number;
  slug: string;
  title: string;
  author: string;
  description: string;
  category: 'book' | 'fanfic' | 'manga';
  rating: number;
  classic?: boolean;
  aiUsage?: string;
  completed?: boolean;
  cover?: string | null;
  tone?: string;
};

export type CatalogGenre = { slug: string; name: string };

const SECTION_KIND: Record<SectionId, string> = { books: '', selfpub: 'selfpub', fanfics: 'fanfic', comics: 'comic', top: 'top' };
const SECTION_COLOR: Record<SectionId, string> = { books: 'publisher', selfpub: 'selfpub', fanfics: 'fanfic', comics: 'graphic', top: 'top' };

const TXT: Record<Lang, {
  books: string; selfpub: string; fanfics: string; manga: string;
  titles: Record<SectionId, string>; eyebrows: Record<SectionId, string>; descs: Record<SectionId, string>;
  filters: string; all: string; popular: string; fresh: string; completed: string; rated: string;
  sort: string; sortRecommend: string; sortPopular: string; sortNew: string; sortRating: string;
  apply: string; reset: string; genre: string; tags: string; fandom: string; source: string; ai: string;
  anyAi: string; noAi: string; assisted: string; generated: string;
  noAiShort: string; aiYes: string; aiUnknown: string;
  sourcePublisher: string; sourceSelf: string; sourceClassic: string;
  count: (n: number) => string; prev: string; next: string; empty: string;
  activeFilters: string; remove: string; tagPlaceholder: string; fandomPlaceholder: string;
  topTab: string; topDesc: string; periods: Record<'all'|'year'|'month'|'week', string>;
}> = {
  sr: {
    books: 'Knjige', selfpub: 'Samizdat', fanfics: 'Fanfikcija', manga: 'Grafička literatura',
    titles: { books: 'Knjige', selfpub: 'Samizdat', fanfics: 'Fanfikcija', comics: 'Grafička literatura', top: 'Top' },
    eyebrows: { books: 'TEROLIBRARY · PUBLISHERS', selfpub: 'TEROLIBRARY · SELF-PUBLISHED', fanfics: 'TEROLIBRARY · FANFICTION', comics: 'TEROLIBRARY · GRAPHIC LITERATURE', top: 'TEROLIBRARY · TOP' },
    descs: { books: 'Knjige izdavača i samizdat.', selfpub: 'Dela koja autori objavljuju sami.', fanfics: 'Fandomi, AU, likovi i priče zajednice.', comics: 'Manga, manhva, vebtuni i stripovi.', top: 'Najčitanije po periodu.' },
    filters: 'Filteri', all: 'Sve', popular: 'Popularno', fresh: 'Novo', completed: 'Završeno', rated: 'Visok rejting',
    sort: 'Sortiranje', sortRecommend: 'Preporučeno', sortPopular: 'Popularno', sortNew: 'Najnovije', sortRating: 'Po rejtingu',
    apply: 'Prikaži rezultate', reset: 'Resetuj', genre: 'Žanrovi', tags: 'Tagovi', fandom: 'Fandom', source: 'Izvor', ai: 'AI sadržaj',
    anyAi: 'Bilo koji', noAi: 'Autor tvrdi: bez AI', assisted: 'AI delimično', generated: 'AI generisano',
    noAiShort: 'Bez AI', aiYes: 'Sa AI', aiUnknown: 'AI: nije navedeno',
    sourcePublisher: 'Izdavač', sourceSelf: 'Samizdat', sourceClassic: 'Klasici',
    count: (n) => `Pronađeno ${n} dela`, prev: 'Nazad', next: 'Napred', empty: 'Ništa nije pronađeno po ovim filterima.',
    activeFilters: 'Aktivni filteri', remove: 'Ukloni', tagPlaceholder: 'tag-slug', fandomPlaceholder: 'Naziv fandoma',
    topTab: 'Top', topDesc: 'Najčitanije po periodu — u svakoj kategoriji.', periods: { all: 'Sve vreme', year: 'Godina', month: 'Mesec', week: 'Nedelja' },
  },
  ru: {
    books: 'Книги', selfpub: 'Самиздат', fanfics: 'Фанфики', manga: 'Графическая литература',
    titles: { books: 'Книги', selfpub: 'Самиздат', fanfics: 'Фанфики', comics: 'Графическая литература', top: 'Топ' },
    eyebrows: { books: 'TEROLIBRARY · PUBLISHERS', selfpub: 'TEROLIBRARY · SELF-PUBLISHED', fanfics: 'TEROLIBRARY · FANFICTION', comics: 'TEROLIBRARY · GRAPHIC LITERATURE', top: 'TEROLIBRARY · TOP' },
    descs: { books: 'Книги издательств и самиздат.', selfpub: 'Произведения, которые авторы публикуют сами.', fanfics: 'Фандомы, AU, персонажи и истории сообщества.', comics: 'Манга, манхва, вебтуны и комиксы.', top: 'Самое читаемое по периоду.' },
    filters: 'Фильтры', all: 'Все', popular: 'Популярное', fresh: 'Новинки', completed: 'Завершённые', rated: 'Высокий рейтинг',
    sort: 'Сортировка', sortRecommend: 'Рекомендованные', sortPopular: 'Популярные', sortNew: 'Сначала новые', sortRating: 'По рейтингу',
    apply: 'Показать результаты', reset: 'Сбросить', genre: 'Жанры', tags: 'Теги', fandom: 'Фандом', source: 'Источник', ai: 'AI-контент',
    anyAi: 'Любой', noAi: 'Автор заявляет: без ИИ', assisted: 'ИИ использовался частично', generated: 'ИИ-генерация',
    noAiShort: 'Без ИИ', aiYes: 'С ИИ', aiUnknown: 'ИИ: не заявлено',
    sourcePublisher: 'Издательство', sourceSelf: 'Самиздат', sourceClassic: 'Классика',
    count: (n) => `Найдено ${n} произведений`, prev: 'Назад', next: 'Вперёд', empty: 'По этим фильтрам ничего не найдено.',
    activeFilters: 'Активные фильтры', remove: 'Убрать', tagPlaceholder: 'tag-slug', fandomPlaceholder: 'Название фандома',
    topTab: 'Топ', topDesc: 'Самое читаемое по периоду — в каждой категории.', periods: { all: 'Всё время', year: 'Год', month: 'Месяц', week: 'Неделя' },
  },
  en: {
    books: 'Books', selfpub: 'Self-published', fanfics: 'Fan fiction', manga: 'Graphic literature',
    titles: { books: 'Books', selfpub: 'Self-published', fanfics: 'Fan fiction', comics: 'Graphic literature', top: 'Top' },
    eyebrows: { books: 'TEROLIBRARY · PUBLISHERS', selfpub: 'TEROLIBRARY · SELF-PUBLISHED', fanfics: 'TEROLIBRARY · FANFICTION', comics: 'TEROLIBRARY · GRAPHIC LITERATURE', top: 'TEROLIBRARY · TOP' },
    descs: { books: 'Publisher books and self-published works.', selfpub: 'Works authors publish themselves.', fanfics: 'Fandoms, AUs, characters and community stories.', comics: 'Manga, manhwa, webtoons and comics.', top: 'Most read by period.' },
    filters: 'Filters', all: 'All', popular: 'Popular', fresh: 'New', completed: 'Completed', rated: 'Top rated',
    sort: 'Sort', sortRecommend: 'Recommended', sortPopular: 'Popular', sortNew: 'Newest', sortRating: 'By rating',
    apply: 'Show results', reset: 'Reset', genre: 'Genres', tags: 'Tags', fandom: 'Fandom', source: 'Source', ai: 'AI content',
    anyAi: 'Any', noAi: 'Author declares: no AI', assisted: 'AI partially used', generated: 'AI generated',
    noAiShort: 'No AI', aiYes: 'With AI', aiUnknown: 'AI: not declared',
    sourcePublisher: 'Publisher', sourceSelf: 'Self-published', sourceClassic: 'Classics',
    count: (n) => `Found ${n} works`, prev: 'Prev', next: 'Next', empty: 'Nothing matches these filters.',
    activeFilters: 'Active filters', remove: 'Remove', tagPlaceholder: 'tag-slug', fandomPlaceholder: 'Fandom name',
    topTab: 'Top', topDesc: 'Most read by period — in every category.', periods: { all: 'All time', year: 'Year', month: 'Month', week: 'Week' },
  },
};



function Card({ w, lang, t }: { w: CatalogWork; lang: Lang; t: (typeof TXT)[Lang] }) {
  const tone = w.tone || (w.category === 'manga' ? 'orange' : w.category === 'fanfic' ? 'purple' : 'blue');
  return (
    <Link
      href={`/${lang}/work/${w.slug}`}
      className="book"
      style={{ display: 'block' }}
      aria-label={`${w.title} — ${w.author}`}
    >
      <div
        className={`cover ${tone}`}
        style={w.cover ? { backgroundImage: `url(${w.cover})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        <span className={`ai-badge ${w.aiUsage === 'no_ai' ? 'ai-badge--no' : !w.aiUsage || w.aiUsage === 'not_declared' ? 'ai-badge--unknown' : 'ai-badge--yes'}`}>
          {w.aiUsage === 'no_ai' ? t.noAiShort : !w.aiUsage || w.aiUsage === 'not_declared' ? t.aiUnknown : t.aiYes}
        </span>
        <div className="book-hover">
          <div className="book-hover-meta">
            <span>{w.category === 'manga' ? t.manga : w.category === 'fanfic' ? t.fanfics : t.books}</span>
            <span className="rating">★ {w.rating.toFixed(1)}</span>
          </div>
          <h3>{w.title}</h3>
          <div className="book-hover-author">{w.author}</div>
          {w.description ? <div className="book-hover-desc">{w.description}</div> : null}
        </div>
      </div>
    </Link>
  );
}

export default function BookverseCatalog({
  works, lang, initialQuery = '', initialSection = 'books', initialFilter = 'forYou',
  page = 1, hasMore = false, tops = {}, period = 'all', genre = '', source = '', tag = '', fandom = '', aiUsage = '', genres = [],
  aiUsages = [], includeTags = [], excludeTags = [], includeMode = 'all', tags = [],
  comicFormat = '', colorMode = '', readingDirection = '', demographic = '', free = false,
}: {
  works: CatalogWork[];
  lang: Lang;
  initialQuery?: string;
  initialSection?: SectionId;
  initialFilter?: CatalogFilter;
  page?: number;
  hasMore?: boolean;
  tops?: Partial<Record<'publisher' | 'selfpub' | 'fanfic' | 'graphic', CatalogWork[]>>;
  period?: string;
  genre?: string;
  source?: string;
  tag?: string;
  fandom?: string;
  aiUsage?: string;
  aiUsages?: string[];
  includeTags?: string[];
  excludeTags?: string[];
  includeMode?: 'all' | 'any';
  tags?: Array<{ slug: string; name: string; count: number }>;
  comicFormat?: string;
  colorMode?: string;
  readingDirection?: string;
  demographic?: string;
  free?: boolean;
  genres?: CatalogGenre[];
}) {
  const t = TXT[lang];
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftGenre, setDraftGenre] = useState(genre);
  const [draftTag, setDraftTag] = useState(tag);
  const [draftFandom, setDraftFandom] = useState(fandom);
  const [draftSource, setDraftSource] = useState(source);
  const [draftAi, setDraftAi] = useState(aiUsage);
  const [draftAiList, setDraftAiList] = useState<string[]>(aiUsages);
  const [draftInclude, setDraftInclude] = useState<string[]>(includeTags);
  const [draftExclude, setDraftExclude] = useState<string[]>(excludeTags);
  const [draftIncludeMode, setDraftIncludeMode] = useState<'all' | 'any'>(includeMode);
  const [tagTab, setTagTab] = useState<'include' | 'exclude'>('include');
  const [draftComicFormat, setDraftComicFormat] = useState(comicFormat);
  const [draftColorMode, setDraftColorMode] = useState(colorMode);
  const [draftDirection, setDraftDirection] = useState(readingDirection);
  const [draftDemographic, setDraftDemographic] = useState(demographic);
  const [draftFree, setDraftFree] = useState(Boolean(free));
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [tagSort, setTagSort] = useState<'popular' | 'az'>('popular');
  const [tagsExpanded, setTagsExpanded] = useState(false);

  function toggleTag(slug: string) {
    if (tagTab === 'include') {
      setDraftInclude((prev) => prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]);
      setDraftExclude((prev) => prev.filter((x) => x !== slug));
    } else {
      setDraftExclude((prev) => prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]);
      setDraftInclude((prev) => prev.filter((x) => x !== slug));
    }
  }

  function go(next: {
    q?: string; kind?: string; filter?: CatalogFilter; page?: number;
    genre?: string; tag?: string; fandom?: string; source?: string; ai?: string; period?: string;
    aiList?: string[]; include?: string[]; exclude?: string[]; includeMode?: 'all' | 'any';
    gfmt?: string; gcolor?: string; gdir?: string; gdemo?: string; free?: boolean;
  }) {
    const params = new URLSearchParams();
    const q = next.q !== undefined ? next.q : query;
    const kind = next.kind !== undefined ? next.kind : SECTION_KIND[initialSection];
    const f = next.filter !== undefined ? next.filter : initialFilter;
    const g = next.genre !== undefined ? next.genre : genre;
    const tg = next.tag !== undefined ? next.tag : tag;
    const fd = next.fandom !== undefined ? next.fandom : fandom;
    const src = next.source !== undefined ? next.source : source;
    const ai = next.ai !== undefined ? next.ai : aiUsage;
    const aiList = next.aiList !== undefined ? next.aiList : draftAiList;
    const inc = next.include !== undefined ? next.include : draftInclude;
    const exc = next.exclude !== undefined ? next.exclude : draftExclude;
    const incMode = next.includeMode !== undefined ? next.includeMode : draftIncludeMode;
    const per = next.period !== undefined ? next.period : period;
    const p = next.page !== undefined ? next.page : 1;
    if (q.trim()) params.set('q', q.trim());
    if (kind) params.set('kind', kind);
    if (f !== 'forYou') params.set('filter', f);
    if (g) params.set('genre', g);
    if (tg) params.set('tag', tg);
    if (fd) params.set('fandom', fd);
    if (src) params.set('source', src);
    if (aiList.length) aiList.forEach((v) => params.append('ai', v));
    else if (ai) params.set('ai', ai);
    if (inc.length) params.set('include', inc.join(','));
    if (exc.length) params.set('exclude', exc.join(','));
    if (inc.length && incMode === 'any') params.set('includeMode', 'any');
    const gfmt = next.gfmt !== undefined ? next.gfmt : draftComicFormat;
    const gcolor = next.gcolor !== undefined ? next.gcolor : draftColorMode;
    const gdir = next.gdir !== undefined ? next.gdir : draftDirection;
    const gdemo = next.gdemo !== undefined ? next.gdemo : draftDemographic;
    const isFree = next.free !== undefined ? next.free : draftFree;
    if (gfmt) params.set('gfmt', gfmt);
    if (gcolor) params.set('gcolor', gcolor);
    if (gdir) params.set('gdir', gdir);
    if (gdemo) params.set('gdemo', gdemo);
    if (isFree) params.set('free', '1');
    if (per && per !== 'all') params.set('period', per);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    router.push(`/${lang}/catalog${qs ? `?${qs}` : ''}`);
  }

  const active: { label: string; clear: () => void }[] = [];
  if (query) active.push({ label: `q: ${query}`, clear: () => { setQuery(''); go({ q: '', page: 1 }); } });
  if (genre) active.push({ label: `${t.genre}: ${genre}`, clear: () => { setDraftGenre(''); go({ genre: '', page: 1 }); } });
  if (tag) active.push({ label: `#${tag}`, clear: () => { setDraftTag(''); go({ tag: '', page: 1 }); } });
  if (fandom) active.push({ label: `${t.fandom}: ${fandom}`, clear: () => { setDraftFandom(''); go({ fandom: '', page: 1 }); } });
  if (source) active.push({ label: `${t.source}: ${source}`, clear: () => { setDraftSource(''); go({ source: '', page: 1 }); } });
  if (aiUsage) active.push({ label: `AI: ${aiUsage === 'yes' ? t.aiYes : aiUsage === 'no_ai' ? t.noAiShort : aiUsage}`, clear: () => { setDraftAi(''); go({ ai: '', page: 1 }); } });
  if (draftAiList.length) active.push({ label: `AI: ${draftAiList.map((v) => v === 'used' ? t.aiYes : v === 'no_ai' ? t.noAiShort : t.aiUnknown).join(' / ')}`, clear: () => { setDraftAiList([]); go({ aiList: [], page: 1 }); } });
  if (draftInclude.length) active.push({ label: `+${draftInclude.map((v) => '#' + v).join(' ')}`, clear: () => { setDraftInclude([]); go({ include: [], page: 1 }); } });
  if (draftExclude.length) active.push({ label: `−${draftExclude.map((v) => '#' + v).join(' ')}`, clear: () => { setDraftExclude([]); go({ exclude: [], page: 1 }); } });
  if (draftComicFormat) active.push({ label: draftComicFormat, clear: () => { setDraftComicFormat(''); go({ gfmt: '', page: 1 }); } });
  if (draftColorMode) active.push({ label: draftColorMode, clear: () => { setDraftColorMode(''); go({ gcolor: '', page: 1 }); } });
  if (draftDirection) active.push({ label: draftDirection.toUpperCase(), clear: () => { setDraftDirection(''); go({ gdir: '', page: 1 }); } });
  if (draftDemographic) active.push({ label: draftDemographic, clear: () => { setDraftDemographic(''); go({ gdemo: '', page: 1 }); } });
  if (draftFree) active.push({ label: lang === 'ru' ? 'Бесплатные' : 'Free', clear: () => { setDraftFree(false); go({ free: false, page: 1 }); } });

  const sortedTags = [...tags].sort((a, b) => (
    tagSort === 'az' ? a.name.localeCompare(b.name) : (Number(b.count) || 0) - (Number(a.count) || 0)
  ));
  const visibleTags = tagsExpanded ? sortedTags : sortedTags.slice(0, 12);

  const kindFor = (s: SectionId) => SECTION_KIND[s];

  if (initialSection === 'top') {
    const cats: { key: 'publisher' | 'selfpub' | 'fanfic' | 'graphic'; label: string; color: string; href: string }[] = [
      { key: 'publisher', label: t.books, color: '#5b6779', href: `/${lang}/catalog?source=publisher` },
      { key: 'selfpub', label: t.selfpub, color: '#2f6fb7', href: `/${lang}/catalog?source=selfpub` },
      { key: 'fanfic', label: t.fanfics, color: '#9061c4', href: `/${lang}/catalog?kind=fanfic` },
      { key: 'graphic', label: t.manga, color: '#df843b', href: `/${lang}/catalog?kind=comic` },
    ];
    const periodList: [string, string][] = [
      ['all', t.periods.all], ['year', t.periods.year], ['month', t.periods.month], ['week', t.periods.week],
    ];
    return (
      <main id="main" className="shell">
        <nav className="subnav" aria-label="Categories">
          {(['books', 'fanfics', 'comics'] as SectionId[]).map((sec) => (
            <button
              key={sec}
              className={`subnav-btn subnav-btn--${SECTION_COLOR[sec]} ${sec === 'top' ? 'active' : ''}`}
              onClick={() => go({ kind: kindFor(sec), page: 1 })}
            >
              {sec === 'books' ? t.books : sec === 'selfpub' ? t.selfpub : sec === 'fanfics' ? t.fanfics : sec === 'comics' ? t.manga : t.topTab}
            </button>
          ))}
        </nav>
        <div className="catalog-title">
          <div>
            <div className="eyebrow">TEROLIBRARY · TOP</div>
            <h1>{t.topTab}</h1>
            <p className="muted">{t.topDesc}</p>
          </div>
        </div>
        <div className="catalog-controls">
          {periodList.map(([key, label]) => (
            <button key={key} className={`chip ${period === key ? 'selected' : ''}`} onClick={() => go({ period: key, page: 1 })}>{label}</button>
          ))}
        </div>
        {cats.map((c) => (
          <div className="section" key={c.key}>
            <div className="sectionhead">
              <h2 style={{ color: c.color }}>{c.label}</h2>
              <Link className="btn" href={c.href}>{t.all} →</Link>
            </div>
            {(tops[c.key] && tops[c.key]!.length) ? (
              <div className="grid">{tops[c.key]!.map((w) => <Card key={w.id} w={w} lang={lang} t={t} />)}</div>
            ) : (
              <div className="panel muted" style={{ textAlign: 'center' }}>{t.empty}</div>
            )}
          </div>
        ))}
      </main>
    );
  }

  return (
    <main id="main" className="shell">
      <div className={`tlp-cat-category tlp-catalog ${initialSection}`}>
        <nav className="subnav" aria-label="Categories">
          {(['books', 'fanfics', 'comics'] as SectionId[]).map((s) => (
            <button
              key={s}
              className={`subnav-btn subnav-btn--${SECTION_COLOR[s]} ${initialSection === s ? 'active' : ''}`}
              onClick={() => go({ kind: kindFor(s), source: s === 'books' || s === 'selfpub' ? '' : source, page: 1 })}
            >
              {s === 'books' ? t.books : s === 'selfpub' ? t.selfpub : s === 'fanfics' ? t.fanfics : s === 'comics' ? t.manga : t.topTab}
            </button>
          ))}
        </nav>

        {initialSection === 'books' ? (
          <div className="chips" style={{ marginBottom: 14 }}>
            {([['', lang === 'ru' ? 'Все книги' : lang === 'en' ? 'All books' : 'Sve knjige'],
               ['publisher', t.sourcePublisher],
               ['selfpub', t.sourceSelf]] as [string, string][]).map(([v, label]) => (
              <button key={v || 'all'} className={`chip ${source === v ? 'selected' : ''}`}
                onClick={() => go({ source: v, page: 1 })}>{label}</button>
            ))}
          </div>
        ) : null}

        <div className="catalog-title">
          <div>
            <div className="eyebrow">{t.eyebrows[initialSection]}</div>
            <h1>{t.titles[initialSection]}</h1>
            <p className="muted">{t.descs[initialSection]}</p>
          </div>
          <button className="btn" onClick={() => setFiltersOpen(true)}>☷ {t.filters}{active.length ? ` ${active.length}` : ''}</button>
        </div>

        <div className="catalog-controls">
          {([
            ['forYou', t.all], ['popular', t.popular], ['fresh', t.fresh], ['completed', t.completed],
          ] as [CatalogFilter, string][]).map(([key, label]) => (
            <button key={key} className={`chip ${initialFilter === key ? 'selected' : ''}`} onClick={() => go({ filter: key, page: 1 })}>{label}</button>
          ))}
          <span className="spacer" />
          <select className="select" value={initialFilter} onChange={(e) => go({ filter: e.target.value as CatalogFilter, page: 1 })} aria-label={t.sort}>
            <option value="forYou">{t.sortRecommend}</option>
            <option value="popular">{t.sortPopular}</option>
            <option value="fresh">{t.sortNew}</option>
            <option value="completed">{t.completed}</option>
          </select>
          <button className="iconbtn" onClick={() => setView('grid')} aria-label="Grid">▦</button>
          <button className="iconbtn" onClick={() => setView('list')} aria-label="List">☰</button>
        </div>

        {active.length ? (
          <div className="filters-active">
            <span>{t.activeFilters}:</span>
            {active.map((f, i) => (
              <button key={i} className="chip selected" onClick={f.clear}>{f.label} ✕</button>
            ))}
          </div>
        ) : null}

        <div className="catalog-results"><span className="catalog-results-count">{t.count(works.length)}</span><span className="catalog-results-note">{initialSection === 'comics' ? t.manga : initialSection === 'fanfics' ? t.fanfics : t.books}</span></div>

        {works.length ? (
          <div className={view === 'grid' ? 'grid catalog-grid' : 'catalog-list'}>
            {works.map((w) => <Card key={w.id} w={w} lang={lang} t={t} />)}
          </div>
        ) : (
          <div className="panel muted" style={{ textAlign: 'center' }}>{t.empty}</div>
        )}

        <div className="row" style={{ marginTop: 20 }}>
          <button className="btn" disabled={page <= 1} onClick={() => go({ page: Math.max(1, page - 1) })}>← {t.prev}</button>
          <button className="btn" disabled={!hasMore} onClick={() => go({ page: page + 1 })}>{t.next} →</button>
        </div>
      </div>

      {filtersOpen ? (
        <div className="filterdrawer open" role="dialog" aria-modal="true" aria-label={t.filters}
          onClick={(e) => { if (e.target === e.currentTarget) setFiltersOpen(false); }}>
          <div className="drawer">
            <div className="drawerhead">
              <h2>{t.filters}</h2>
              <button className="iconbtn" onClick={() => setFiltersOpen(false)} aria-label="Close">✕</button>
            </div>

            <div className="filterrow">
              <h3>{t.genre}</h3>
              <div className="chips">
                {genres.map((g) => (
                  <button key={g.slug} className={`chip ${draftGenre === g.slug ? 'selected' : ''}`}
                    onClick={() => setDraftGenre(draftGenre === g.slug ? '' : g.slug)}>{g.name}</button>
                ))}
              </div>
            </div>

            <div className="filterrow">
              <h3>{t.tags}</h3>
              <div className="chips" style={{ marginBottom: 8 }}>
                <button className={`chip ${tagTab === 'include' ? 'selected' : ''}`} onClick={() => setTagTab('include')}>
                  {lang === 'ru' ? 'Включить' : lang === 'en' ? 'Include' : 'Uključi'}
                </button>
                <button className={`chip ${tagTab === 'exclude' ? 'selected' : ''}`} onClick={() => setTagTab('exclude')}>
                  {lang === 'ru' ? 'Исключить' : lang === 'en' ? 'Exclude' : 'Isključi'}
                </button>
              </div>
              {tags.length === 0 ? (
                <p className="muted" style={{ fontSize: 11 }}>
                  {lang === 'ru' ? 'Теги пока не заведены в базе — фильтр появится, когда авторы их добавят.'
                    : lang === 'en' ? 'No tags in the database yet — the filter appears once authors add them.'
                    : 'Tagovi još nisu uneseni u bazu — filter se pojavljuje kada ih autori dodaju.'}
                </p>
              ) : (
                <>
                  <div className="chips" style={{ marginBottom: 8 }}>
                    <button className={`chip ${tagSort === 'popular' ? 'selected' : ''}`} onClick={() => setTagSort('popular')}>
                      {lang === 'ru' ? 'Популярные' : lang === 'en' ? 'Popular' : 'Popularno'}
                    </button>
                    <button className={`chip ${tagSort === 'az' ? 'selected' : ''}`} onClick={() => setTagSort('az')}>
                      {lang === 'ru' ? 'А–Я' : lang === 'en' ? 'A–Z' : 'A–Š'}
                    </button>
                  </div>
                  <div className="chips">
                    {visibleTags.map((tag) => {
                      const list = tagTab === 'include' ? draftInclude : draftExclude;
                      return (
                        <button key={tag.slug} className={`chip ${list.includes(tag.slug) ? 'selected' : ''}`}
                          onClick={() => toggleTag(tag.slug)}>#{tag.name} <span className="muted">{Number(tag.count) || 0}</span></button>
                      );
                    })}
                  </div>
                  {sortedTags.length > 12 ? (
                    <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => setTagsExpanded((v) => !v)}>
                      {tagsExpanded ? (lang === 'ru' ? 'Свернуть' : lang === 'en' ? 'Show less' : 'Prikaži manje')
                        : `${lang === 'ru' ? 'Показать все' : lang === 'en' ? 'Show all' : 'Prikaži sve'} (${sortedTags.length})`}
                    </button>
                  ) : null}
                </>
              )}
              {draftInclude.length > 1 ? (
                <div style={{ marginTop: 8 }}>
                  {([['all', lang === 'ru' ? 'Все выбранные' : lang === 'en' ? 'Match all' : 'Svi izabrani'],
                     ['any', lang === 'ru' ? 'Любой выбранный' : lang === 'en' ? 'Match any' : 'Bilo koji']] as ['all' | 'any', string][]).map(([v, label]) => (
                    <label key={v} className="checkbox">
                      <input type="radio" name="includeMode" checked={draftIncludeMode === v} onChange={() => setDraftIncludeMode(v)} /> {label}
                    </label>
                  ))}
                </div>
              ) : null}
              <h3 style={{ marginTop: 12 }}>{t.fandom}</h3>
              <input className="taginput" value={draftFandom} placeholder={t.fandomPlaceholder} onChange={(e) => setDraftFandom(e.target.value)} />
            </div>

            <div className="filterrow">
              <h3>{t.ai}</h3>
              {([
                ['used', t.aiYes], ['no_ai', t.noAiShort], ['not_declared', t.aiUnknown],
              ] as [string, string][]).map(([v, label]) => (
                <label key={v} className="checkbox">
                  <input type="checkbox" checked={draftAiList.includes(v)}
                    onChange={() => setDraftAiList((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])} /> {label}
                </label>
              ))}
              <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                {lang === 'ru' ? 'Несколько галочек объединяются: использовался ИИ или без ИИ, либо не указано.'
                  : lang === 'en' ? 'Multiple boxes combine: AI used, no AI, or not declared.'
                  : 'Više oznaka se kombinuje: AI korišćen, bez AI ili nije navedeno.'}
              </p>
            </div>

            {initialSection === 'comics' ? (
              <div className="filterrow">
                <h3>{lang === 'ru' ? 'Графическая литература' : lang === 'en' ? 'Graphic literature' : 'Grafička literatura'}</h3>
                {([
                  ['gfmt', lang === 'ru' ? 'Формат' : lang === 'en' ? 'Format' : 'Format',
                    draftComicFormat, setDraftComicFormat,
                    [['manga', 'Manga'], ['manhwa', 'Manhwa'], ['manhua', 'Manhua'], ['webtoon', 'Webtoon'], ['comic', 'Comic']]],
                  ['gcolor', lang === 'ru' ? 'Цветность' : lang === 'en' ? 'Colour' : 'Boja',
                    draftColorMode, setDraftColorMode, [['color', lang === 'ru' ? 'Цветное' : lang === 'en' ? 'Colour' : 'Kolor'], ['bw', lang === 'ru' ? 'Ч/б' : lang === 'en' ? 'B&W' : 'Crno-belo']]],
                  ['gdir', lang === 'ru' ? 'Направление' : lang === 'en' ? 'Direction' : 'Smer',
                    draftDirection, setDraftDirection, [['ltr', 'LTR'], ['rtl', 'RTL']]],
                  ['gdemo', lang === 'ru' ? 'Демография' : lang === 'en' ? 'Demographic' : 'Demografija',
                    draftDemographic, setDraftDemographic, [['shounen', 'Shounen'], ['shoujo', 'Shoujo'], ['seinen', 'Seinen'], ['josei', 'Josei']]],
                ] as Array<[string, string, string, (v: string) => void, Array<[string, string]>]>).map(([key, title, value, setValue, options]) => (
                  <div key={key} style={{ marginBottom: 10 }}>
                    <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{title}</div>
                    <div className="chips">
                      {options.map(([v, label]) => (
                        <button key={v} className={`chip ${value === v ? 'selected' : ''}`}
                          onClick={() => setValue(value === v ? '' : v)}>{label}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="filterrow">
              <h3>{lang === 'ru' ? 'Доступ' : lang === 'en' ? 'Access' : 'Pristup'}</h3>
              <label className="checkbox">
                <input type="checkbox" checked={draftFree} onChange={(event) => setDraftFree(event.target.checked)} />
                {lang === 'ru' ? 'Бесплатные' : lang === 'en' ? 'Free works' : 'Besplatna dela'}
              </label>
            </div>

            <div className="filterrow">
              <h3>{t.source}</h3>
              {([
                ['publisher', t.sourcePublisher], ['selfpub', t.sourceSelf], ['classic', t.sourceClassic],
              ] as [string, string][]).map(([v, label]) => (
                <label key={v} className="checkbox">
                  <input type="checkbox" checked={draftSource === v} onChange={() => setDraftSource(draftSource === v ? '' : v)} /> {label}
                </label>
              ))}
            </div>

            <div className="row" style={{
              position: 'sticky', bottom: 0, marginTop: 20, paddingTop: 12, paddingBottom: 4,
              background: 'var(--tlp-panel)', borderTop: '1px solid var(--tlp-line)',
            }}>
              <button className="btn" onClick={() => {
                setDraftGenre(''); setDraftTag(''); setDraftFandom(''); setDraftSource(''); setDraftAi('');
                setDraftAiList([]); setDraftInclude([]); setDraftExclude([]); setDraftIncludeMode('all');
                setDraftComicFormat(''); setDraftColorMode(''); setDraftDirection(''); setDraftDemographic(''); setDraftFree(false);
                go({ genre: '', tag: '', fandom: '', source: '', ai: '', aiList: [], include: [], exclude: [], includeMode: 'all',
                     gfmt: '', gcolor: '', gdir: '', gdemo: '', free: false, page: 1 });
                setFiltersOpen(false);
              }}>{t.reset}</button>
              <button className="btn primary" onClick={() => {
                go({ genre: draftGenre, tag: draftTag, fandom: draftFandom, source: draftSource, ai: draftAi,
                     aiList: draftAiList, include: draftInclude, exclude: draftExclude, includeMode: draftIncludeMode,
                     gfmt: draftComicFormat, gcolor: draftColorMode, gdir: draftDirection, gdemo: draftDemographic,
                     free: draftFree, page: 1 });
                setFiltersOpen(false);
              }}>{t.apply}</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
