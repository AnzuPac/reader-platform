'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { catalogDict, type CatalogDict } from '@/lib/bookverse-i18n';
import type { Lang } from '@/lib/i18n';

export type SectionId = 'books' | 'fanfics' | 'comics';
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
        </div>
        <h3>{work.title}</h3>
        <p>{work.author}</p>
      </div>
    </Link>
  );
}

export default function BookverseCatalog({
  works, lang, initialQuery = '', initialSection = 'books', initialFilter = 'forYou',
  page = 1, hasMore = false, genre = '', source = '',
  user = null, progress = {},
}: {
  works: CatalogWork[];
  lang: Lang;
  initialQuery?: string;
  initialSection?: SectionId;
  initialFilter?: CatalogFilter;
  page?: number;
  hasMore?: boolean;
  genre?: string;
  source?: string;
  user?: { name: string } | null;
  progress?: Record<number, number>;
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
  function go(next: { q?: string; kind?: string; filter?: CatalogFilter; page?: number; type?: string; source?: string }) {
    const params = new URLSearchParams();
    const q = next.q !== undefined ? next.q : query;
    const kind = next.kind !== undefined ? next.kind : SECTION_KIND[section];
    const f = next.filter !== undefined ? next.filter : filter;
    const p = next.page !== undefined ? next.page : 1;

    if (q.trim()) params.set('q', q.trim());
    if (kind) params.set('kind', kind);
    if (next.type) params.set('type', next.type);
    if (f !== 'forYou') params.set('filter', f);
    if (genre) params.set('genre', genre);
    const src = next.source !== undefined ? next.source : source;
    if (src) params.set('source', src);
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
          <label className="bv-typefilter">
            <select
              value={section === 'comics' ? 'manga' : section === 'fanfics' ? 'fanfic' : 'book'}
              onChange={(e) => go({ type: e.target.value === 'book' ? 'novel' : e.target.value, kind: e.target.value === 'book' ? '' : e.target.value === 'manga' ? 'comic' : 'fanfic', page: 1 })}
              aria-label={d.allTypes}
            >
              <option value="book">{d.sectionBooks}</option>
              <option value="fanfic">{d.sectionFanfics}</option>
              <option value="manga">{d.sectionComics}</option>
            </select>
          </label>
          <div className="bv-topbar__actions">
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

          <section className="bv-hero">
            <div className="bv-hero__content">
              <div className="bv-eyebrow"><span />{copy.eyebrow}</div>
              <h1>{copy.title}</h1>
              <p>{copy.subtitle}</p>
              <div className="bv-hero__actions">
                <button className="bv-primary-button" onClick={() => go({ filter: 'forYou', page: 1 })}>{copy.action}<span>↗</span></button>
                <button className="bv-text-link" onClick={() => { setQuery(''); go({ q: '', filter: 'forYou', page: 1 }); }}>{d.viewAll} <span>→</span></button>
              </div>
            </div>
            <div className="bv-hero-art" aria-hidden="true">
              <div className="bv-hero-art__halo" />
              <div className="bv-hero-art__book bv-hero-art__book--back" />
              <div className="bv-hero-art__book bv-hero-art__book--front">
                <span>TEROLIBRARY</span><strong>THE<br />NEXT<br />CHAPTER</strong><small>YOUR STORY STARTS HERE</small>
              </div>
              <span className="bv-hero-art__spark bv-hero-art__spark--one">✦</span>
              <span className="bv-hero-art__spark bv-hero-art__spark--two">✧</span>
            </div>
            <div className="bv-hero__index">{String(SECTION_IDS.indexOf(section) + 1).padStart(2, '0')} <span>/ 03</span></div>
          </section>

          <section className="bv-section-block">
            <div className="bv-section-heading">
              <div><span className="bv-kicker">{d.catalogKicker}</span><h2>{d.catalogTitle}</h2><p>{copy.subtitle}</p></div>
              <button className="bv-view-all" onClick={() => { setQuery(''); go({ q: '', filter: 'forYou', page: 1 }); }}>{d.wholeCatalog} <span>→</span></button>
            </div>
            <div className="bv-filter-row">
              {filterLabels.map(([key, label]) => (
                <button key={key} onClick={() => go({ filter: key, page: 1 })} className={filter === key ? 'is-active' : ''}>{label}</button>
              ))}
            </div>

            {/* Источник издания: издательское, самиздат, классика (аудит, п.10).
                listWorks это уже умел — UI просто не передавал параметр. */}
            <div className="bv-filter-row">
              <span className="muted" style={{ fontSize: 10, alignSelf: 'center', marginRight: 6 }}>
                {lang === 'ru' ? 'Источник' : lang === 'en' ? 'Source' : 'Izvor'}:
              </span>
              {([
                ['', lang === 'ru' ? 'Все' : lang === 'en' ? 'All' : 'Sve'],
                ['publisher', lang === 'ru' ? 'Издательства' : lang === 'en' ? 'Publishers' : 'Izdavači'],
                ['selfpub', lang === 'ru' ? 'Самиздат' : lang === 'en' ? 'Self-published' : 'Samostalno'],
                ['classic', lang === 'ru' ? 'Классика' : lang === 'en' ? 'Classics' : 'Klasici'],
              ] as [string, string][]).map(([value, label]) => (
                <button key={value || 'all'} onClick={() => go({ page: 1, source: value })} className={source === value ? 'is-active' : ''}>{label}</button>
              ))}
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

          <section className="bv-promo-row">
            <div className="bv-promo-card bv-promo-card--author">
              <div><span className="bv-kicker">{d.promoAuthorKicker}</span><h2>{d.promoAuthorTitle}</h2>
                <p>{d.promoAuthorText}</p>
                <Link href={`/${lang}/author`}>{d.promoAuthorLink} <span>→</span></Link></div>
              <div className="bv-promo-card__symbol">✎</div>
            </div>
            <div className="bv-promo-card bv-promo-card--community">
              <div><span className="bv-kicker">{d.promoLibKicker}</span><h2>{d.promoLibTitle}</h2>
                <p>{d.promoLibText}</p>
                <Link href={`/${lang}/library`}>{d.promoLibLink} <span>→</span></Link></div>
              <div className="bv-promo-card__symbol">▤</div>
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
