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
  sourcePublisher: string; sourceSelf: string; sourceClassic: string;
  count: (n: number) => string; prev: string; next: string; empty: string;
  activeFilters: string; remove: string; tagPlaceholder: string; fandomPlaceholder: string;
  topTab: string; topDesc: string; periods: Record<'all'|'year'|'month'|'week', string>;
}> = {
  sr: {
    books: 'Knjige izdavača', selfpub: 'Samizdat', fanfics: 'Fanfikcija', manga: 'Grafička literatura',
    titles: { books: 'Knjige izdavača', selfpub: 'Samizdat', fanfics: 'Fanfikcija', comics: 'Grafička literatura', top: 'Top' },
    eyebrows: { books: 'TEROLIBRARY · PUBLISHERS', selfpub: 'TEROLIBRARY · SELF-PUBLISHED', fanfics: 'TEROLIBRARY · FANFICTION', comics: 'TEROLIBRARY · GRAPHIC LITERATURE', top: 'TEROLIBRARY · TOP' },
    descs: { books: 'Knjige izdavačkih kuća.', selfpub: 'Dela koja autori objavljuju sami.', fanfics: 'Fandomi, AU, likovi i priče zajednice.', comics: 'Manga, manhva, vebtuni i stripovi.', top: 'Najčitanije po periodu.' },
    filters: 'Filteri', all: 'Sve', popular: 'Popularno', fresh: 'Novo', completed: 'Završeno', rated: 'Visok rejting',
    sort: 'Sortiranje', sortRecommend: 'Preporučeno', sortPopular: 'Popularno', sortNew: 'Najnovije', sortRating: 'Po rejtingu',
    apply: 'Prikaži rezultate', reset: 'Resetuj', genre: 'Žanrovi', tags: 'Tagovi', fandom: 'Fandom', source: 'Izvor', ai: 'AI sadržaj',
    anyAi: 'Bilo koji', noAi: 'Autor tvrdi: bez AI', assisted: 'AI delimično', generated: 'AI generisano',
    sourcePublisher: 'Izdavač', sourceSelf: 'Samizdat', sourceClassic: 'Klasici',
    count: (n) => `Pronađeno ${n} dela`, prev: 'Nazad', next: 'Napred', empty: 'Ništa nije pronađeno po ovim filterima.',
    activeFilters: 'Aktivni filteri', remove: 'Ukloni', tagPlaceholder: 'tag-slug', fandomPlaceholder: 'Naziv fandoma',
    topTab: 'Top', topDesc: 'Najčitanije po periodu — u svakoj kategoriji.', periods: { all: 'Sve vreme', year: 'Godina', month: 'Mesec', week: 'Nedelja' },
  },
  ru: {
    books: 'Книги издательств', selfpub: 'Самиздат', fanfics: 'Фанфики', manga: 'Графическая литература',
    titles: { books: 'Книги издательств', selfpub: 'Самиздат', fanfics: 'Фанфики', comics: 'Графическая литература', top: 'Топ' },
    eyebrows: { books: 'TEROLIBRARY · PUBLISHERS', selfpub: 'TEROLIBRARY · SELF-PUBLISHED', fanfics: 'TEROLIBRARY · FANFICTION', comics: 'TEROLIBRARY · GRAPHIC LITERATURE', top: 'TEROLIBRARY · TOP' },
    descs: { books: 'Книги издательских домов.', selfpub: 'Произведения, которые авторы публикуют сами.', fanfics: 'Фандомы, AU, персонажи и истории сообщества.', comics: 'Манга, манхва, вебтуны и комиксы.', top: 'Самое читаемое по периоду.' },
    filters: 'Фильтры', all: 'Все', popular: 'Популярное', fresh: 'Новинки', completed: 'Завершённые', rated: 'Высокий рейтинг',
    sort: 'Сортировка', sortRecommend: 'Рекомендованные', sortPopular: 'Популярные', sortNew: 'Сначала новые', sortRating: 'По рейтингу',
    apply: 'Показать результаты', reset: 'Сбросить', genre: 'Жанры', tags: 'Теги', fandom: 'Фандом', source: 'Источник', ai: 'AI-контент',
    anyAi: 'Любой', noAi: 'Автор заявляет: без ИИ', assisted: 'ИИ использовался частично', generated: 'ИИ-генерация',
    sourcePublisher: 'Издательство', sourceSelf: 'Самиздат', sourceClassic: 'Классика',
    count: (n) => `Найдено ${n} произведений`, prev: 'Назад', next: 'Вперёд', empty: 'По этим фильтрам ничего не найдено.',
    activeFilters: 'Активные фильтры', remove: 'Убрать', tagPlaceholder: 'tag-slug', fandomPlaceholder: 'Название фандома',
    topTab: 'Топ', topDesc: 'Самое читаемое по периоду — в каждой категории.', periods: { all: 'Всё время', year: 'Год', month: 'Месяц', week: 'Неделя' },
  },
  en: {
    books: 'Publisher books', selfpub: 'Self-published', fanfics: 'Fan fiction', manga: 'Graphic literature',
    titles: { books: 'Publisher books', selfpub: 'Self-published', fanfics: 'Fan fiction', comics: 'Graphic literature', top: 'Top' },
    eyebrows: { books: 'TEROLIBRARY · PUBLISHERS', selfpub: 'TEROLIBRARY · SELF-PUBLISHED', fanfics: 'TEROLIBRARY · FANFICTION', comics: 'TEROLIBRARY · GRAPHIC LITERATURE', top: 'TEROLIBRARY · TOP' },
    descs: { books: 'Books from publishing houses.', selfpub: 'Works authors publish themselves.', fanfics: 'Fandoms, AUs, characters and community stories.', comics: 'Manga, manhwa, webtoons and comics.', top: 'Most read by period.' },
    filters: 'Filters', all: 'All', popular: 'Popular', fresh: 'New', completed: 'Completed', rated: 'Top rated',
    sort: 'Sort', sortRecommend: 'Recommended', sortPopular: 'Popular', sortNew: 'Newest', sortRating: 'By rating',
    apply: 'Show results', reset: 'Reset', genre: 'Genres', tags: 'Tags', fandom: 'Fandom', source: 'Source', ai: 'AI content',
    anyAi: 'Any', noAi: 'Author declares: no AI', assisted: 'AI partially used', generated: 'AI generated',
    sourcePublisher: 'Publisher', sourceSelf: 'Self-published', sourceClassic: 'Classics',
    count: (n) => `Found ${n} works`, prev: 'Prev', next: 'Next', empty: 'Nothing matches these filters.',
    activeFilters: 'Active filters', remove: 'Remove', tagPlaceholder: 'tag-slug', fandomPlaceholder: 'Fandom name',
    topTab: 'Top', topDesc: 'Most read by period — in every category.', periods: { all: 'All time', year: 'Year', month: 'Month', week: 'Week' },
  },
};

function aiBadge(ai: string | undefined, t: (typeof TXT)[Lang]) {
  if (!ai || ai === 'not_declared') return null;
  if (ai === 'no_ai') return <span className="ai">✓ {t.noAi.split(':')[0]}</span>;
  if (ai === 'assisted') return <span className="ai assist">✦ AI</span>;
  return <span className="ai gen">✦ AI</span>;
}

function Card({ w, lang, t }: { w: CatalogWork; lang: Lang; t: (typeof TXT)[Lang] }) {
  const tone = w.tone || (w.category === 'manga' ? 'orange' : w.category === 'fanfic' ? 'purple' : 'blue');
  return (
    <Link href={`/${lang}/work/${w.slug}`} className="book" style={{ display: 'block' }}>
      <div className={`cover ${tone}`} style={w.cover ? { backgroundImage: `url(${w.cover})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
        {aiBadge(w.aiUsage, t)}
        <span className="tiny">TEROLIBRARY</span>
        <span className="cover-title">{w.title}</span>
        <span className="cover-author">{w.author}</span>
      </div>
      <div className="bookbody">
        <div className="meta">
          <span>{w.category === 'manga' ? t.manga : w.category === 'fanfic' ? t.fanfics : t.books}</span>
          <span className="rating">★ {w.rating.toFixed(1)}</span>
        </div>
        <h3>{w.title}</h3>
        <div className="author">{w.author}</div>
        <div className="tags">
          <span className="status">{w.completed ? t.completed : '—'}</span>
        </div>
        <div className="work-description" aria-label="Описание произведения">{w.description || ''}</div>
      </div>
    </Link>
  );
}

export default function BookverseCatalog({
  works, lang, initialQuery = '', initialSection = 'books', initialFilter = 'forYou',
  page = 1, hasMore = false, tops = {}, period = 'all', genre = '', source = '', tag = '', fandom = '', aiUsage = '', genres = [],
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
  const [view, setView] = useState<'grid' | 'list'>('grid');

  function go(next: {
    q?: string; kind?: string; filter?: CatalogFilter; page?: number;
    genre?: string; tag?: string; fandom?: string; source?: string; ai?: string; period?: string;
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
    const per = next.period !== undefined ? next.period : period;
    const p = next.page !== undefined ? next.page : 1;
    if (q.trim()) params.set('q', q.trim());
    if (kind) params.set('kind', kind);
    if (f !== 'forYou') params.set('filter', f);
    if (g) params.set('genre', g);
    if (tg) params.set('tag', tg);
    if (fd) params.set('fandom', fd);
    if (src) params.set('source', src);
    if (ai) params.set('ai', ai);
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
  if (aiUsage) active.push({ label: `AI: ${aiUsage}`, clear: () => { setDraftAi(''); go({ ai: '', page: 1 }); } });

  const kindFor = (s: SectionId) => SECTION_KIND[s];

  if (initialSection === 'top') {
    const cats: { key: 'publisher' | 'selfpub' | 'fanfic' | 'graphic'; label: string; color: string; href: string }[] = [
      { key: 'publisher', label: t.books, color: '#5b6779', href: `/${lang}/catalog?kind=publisher` },
      { key: 'selfpub', label: t.selfpub, color: '#2f6fb7', href: `/${lang}/catalog?kind=selfpub` },
      { key: 'fanfic', label: t.fanfics, color: '#9061c4', href: `/${lang}/catalog?kind=fanfic` },
      { key: 'graphic', label: t.manga, color: '#df843b', href: `/${lang}/catalog?kind=comic` },
    ];
    const periodList: [string, string][] = [
      ['all', t.periods.all], ['year', t.periods.year], ['month', t.periods.month], ['week', t.periods.week],
    ];
    return (
      <main id="main" className="shell">
        <nav className="subnav" aria-label="Categories">
          {(['books', 'selfpub', 'fanfics', 'comics', 'top'] as SectionId[]).map((sec) => (
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
          {(['books', 'selfpub', 'fanfics', 'comics', 'top'] as SectionId[]).map((s) => (
            <button
              key={s}
              className={`subnav-btn subnav-btn--${SECTION_COLOR[s]} ${initialSection === s ? 'active' : ''}`}
              onClick={() => go({ kind: kindFor(s), source: s === 'books' || s === 'selfpub' ? '' : source, page: 1 })}
            >
              {s === 'books' ? t.books : s === 'selfpub' ? t.selfpub : s === 'fanfics' ? t.fanfics : s === 'comics' ? t.manga : t.topTab}
            </button>
          ))}
        </nav>

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
              <input className="taginput" value={draftTag} placeholder={t.tagPlaceholder} onChange={(e) => setDraftTag(e.target.value)} />
              <h3 style={{ marginTop: 12 }}>{t.fandom}</h3>
              <input className="taginput" value={draftFandom} placeholder={t.fandomPlaceholder} onChange={(e) => setDraftFandom(e.target.value)} />
            </div>

            <div className="filterrow">
              <h3>{t.ai}</h3>
              {([
                ['', t.anyAi], ['no_ai', t.noAi], ['assisted', t.assisted], ['generated', t.generated],
              ] as [string, string][]).map(([v, label]) => (
                <label key={v || 'any'} className="checkbox">
                  <input type="radio" name="ai" checked={draftAi === v} onChange={() => setDraftAi(v)} /> {label}
                </label>
              ))}
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

            <div className="row" style={{ marginTop: 20 }}>
              <button className="btn" onClick={() => {
                setDraftGenre(''); setDraftTag(''); setDraftFandom(''); setDraftSource(''); setDraftAi('');
                go({ genre: '', tag: '', fandom: '', source: '', ai: '', page: 1 });
                setFiltersOpen(false);
              }}>{t.reset}</button>
              <button className="btn primary" onClick={() => {
                go({ genre: draftGenre, tag: draftTag, fandom: draftFandom, source: draftSource, ai: draftAi, page: 1 });
                setFiltersOpen(false);
              }}>{t.apply}</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
