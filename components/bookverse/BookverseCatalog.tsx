'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { catalogDict, type CatalogDict } from '@/lib/bookverse-i18n';
import type { Lang } from '@/lib/i18n';

export type SectionId = 'books' | 'fanfics' | 'comics';
export type CatalogFilter = 'forYou' | 'popular' | 'fresh' | 'completed';
export type CatalogGenre = { slug: string; name: string };

export type CatalogWork = {
  id: number;
  slug: string;
  title: string;
  author: string;
  description: string;
  category: 'book' | 'fanfic' | 'manga';
  rating: number;
  classic?: boolean;
  completed?: boolean;
  cover?: string | null;
  tone: 'blue' | 'rose' | 'gold' | 'violet' | 'green' | 'orange';
};

const SECTION_IDS: SectionId[] = ['books', 'fanfics', 'comics'];

/** Значение `kind` в URL для раздела каталога. */
const SECTION_KIND: Record<SectionId, string> = { books: '', fanfics: 'fanfic', comics: 'comic' };

const LANGS: { code: Lang; label: string }[] = [
  { code: 'sr', label: 'SR' },
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
];

function Cover({ work, series }: { work: CatalogWork; series: string }) {
  const [broken, setBroken] = useState(false);
  const src = work.cover ? (work.cover.startsWith('http') ? work.cover : work.cover) : '';
  // Реальная обложка, если она есть; декоративная заглушка — только как fallback.
  if (src && !broken) {
    return (
      <div className="bv-cover bv-cover--image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={work.title} loading="lazy" onError={() => setBroken(true)} />
      </div>
    );
  }
  return (
    <div className={`bv-cover bv-cover--${work.tone}`} aria-label={work.title}>
      <span className="bv-cover__ornament" />
      <span className="bv-cover__series">{series}</span>
      <span className="bv-cover__title">{work.title}</span>
      <span className="bv-cover__author">{work.author}</span>
    </div>
  );
}

function WorkCard({ work, lang, d, percent }: { work: CatalogWork; lang: Lang; d: CatalogDict; percent?: number }) {
  const genre = work.category === 'manga' ? d.genreManga : work.category === 'fanfic' ? d.genreFanfic : d.genreBook;
  const badge = work.classic ? d.badgeClassic : work.completed ? d.badgeCompleted : '';
  return (
    <Link className="bv-work-card" href={`/${lang}/work/${work.slug}`}>
      <Cover work={work} series="TEROLIBRARY ORIGINAL" />
      {/* Прогресс чтения на карточке: видно, где остановился (аудит, п.28). */}
      {typeof percent === 'number' && percent > 0 ? (
        <div style={{ height: 3, background: 'var(--bv-line)' }}>
          <div style={{ width: `${Math.min(100, percent)}%`, height: '100%', background: 'var(--bv-accent)' }} />
        </div>
      ) : null}
      <div className="bv-work-card__body">
        <div className="bv-work-card__meta">
          <span>{genre}</span>
          {badge ? <span className="bv-pill">{badge}</span> : null}
          {work.rating > 0 ? <span className="bv-rating">★ {work.rating.toFixed(1)}</span> : null}
        </div>
        <h3>{work.title}</h3>
        <p>{work.author}</p>
      </div>
    </Link>
  );
}

export default function BookverseCatalog({
  works, lang, initialQuery = '', initialSection = 'books', initialFilter = 'forYou', genres = [],
  page = 1, hasMore = false, genre = '', source = '', tag = '', fandom = '',
  user = null, progress = {}, notifications = 0,
}: {
  works: CatalogWork[];
  lang: Lang;
  genres?: CatalogGenre[];
  initialQuery?: string;
  initialSection?: SectionId;
  initialFilter?: CatalogFilter;
  page?: number;
  hasMore?: boolean;
  genre?: string;
  source?: string;
  tag?: string;
  fandom?: string;
  user?: { name: string } | null;
  progress?: Record<number, number>;
  notifications?: number;
}) {
  const d = catalogDict(lang);
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [pending, setPending] = useState(false);
  const firstRender = useRef(true);

  const section = initialSection;
  const filter = initialFilter;
  const copy = d.sections[section];

  /** Единственный способ поменять состояние: собрать URL и уйти на него.
   *  Так раздел/фильтр/поиск/страница сохраняются при refresh и в ссылке. */
  function go(next: { q?: string; kind?: string; filter?: CatalogFilter; page?: number; type?: string; source?: string; genre?: string; tag?: string; fandom?: string }) {
    const params = new URLSearchParams();
    const q = next.q !== undefined ? next.q : query;
    const kind = next.kind !== undefined ? next.kind : SECTION_KIND[section];
    const f = next.filter !== undefined ? next.filter : filter;
    const p = next.page !== undefined ? next.page : 1;

    if (q.trim()) params.set('q', q.trim());
    if (kind) params.set('kind', kind);
    if (next.type) params.set('type', next.type);
    if (f !== 'forYou') params.set('filter', f);
    const selectedGenre = next.genre !== undefined ? next.genre : genre;
    if (selectedGenre) params.set('genre', selectedGenre);
    const src = next.source !== undefined ? next.source : source;
    if (src) params.set('source', src);
    const tg = next.tag !== undefined ? next.tag : tag;
    if (tg) params.set('tag', tg);
    const fd = next.fandom !== undefined ? next.fandom : fandom;
    if (fd) params.set('fandom', fd);
    if (p > 1) params.set('page', String(p));

    setPending(true);
    const qs = params.toString();
    router.push(`/${lang}/catalog${qs ? `?${qs}` : ''}`);
  }

  // Поиск: пока печатают — только локальное состояние, в URL уходит с задержкой.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const t = setTimeout(() => {
      if (query !== initialQuery) go({ q: query, page: 1 });
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => { setPending(false); }, [works]);

  function switchLang(code: Lang) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (SECTION_KIND[section]) params.set('kind', SECTION_KIND[section]);
    if (filter !== 'forYou') params.set('filter', filter);
    if (page > 1) params.set('page', String(page));
    if (genre) params.set('genre', genre);
    if (source) params.set('source', source);
    if (tag) params.set('tag', tag);
    if (fandom) params.set('fandom', fandom);
    const qs = params.toString();
    window.location.href = `/${code}/catalog${qs ? `?${qs}` : ''}`;
  }

  const filterLabels: [CatalogFilter, string][] = [
    ['forYou', d.filters.forYou],
    ['popular', d.filters.popular],
    ['fresh', d.filters.fresh],
    ['completed', d.filters.completed],
  ];

  return (
    <main className={`bv-app bv-theme-${section}`}>
      <aside className="bv-sidebar">
        <Link href={`/${lang}`} className="bv-brand" aria-label={d.brandHome}>
          <span className="bv-brand__mark">t</span>
          <span>erolibrary<span className="bv-brand__dot">.</span></span>
        </Link>
        <div className="bv-sidebar__label">{d.platform}</div>
        <nav className="bv-main-nav" aria-label={d.platform}>
          {SECTION_IDS.map((id) => (
            <button key={id} className={`bv-nav-item ${section === id ? 'is-active' : ''}`}
              onClick={() => go({ kind: SECTION_KIND[id], page: 1 })}>
              <span className={`bv-nav-icon bv-nav-icon--${id}`}>{id === 'books' ? '▤' : id === 'fanfics' ? '✧' : '▧'}</span>
              <span>{d.sections[id].label}</span>
              {section === id ? <span className="bv-nav-item__active-dot" /> : null}
            </button>
          ))}
        </nav>
        <div className="bv-sidebar__label bv-sidebar__label--spaced">{d.mySpace}</div>
        <nav className="bv-main-nav" aria-label={d.library}>
          <Link href={`/${lang}/library?tab=saved`} className="bv-nav-item"><span className="bv-nav-icon">▣</span><span>{d.library}</span></Link>
          <Link href={`/${lang}/library?tab=history`} className="bv-nav-item"><span className="bv-nav-icon">◷</span><span>{d.history}</span></Link>
          <Link href={`/${lang}/library?tab=bookmarks`} className="bv-nav-item"><span className="bv-nav-icon">☆</span><span>{d.bookmarks}</span></Link>
          <Link href={`/${lang}/collections`} className="bv-nav-item"><span className="bv-nav-icon">◫</span><span>{lang === 'ru' ? 'Подборки' : lang === 'en' ? 'Collections' : 'Kolekcije'}</span></Link>
        </nav>
        <div className="bv-sidebar__bottom">
          <div className="bv-author-box">
            <div className="bv-author-box__icon">✎</div>
            <div><strong>{d.publishing}</strong><span>{d.publishingSub}</span></div>
            <Link href={`/${lang}/author`} aria-label={d.promoAuthorLink}>↗</Link>
          </div>
          <Link className="bv-profile" href={user ? `/${lang}/library` : `/${lang}/login`}>
            <span className="bv-avatar">{user ? user.name.slice(0, 1).toUpperCase() : d.guest.slice(0, 1)}</span>
            <span><strong>{user ? user.name : d.guest}</strong><small>{user ? d.mySpace : d.guestSub}</small></span>
            <span className="bv-profile__more">···</span>
          </Link>
        </div>
      </aside>

      <section className="bv-main">
        <header className="bv-topbar">
          <div className="bv-mobile-brand"><span className="bv-brand__mark">t</span> erolibrary</div>
          <label className="bv-search">
            <span>⌕</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={d.searchPlaceholder} />
            <kbd>⌘ K</kbd>
          </label>
          <div className="bv-topbar__actions">
            {/* Колокольчик уведомлений: новые главы из библиотеки (аудит, п.22). */}
            <Link className="bv-icon-button" href={`/${lang}/notifications`} aria-label="Notifications">
              🔔{notifications > 0 ? <i /> : null}
            </Link>
            <div className="bv-langs" role="group" aria-label="Language">
              {LANGS.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => switchLang(item.code)}
                  className={`bv-lang ${item.code === lang ? 'is-active' : ''}`}
                  aria-pressed={item.code === lang}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <Link className="bv-login" href={`/${lang}/login`}>{d.login}</Link>
          </div>
        </header>

        <div className="bv-content">
          <div className="bv-section-switcher" role="tablist" aria-label={d.platform}>
            {SECTION_IDS.map((id) => (
              <button role="tab" aria-selected={section === id} key={id}
                onClick={() => go({ kind: SECTION_KIND[id], page: 1 })}
                className={section === id ? 'is-active' : ''}>
                {d.sections[id].label}
              </button>
            ))}
            <Link href={`/${lang}/library`} className="bv-switcher-link">{d.library}</Link>
          </div>

          <section className="bv-catalog-intro">
            <div className="bv-catalog-intro__eyebrow">{copy.eyebrow}</div>
            <div className="bv-catalog-intro__heading">
              <div>
                <h1>{copy.title}</h1>
                <p>{copy.subtitle}</p>
              </div>
              <span className="bv-catalog-intro__count" aria-hidden="true">{section === 'books' ? 'BOOKS' : section === 'fanfics' ? 'FANFICTION' : 'MANGA & COMICS'}</span>
            </div>
          </section>


          <section className="bv-section-block">
            <div className="bv-section-heading">
              <div><span className="bv-kicker">{d.catalogKicker}</span><h2>{lang === 'ru' ? 'Все произведения' : lang === 'en' ? 'Browse works' : 'Sva dela'}</h2><p>{lang === 'ru' ? 'Используйте фильтры, чтобы найти нужное' : lang === 'en' ? 'Use filters to find your next read' : 'Koristite filtere da pronađete sledeće čitanje'}</p></div>
              <button className="bv-view-all" onClick={() => { setQuery(''); go({ q: '', filter: 'forYou', page: 1 }); }}>{d.wholeCatalog} <span>→</span></button>
            </div>
            <div className="bv-filter-row">
              {filterLabels.map(([key, label]) => (
                <button key={key} onClick={() => go({ filter: key, page: 1 })} className={filter === key ? 'is-active' : ''}>{label}</button>
              ))}
            </div>

            <div className="bv-catalog-controls">
              <div className="bv-source-control">
                <span>{lang === 'ru' ? 'Источник' : lang === 'en' ? 'Source' : 'Izvor'}</span>
                {([
                  ['', lang === 'ru' ? 'Все' : lang === 'en' ? 'All' : 'Sve'],
                  ['publisher', lang === 'ru' ? 'Издательства' : lang === 'en' ? 'Publishers' : 'Izdavači'],
                  ['selfpub', lang === 'ru' ? 'Самиздат' : lang === 'en' ? 'Self-published' : 'Samostalno'],
                  ['classic', lang === 'ru' ? 'Классика' : lang === 'en' ? 'Classics' : 'Klasici'],
                ] as [string, string][]).map(([value, label]) => (
                  <button key={value || 'all'} onClick={() => go({ page: 1, source: value })} className={source === value ? 'is-active' : ''}>{label}</button>
                ))}
              </div>
              <label className="bv-genre-control">
                <span>{lang === 'ru' ? 'Жанр' : lang === 'en' ? 'Genre' : 'Žanr'}</span>
                <select value={genre} onChange={(e) => go({ genre: e.target.value, page: 1 })}>
                  <option value="">{lang === 'ru' ? 'Все жанры' : lang === 'en' ? 'All genres' : 'Svi žanrovi'}</option>
                  {genres.map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}
                </select>
              </label>
              <label className="bv-genre-control">
                <span>{lang === 'ru' ? 'Тег' : lang === 'en' ? 'Tag' : 'Tag'}</span>
                <input
                  className="input"
                  defaultValue={tag}
                  placeholder="tag-slug"
                  onBlur={(e) => { const v = e.target.value.trim(); if (v !== tag) go({ tag: v, page: 1 }); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
                />
              </label>
              <label className="bv-genre-control">
                <span>{lang === 'ru' ? 'Фандом' : lang === 'en' ? 'Fandom' : 'Fandom'}</span>
                <input
                  className="input"
                  defaultValue={fandom}
                  placeholder={lang === 'ru' ? 'Название фандома' : lang === 'en' ? 'Fandom name' : 'Naziv fandoma'}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v !== fandom) go({ fandom: v, page: 1 }); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
                />
              </label>
            </div>
            <div className="bv-work-grid" style={{ opacity: pending ? 0.55 : 1 }}>
              {works.map((w) => <WorkCard key={w.id} work={w} lang={lang} d={d} percent={progress[w.id]} />)}
            </div>
            {works.length === 0 ? <div className="bv-empty">{d.empty}</div> : null}

            <div className="bv-filter-row" style={{ justifyContent: 'center', marginTop: 16 }}>
              <button
                onClick={() => go({ page: Math.max(1, page - 1) })}
                className={page <= 1 ? '' : 'is-active'}
                disabled={page <= 1}
                style={{ opacity: page <= 1 ? 0.4 : 1 }}
              >
                ← {lang === 'ru' ? 'Назад' : 'Prethodna'}
              </button>
              <span className="muted" style={{ alignSelf: 'center' }}>{lang === 'ru' ? 'Страница' : 'Strana'} {page}</span>
              <button
                onClick={() => go({ page: page + 1 })}
                className={hasMore ? 'is-active' : ''}
                disabled={!hasMore}
                style={{ opacity: hasMore ? 1 : 0.4 }}
              >
                {lang === 'ru' ? 'Дальше' : 'Sledeća'} →
              </button>
            </div>
          </section>

          <footer className="bv-footer">
            <span>© 2026 TEROLIBRARY</span><span>{d.footerTagline}</span>
            <div>
              <Link href={`/${lang}/about`}>{d.footerAbout}</Link>
              <Link href={`/${lang}/rules`}>{d.footerRules}</Link>
              <Link href={`/${lang}/help`}>{d.footerHelp}</Link>
            </div>
          </footer>
        </div>
      </section>

      {/* Мобильная навигация: на узком экране сайдбар скрыт, а History/Bookmarks
          были недоступны вообще (аудит, п.20). */}
      <nav className="bv-bottomnav" aria-label="Mobile">
        <Link href={`/${lang}`}>{lang === 'ru' ? 'Главная' : lang === 'en' ? 'Home' : 'Početna'}</Link>
        <Link href={`/${lang}/catalog`} className="is-active">{lang === 'ru' ? 'Каталог' : lang === 'en' ? 'Catalog' : 'Katalog'}</Link>
        <Link href={`/${lang}/library`}>{lang === 'ru' ? 'Библиотека' : lang === 'en' ? 'Library' : 'Biblioteka'}</Link>
        <Link href={`/${lang}/login`}>{lang === 'ru' ? 'Профиль' : lang === 'en' ? 'Profile' : 'Profil'}</Link>
      </nav>
    </main>
  );
}
