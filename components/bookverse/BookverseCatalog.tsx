'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export type SectionId = 'books' | 'fanfics' | 'comics';

export type CatalogWork = {
  id: number;
  slug: string;
  title: string;
  author: string;
  description: string;
  category: 'book' | 'fanfic' | 'manga';
  genre: string;
  badge?: string;
  rating: number;
  completion: string;
  tone: 'blue' | 'rose' | 'gold' | 'violet' | 'green' | 'orange';
};

const SECTIONS: { id: SectionId; label: string; eyebrow: string; description: string; action: string; title: string; subtitle: string }[] = [
  {
    id: 'books', label: 'Книги', eyebrow: 'KNJIGE I ORIGINALI',
    title: 'Приче које остају с тобом', subtitle: 'Издаваштва, независни аутори и нове веб-новеле.',
    description: 'Издаваштва, независни аутори и нове веб-новеле', action: 'Отвори каталог књига',
  },
  {
    id: 'fanfics', label: 'Фанфики', eyebrow: 'FANFIKCIJA',
    title: 'Познати светови. Нове приче.', subtitle: 'Фанатске приче, омиљени фандоми и нови аутори.',
    description: 'Приче омиљених фандома и нови аутoрски светови', action: 'Истражи фанфикове',
  },
  {
    id: 'comics', label: 'Манга и комикси', eyebrow: 'MANGA & STRIPOVI',
    title: 'Приче у сваком кадру', subtitle: 'Манга, манхва, манхуа, западни стрипови и графички романи.',
    description: 'Манга, манхва, манхуа и графички романи', action: 'Отвори каталог стрипова',
  },
];

const TONE_BY_CATEGORY: Record<CatalogWork['category'], CatalogWork['tone']> = {
  book: 'blue', fanfic: 'violet', manga: 'orange',
};

/** Раздел каталога → категория произведения. */
const SECTION_CATEGORY: Record<SectionId, CatalogWork['category']> = {
  books: 'book', fanfics: 'fanfic', comics: 'manga',
};

function Cover({ work, compact = false }: { work: CatalogWork; compact?: boolean }) {
  return (
    <div className={`bv-cover bv-cover--${work.tone} ${compact ? 'bv-cover--compact' : ''}`} aria-label={`Корице: ${work.title}`}>
      <span className="bv-cover__ornament" />
      <span className="bv-cover__series">BOOKVERSE ORIGINAL</span>
      <span className="bv-cover__title">{work.title}</span>
      <span className="bv-cover__author">{work.author}</span>
    </div>
  );
}

function WorkCard({ work, lang }: { work: CatalogWork; lang: string }) {
  return (
    <Link className="bv-work-card" href={`/${lang}/work/${work.slug}`}>
      <Cover work={work} />
      <div className="bv-work-card__body">
        <div className="bv-work-card__meta">
          <span>{work.genre}</span>
          {work.badge ? <span className="bv-pill">{work.badge}</span> : null}
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
  lang: string;
  initialQuery?: string;
  initialSection?: SectionId;
}) {
  const [section, setSection] = useState<SectionId>(initialSection);
  const [query, setQuery] = useState(initialQuery);
  const [typeFilter, setTypeFilter] = useState<'all' | CatalogWork['category']>('all');
  const [activeFilter, setActiveFilter] = useState('За тебе');

  const copy = SECTIONS.find((s) => s.id === section)!;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const wanted: CatalogWork['category'] = typeFilter === 'all' ? SECTION_CATEGORY[section] : typeFilter;
    const bySection = works.filter((w) => w.category === wanted);
    let list = bySection.filter((w) => !q || `${w.title} ${w.author} ${w.genre}`.toLowerCase().includes(q));
    if (activeFilter === 'Популарно') list = [...list].sort((a, b) => b.rating - a.rating);
    if (activeFilter === 'Завршено') list = list.filter((w) => w.completion === 'completed');
    return list;
  }, [works, section, query, typeFilter, activeFilter]);

  return (
    <main className={`bv-app bv-theme-${section}`}>
      <aside className="bv-sidebar">
        <Link href={`/${lang}`} className="bv-brand" aria-label="Bookverse — главная">
          <span className="bv-brand__mark">b.</span>
          <span>bookverse<span className="bv-brand__dot">.</span></span>
        </Link>
        <div className="bv-sidebar__label">ПЛАТФОРМА</div>
        <nav className="bv-main-nav" aria-label="Основная навигация">
          {SECTIONS.map((item) => (
            <button key={item.id} className={`bv-nav-item ${section === item.id ? 'is-active' : ''}`} onClick={() => { setSection(item.id); setTypeFilter('all'); }}>
              <span className={`bv-nav-icon bv-nav-icon--${item.id}`}>{item.id === 'books' ? '▤' : item.id === 'fanfics' ? '✧' : '▧'}</span>
              <span>{item.label}</span>
              {section === item.id ? <span className="bv-nav-item__active-dot" /> : null}
            </button>
          ))}
        </nav>
        <div className="bv-sidebar__label bv-sidebar__label--spaced">ТВОЈ ПРОСТОР</div>
        <nav className="bv-main-nav" aria-label="Личная библиотека">
          <Link href={`/${lang}/library`} className="bv-nav-item"><span className="bv-nav-icon">▣</span><span>Моя библиотека</span></Link>
          <Link href={`/${lang}/library`} className="bv-nav-item"><span className="bv-nav-icon">◷</span><span>История чтения</span></Link>
          <Link href={`/${lang}/library`} className="bv-nav-item"><span className="bv-nav-icon">☆</span><span>Закладки</span></Link>
        </nav>
        <div className="bv-sidebar__bottom">
          <div className="bv-author-box">
            <div className="bv-author-box__icon">✎</div>
            <div><strong>Публикуете истории?</strong><span>Ваше место для творчества</span></div>
            <Link href={`/${lang}/author`} aria-label="Открыть студию автора">↗</Link>
          </div>
          <Link className="bv-profile" href={`/${lang}/login`}>
            <span className="bv-avatar">Г</span>
            <span><strong>Гость</strong><small>Войти или создать аккаунт</small></span>
            <span className="bv-profile__more">···</span>
          </Link>
        </div>
      </aside>

      <section className="bv-main">
        <header className="bv-topbar">
          <div className="bv-mobile-brand"><span className="bv-brand__mark">b.</span> bookverse</div>
          <label className="bv-search">
            <span>⌕</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Название, автор, жанр или фандом..." />
            <kbd>⌘ K</kbd>
          </label>
          <label className="bv-typefilter">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} aria-label="Тип произведения">
              <option value="all">Все типы</option>
              <option value="book">Книги</option>
              <option value="fanfic">Фанфики</option>
              <option value="manga">Манга и комиксы</option>
            </select>
          </label>
          <div className="bv-topbar__actions">
            <button className="bv-icon-button" aria-label="Уведомления">♧<i /></button>
            <Link className="bv-login" href={`/${lang}/login`}>Войти</Link>
          </div>
        </header>

        <div className="bv-content">
          <div className="bv-section-switcher" role="tablist" aria-label="Разделы каталога">
            {SECTIONS.map((item) => (
              <button role="tab" aria-selected={section === item.id} key={item.id}
                onClick={() => { setSection(item.id); setTypeFilter('all'); }}
                className={section === item.id ? 'is-active' : ''}>{item.label}</button>
            ))}
            <Link href={`/${lang}/library`} className="bv-switcher-link">Моя библиотека</Link>
          </div>

          <section className="bv-hero">
            <div className="bv-hero__content">
              <div className="bv-eyebrow"><span />{copy.eyebrow}</div>
              <h1>{copy.title}</h1>
              <p>{copy.subtitle}</p>
              <div className="bv-hero__actions">
                <button className="bv-primary-button" onClick={() => setTypeFilter('all')}>{copy.action}<span>↗</span></button>
                <button className="bv-text-link" onClick={() => { setQuery(''); setTypeFilter('all'); }}>Смотреть всё <span>→</span></button>
              </div>
            </div>
            <div className="bv-hero-art" aria-hidden="true">
              <div className="bv-hero-art__halo" />
              <div className="bv-hero-art__book bv-hero-art__book--back" />
              <div className="bv-hero-art__book bv-hero-art__book--front">
                <span>BOOKVERSE</span><strong>THE<br />NEXT<br />CHAPTER</strong><small>YOUR STORY STARTS HERE</small>
              </div>
              <span className="bv-hero-art__spark bv-hero-art__spark--one">✦</span>
              <span className="bv-hero-art__spark bv-hero-art__spark--two">✧</span>
            </div>
            <div className="bv-hero__index">{String(SECTIONS.findIndex((s) => s.id === section) + 1).padStart(2, '0')} <span>/ 03</span></div>
          </section>

          <section className="bv-section-block">
            <div className="bv-section-heading">
              <div><span className="bv-kicker">ОТКРИЈ НОВО</span><h2>Изабрано за тебе</h2><p>{copy.description}</p></div>
              <button className="bv-view-all" onClick={() => setQuery('')}>Цео каталог <span>→</span></button>
            </div>
            <div className="bv-filter-row">
              {['За тебе', 'Популарно', 'Новинке', 'Завршено'].map((f) => (
                <button key={f} onClick={() => setActiveFilter(f)} className={activeFilter === f ? 'is-active' : ''}>{f}</button>
              ))}
            </div>
            <div className="bv-work-grid">
              {filtered.slice(0, 8).map((w) => <WorkCard key={w.id} work={w} lang={lang} />)}
            </div>
            {filtered.length === 0 ? <div className="bv-empty">Ничего не найдено. Попробуйте изменить запрос.</div> : null}
          </section>

          <section className="bv-promo-row">
            <div className="bv-promo-card bv-promo-card--author">
              <div><span className="bv-kicker">ЗА АУТОРЕ</span><h2>Твоя история<br />может начаться здесь</h2>
                <p>Создавай, публикуй и находи своих читателей.</p>
                <Link href={`/${lang}/author`}>Студия автора <span>→</span></Link></div>
              <div className="bv-promo-card__symbol">✎</div>
            </div>
            <div className="bv-promo-card bv-promo-card--community">
              <div><span className="bv-kicker">ТВОЯ БИБЛИОТЕКА</span><h2>Всё прочитанное<br />в одном месте</h2>
                <p>Сохраняй истории и возвращайся к ним в любое время.</p>
                <Link href={`/${lang}/library`}>Открыть библиотеку <span>→</span></Link></div>
              <div className="bv-promo-card__symbol">▤</div>
            </div>
          </section>

          <footer className="bv-footer">
            <span>© 2026 BOOKVERSE</span><span>Пространство историй и воображения</span>
            <div><Link href={`/${lang}`}>О платформе</Link><Link href={`/${lang}`}>Правила</Link><Link href={`/${lang}`}>Помощь</Link></div>
          </footer>
        </div>
      </section>
    </main>
  );
}
