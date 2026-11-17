'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { catalogDict, type CatalogDict } from '@/lib/bookverse-i18n';
import type { Lang } from '@/lib/i18n';

export type SectionId = 'books' | 'fanfics' | 'comics';

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
  tone: 'blue' | 'rose' | 'gold' | 'violet' | 'green' | 'orange';
};

const SECTION_IDS: SectionId[] = ['books', 'fanfics', 'comics'];

/** Раздел каталога → категория произведения. */
const SECTION_CATEGORY: Record<SectionId, CatalogWork['category']> = {
  books: 'book', fanfics: 'fanfic', comics: 'manga',
};

const LANGS: { code: Lang; label: string }[] = [
  { code: 'sr', label: 'SR' },
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
];

function Cover({ work, series }: { work: CatalogWork; series: string }) {
  return (
    <div className={`bv-cover bv-cover--${work.tone}`} aria-label={work.title}>
      <span className="bv-cover__ornament" />
      <span className="bv-cover__series">{series}</span>
      <span className="bv-cover__title">{work.title}</span>
      <span className="bv-cover__author">{work.author}</span>
    </div>
  );
}

function WorkCard({ work, lang, d }: { work: CatalogWork; lang: Lang; d: CatalogDict }) {
  const genre = work.category === 'manga' ? d.genreManga : work.category === 'fanfic' ? d.genreFanfic : d.genreBook;
  const badge = work.classic ? d.badgeClassic : work.completed ? d.badgeCompleted : '';
  return (
    <Link className="bv-work-card" href={`/${lang}/work/${work.slug}`}>
      <Cover work={work} series="TEROLIBRARY ORIGINAL" />
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
  works, lang, initialQuery = '', initialSection = 'books',
}: {
  works: CatalogWork[];
  lang: Lang;
  initialQuery?: string;
  initialSection?: SectionId;
}) {
  const d = catalogDict(lang);
  const [section, setSection] = useState<SectionId>(initialSection);
  const [query, setQuery] = useState(initialQuery);
  const [typeFilter, setTypeFilter] = useState<'all' | CatalogWork['category']>('all');
  const [filter, setFilter] = useState<'forYou' | 'popular' | 'fresh' | 'completed'>('forYou');

  const copy = d.sections[section];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const wanted: CatalogWork['category'] = typeFilter === 'all' ? SECTION_CATEGORY[section] : typeFilter;
    let list = works.filter((w) => w.category === wanted);
    list = list.filter((w) => !q || `${w.title} ${w.author}`.toLowerCase().includes(q));
    if (filter === 'popular') list = [...list].sort((a, b) => b.rating - a.rating);
    if (filter === 'completed') list = list.filter((w) => w.completed);
    return list;
  }, [works, section, query, typeFilter, filter]);

  function switchLang(code: Lang) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (section === 'fanfics') params.set('kind', 'fanfic');
    if (section === 'comics') params.set('kind', 'comic');
    const qs = params.toString();
    window.location.href = `/${code}/catalog${qs ? `?${qs}` : ''}`;
  }

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
              onClick={() => { setSection(id); setTypeFilter('all'); }}>
              <span className={`bv-nav-icon bv-nav-icon--${id}`}>{id === 'books' ? '▤' : id === 'fanfics' ? '✧' : '▧'}</span>
              <span>{d.sections[id].label}</span>
              {section === id ? <span className="bv-nav-item__active-dot" /> : null}
            </button>
          ))}
        </nav>
        <div className="bv-sidebar__label bv-sidebar__label--spaced">{d.mySpace}</div>
        <nav className="bv-main-nav" aria-label={d.library}>
          <Link href={`/${lang}/library`} className="bv-nav-item"><span className="bv-nav-icon">▣</span><span>{d.library}</span></Link>
          <Link href={`/${lang}/library`} className="bv-nav-item"><span className="bv-nav-icon">◷</span><span>{d.history}</span></Link>
          <Link href={`/${lang}/library`} className="bv-nav-item"><span className="bv-nav-icon">☆</span><span>{d.bookmarks}</span></Link>
        </nav>
        <div className="bv-sidebar__bottom">
          <div className="bv-author-box">
            <div className="bv-author-box__icon">✎</div>
            <div><strong>{d.publishing}</strong><span>{d.publishingSub}</span></div>
            <Link href={`/${lang}/author`} aria-label={d.promoAuthorLink}>↗</Link>
          </div>
          <Link className="bv-profile" href={`/${lang}/login`}>
            <span className="bv-avatar">{d.guest.slice(0, 1)}</span>
            <span><strong>{d.guest}</strong><small>{d.guestSub}</small></span>
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
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} aria-label={d.allTypes}>
              <option value="all">{d.allTypes}</option>
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
            {SECTION_IDS.map((id) => {
              const n = works.filter((w) => w.category === SECTION_CATEGORY[id]).length;
              return (
                <button role="tab" aria-selected={section === id} key={id}
                  onClick={() => { setSection(id); setTypeFilter('all'); }}
                  className={section === id ? 'is-active' : ''}>
                  {d.sections[id].label} <span className="bv-tab-count">{n}</span>
                </button>
              );
            })}
            <Link href={`/${lang}/library`} className="bv-switcher-link">{d.library}</Link>
          </div>

          <section className="bv-hero">
            <div className="bv-hero__content">
              <div className="bv-eyebrow"><span />{copy.eyebrow}</div>
              <h1>{copy.title}</h1>
              <p>{copy.subtitle}</p>
              <div className="bv-hero__actions">
                <button className="bv-primary-button" onClick={() => setTypeFilter('all')}>{copy.action}<span>↗</span></button>
                <button className="bv-text-link" onClick={() => { setQuery(''); setTypeFilter('all'); }}>{d.viewAll} <span>→</span></button>
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
              <button className="bv-view-all" onClick={() => setQuery('')}>{d.wholeCatalog} <span>→</span></button>
            </div>
            <div className="bv-filter-row">
              {([['forYou', d.filters.forYou], ['popular', d.filters.popular], ['fresh', d.filters.fresh], ['completed', d.filters.completed]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setFilter(key)} className={filter === key ? 'is-active' : ''}>{label}</button>
              ))}
            </div>
            <div className="bv-work-grid">
              {filtered.slice(0, 8).map((w) => <WorkCard key={w.id} work={w} lang={lang} d={d} />)}
            </div>
            {filtered.length === 0 ? <div className="bv-empty">{d.empty}</div> : null}
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
              <Link href={`/${lang}`}>{d.footerAbout}</Link>
              <Link href={`/${lang}`}>{d.footerRules}</Link>
              <Link href={`/${lang}`}>{d.footerHelp}</Link>
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
}
