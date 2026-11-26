import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { isLang, t, type Lang } from '@/lib/i18n';
import { readSession } from '@/lib/auth';
import { listWorks, getContinueReading, listReadingHistory, listTags, type ListWorksOpts } from '@/lib/repo';
import BookCoverCard from '@/components/bookverse/BookCoverCard';

export const dynamic = 'force-dynamic';

// Public homepage shelves are shared across visitors and change far less often
// than per-user reading progress. A short cache reduces repeated catalog queries
// without caching account-specific data or weakening access checks.
const getHomepageWorks = unstable_cache(
  async (options: ListWorksOpts) => listWorks(options).catch(() => []),
  ['terolibrary-homepage-works-v1'],
  { revalidate: 60, tags: ['homepage-works'] },
);
const getHomepageTags = unstable_cache(
  async () => listTags(12).catch(() => []),
  ['terolibrary-homepage-tags-v1'],
  { revalidate: 120, tags: ['homepage-tags'] },
);


type Card = {
  id: number; slug: string; title: string; author_name: string;
  cover_path: string | null; rating_avg: string; completion: string;
  description?: string | null;
  type?: string; kind?: string;
  ai_usage?: 'not_declared' | 'no_ai' | 'assisted' | 'generated';
};

const COLORS = {
  publisher: { fg: '#5b6779', bg: '#eceff3', line: '#8a94a6' },
  selfpub: { fg: '#2f6fb7', bg: '#e7f0fb', line: '#2f6fb7' },
  fanfic: { fg: '#9061c4', bg: '#f0e6fb', line: '#9061c4' },
  graphic: { fg: '#df843b', bg: '#fff0e2', line: '#df843b' },
} as const;

const TXT: Record<Lang, {
  eyebrow: string; heroTitle: string; heroText: string; discover: string; subscribe: string; heroTag: string; featured: string; explore: string;
  continueReading: string; library: string; directions: string; directionsSub: string;
  pubTitle: string; pubText: string; selfTitle: string; selfText: string;
  fanTitle: string; fanText: string; graphicTitle: string; graphicText: string;
  allCatalog: string; rec: string; top: string; topPub: string; topSelf: string; topFan: string; topGraphic: string;
  rating: string; openCatalog: string; empty: string;
  ctaTitle: string; ctaText: string; ctaBtn: string; completed: string; ongoing: string;
}> = {
  sr: {
    eyebrow: 'TVOJA SLEDEĆA PRIČA', heroTag: 'TRI VRSTE SADRŽAJA · JEDNA POLICA', featured: 'Izdvojene priče', explore: 'Istraži', heroTitle: 'Svetovi u koje se vraćaš', heroText: 'Knjige izdavača, samizdat, fanfikcija i grafička literatura. Nađi omiljeno, sakupi biblioteku i prati nove glave.',
    discover: 'Otvori katalog', subscribe: 'Pretplata', continueReading: 'Nastavi čitanje', library: 'Moja biblioteka',
    directions: 'Izaberi pravac', directionsSub: 'Tri vrste sadržaja · jedna platforma',
    pubTitle: 'Knjige izdavača', pubText: 'Knjige izdavačkih kuća.',
    selfTitle: 'Samizdat', selfText: 'Dela koja autori objavljuju sami.',
    fanTitle: 'Fanfikcija', fanText: 'Fandomi, AU, likovi i priče zajednice.',
    graphicTitle: 'Grafička literatura', graphicText: 'Manga, manhva, vebtuni i stripovi.',
    allCatalog: 'Ceo katalog', rec: 'Preporuke', top: 'Top', topPub: 'Top izdanja', topSelf: 'Top samizdata', topFan: 'Top fanfikcije', topGraphic: 'Top grafičke literature',
    rating: 'Rang', openCatalog: 'U katalog', empty: 'U ovom izboru još nema dela.',
    ctaTitle: 'Objavljuješ svoje priče?', ctaText: 'Autorski kabinet, statistika, čitaoci i isplate.', ctaBtn: 'Autorski kabinet',
    completed: 'Završeno', ongoing: 'U toku',
  },
  ru: {
    eyebrow: 'ТВОЯ СЛЕДУЮЩАЯ ИСТОРИЯ', heroTag: 'ТРИ ТИПА КОНТЕНТА · ОДНА БИБЛИОТЕКА', featured: 'Истории для тебя', explore: 'Исследовать', heroTitle: 'Миры, в которые хочется возвращаться', heroText: 'Книги издательств, самиздат, фанфики и графическая литература. Найди любимое, собери библиотеку и следи за новыми главами.',
    discover: 'Открыть каталог', subscribe: 'Подписка', continueReading: 'Продолжить чтение', library: 'Моя библиотека',
    directions: 'Выбери направление', directionsSub: 'Три типа контента · одна платформа',
    pubTitle: 'Книги издательств', pubText: 'Книги издательских домов.',
    selfTitle: 'Самиздат', selfText: 'Произведения, которые авторы публикуют сами.',
    fanTitle: 'Фанфики', fanText: 'Фандомы, AU, персонажи и новые прочтения.',
    graphicTitle: 'Графическая литература', graphicText: 'Манга, манхва, вебтуны и комиксы.',
    allCatalog: 'Весь каталог', rec: 'Рекомендации', top: 'Топ', topPub: 'Топ издательств', topSelf: 'Топ самиздата', topFan: 'Топ фанфиков', topGraphic: 'Топ графической литературы',
    rating: 'Рейтинг', openCatalog: 'В каталог', empty: 'В этой подборке пока нет произведений.',
    ctaTitle: 'Публикуешь свои истории?', ctaText: 'Авторский кабинет, статистика, читатели и выплаты.', ctaBtn: 'Кабинет автора',
    completed: 'Завершено', ongoing: 'В процессе',
  },
  en: {
    eyebrow: 'YOUR NEXT STORY', heroTag: 'THREE CONTENT TYPES · ONE LIBRARY', featured: 'Featured stories', explore: 'Explore', heroTitle: 'Worlds worth returning to', heroText: 'Publisher books, self-published works, fan fiction and graphic literature. Find a favourite, build a library and follow new chapters.',
    discover: 'Open catalog', subscribe: 'Subscription', continueReading: 'Continue reading', library: 'My library',
    directions: 'Choose a direction', directionsSub: 'Three content types · one platform',
    pubTitle: 'Publisher books', pubText: 'Books from publishing houses.',
    selfTitle: 'Self-published', selfText: 'Works authors publish themselves.',
    fanTitle: 'Fan fiction', fanText: 'Fandoms, AUs, characters and fresh takes.',
    graphicTitle: 'Graphic literature', graphicText: 'Manga, manhwa, webtoons and comics.',
    allCatalog: 'Full catalog', rec: 'Recommended', top: 'Top', topPub: 'Top publisher books', topSelf: 'Top self-published', topFan: 'Top fan fiction', topGraphic: 'Top graphic literature',
    rating: 'Rating', openCatalog: 'Browse', empty: 'No works in this selection yet.',
    ctaTitle: 'Have a story to publish?', ctaText: 'Creator studio, stats, readers and payouts.', ctaBtn: 'Creator studio',
    completed: 'Completed', ongoing: 'Ongoing',
  },
};

function tone(w: Card): string {
  if (w.kind === 'fanfic') return 'purple';
  if (w.type === 'comic') return 'orange';
  return 'blue';
}

function aiLabel(ai: Card['ai_usage'], l: Lang): { cls: string; text: string } | null {
  if (!ai || ai === 'not_declared') return null;
  if (ai === 'no_ai') return { cls: 'ai', text: l === 'ru' ? 'БЕЗ ИИ' : l === 'en' ? 'NO AI' : 'BEZ AI' };
  if (ai === 'assisted') return { cls: 'ai assist', text: 'AI-ASSISTED' };
  return { cls: 'ai gen', text: 'AI CONTENT' };
}

function ProtoCard({ w, lang, x }: { w: Card; lang: Lang; x: (typeof TXT)[Lang] }) {
  const categoryLabel = w.kind === 'fanfic' ? (lang === 'ru' ? 'Фанфик' : lang === 'en' ? 'Fanfic' : 'Fanfikcija') : w.type === 'comic' ? (lang === 'ru' ? 'Графика' : lang === 'en' ? 'Graphic' : 'Grafika') : (lang === 'ru' ? 'Книга' : lang === 'en' ? 'Book' : 'Knjiga');
  const aiText = w.ai_usage === 'no_ai' ? (lang === 'ru' ? 'Без ИИ' : lang === 'en' ? 'No AI' : 'Bez AI') : !w.ai_usage || w.ai_usage === 'not_declared' ? (lang === 'ru' ? 'ИИ: не заявлено' : lang === 'en' ? 'AI: not declared' : 'AI: nije navedeno') : (lang === 'ru' ? 'С ИИ' : lang === 'en' ? 'With AI' : 'Sa AI');
  return <BookCoverCard
    href={`/${lang}/work/${w.slug}`} title={w.title} author={w.author_name}
    description={w.description} cover={w.cover_path} tone={tone(w)} categoryLabel={categoryLabel}
    aiLabel={aiText} rating={Number(w.rating_avg || 0).toFixed(1)}
    status={w.completion === 'completed' ? x.completed : x.ongoing}
    openLabel={lang === 'ru' ? 'Открыть произведение' : lang === 'en' ? 'Open work' : 'Otvori delo'}
    infoLabel={lang === 'ru' ? 'Показать информацию' : lang === 'en' ? 'Show details' : 'Prikaži detalje'}
    closeLabel={lang === 'ru' ? 'Скрыть информацию' : lang === 'en' ? 'Hide details' : 'Sakrij detalje'}
  />;
}

function Grid({ items, lang, x }: { items: Card[]; lang: Lang; x: (typeof TXT)[Lang] }) {
  if (!items.length) return <div className="muted" style={{ padding: 12 }}>{x.empty}</div>;
  return <div className="grid">{items.map((w) => <ProtoCard key={w.id} w={w} lang={lang} x={x} />)}</div>;
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const x = TXT[l];

  const session = await readSession();
  const [cont, history] = session
    ? await Promise.all([
        getContinueReading(session.uid).catch(() => null),
        // Recent history is sufficient for a homepage preference signal. Avoid loading 80 rows on every visit.
        listReadingHistory(session.uid, 24).catch(() => []),
      ])
    : [null, []];
  const counts = { publisher: 0, selfpub: 0, fanfic: 0, graphic: 0 };
  for (const row of history) {
    if (row.kind === 'fanfic') counts.fanfic += 1;
    else if (row.type === 'comic') counts.graphic += 1;
    else if (row.publisher_id) counts.publisher += 1;
    else counts.selfpub += 1;
  }
  const topCategory = history.length >= 3
    ? (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as keyof typeof counts)
    : null;
  const forYou = topCategory
    ? await getHomepageWorks(
        topCategory === 'publisher' ? { type: 'novel', source: 'publisher', sort: 'rating', limit: 10 }
          : topCategory === 'selfpub' ? { type: 'novel', source: 'selfpub', sort: 'rating', limit: 10 }
            : topCategory === 'fanfic' ? { fanfic: true, sort: 'rating', limit: 10 }
              : { type: 'comic', sort: 'rating', limit: 10 },
      )
    : [];

  const [pubRec, pubTop, selfRec, selfTop, fanRec, fanTop, graphicRec, graphicTop] = await Promise.all([
    getHomepageWorks({ type: 'novel', source: 'publisher', sort: 'new', limit: 5 }),
    getHomepageWorks({ type: 'novel', source: 'publisher', sort: 'views', limit: 5 }),
    getHomepageWorks({ type: 'novel', source: 'selfpub', sort: 'new', limit: 5 }),
    getHomepageWorks({ type: 'novel', source: 'selfpub', sort: 'views', limit: 5 }),
    getHomepageWorks({ fanfic: true, sort: 'new', limit: 5 }),
    getHomepageWorks({ fanfic: true, sort: 'views', limit: 5 }),
    getHomepageWorks({ type: 'comic', sort: 'new', limit: 5 }),
    getHomepageWorks({ type: 'comic', sort: 'views', limit: 5 }),
  ]);

  const heroItems = [pubRec[0], selfRec[0], fanRec[0]].filter(Boolean) as Card[];
  const recommendedItems = (forYou.length ? forYou : [...pubTop.slice(0, 2), ...selfTop.slice(0, 2), ...fanTop.slice(0, 2), ...graphicTop.slice(0, 2)]) as Card[];
  const popularTags = await getHomepageTags();

  const sections = [
    { key: 'publisher', title: x.pubTitle, rec: pubRec as Card[], top: pubTop as Card[], href: `/${l}/catalog?kind=books&source=publisher`, color: COLORS.publisher, topTitle: x.topPub },
    { key: 'selfpub', title: x.selfTitle, rec: selfRec as Card[], top: selfTop as Card[], href: `/${l}/catalog?kind=books&source=selfpub`, color: COLORS.selfpub, topTitle: x.topSelf },
    { key: 'fanfic', title: x.fanTitle, rec: fanRec as Card[], top: fanTop as Card[], href: `/${l}/catalog?kind=fanfic`, color: COLORS.fanfic, topTitle: x.topFan },
    { key: 'graphic', title: x.graphicTitle, rec: graphicRec as Card[], top: graphicTop as Card[], href: `/${l}/catalog?kind=comic`, color: COLORS.graphic, topTitle: x.topGraphic },
  ];

  return (
    <main id="main" className="shell">
      <nav className="tl-home-mobile-categories" aria-label={l === 'ru' ? 'Категории' : l === 'en' ? 'Categories' : 'Kategorije'}>
        <Link href={`/${l}/catalog`} className="is-active">{l === 'ru' ? 'Книги' : l === 'en' ? 'Books' : 'Knjige'}</Link>
        <Link href={`/${l}/catalog?kind=fanfic`}>{x.fanTitle}</Link>
        <Link href={`/${l}/catalog?kind=comic`}>{x.graphicTitle}</Link>
      </nav>

      <div className="tl-home-desktop-intro">
      <section className="tl-home-hero">
        <div className="tl-home-hero-copy">
          <span className="tl-home-kicker">{x.heroTag}</span>
          <div className="eyebrow">{x.eyebrow}</div>
          <h1>{x.heroTitle}</h1>
          <p>{x.heroText}</p>
          <div className="tl-home-hero-actions">
            <Link className="btn primary" href={`/${l}/catalog`}>{x.discover} <span aria-hidden="true">↗</span></Link>
            <Link className="btn" href={`/${l}/subscribe`}>{x.subscribe}</Link>
          </div>
          <div className="tl-home-hero-note"><span className="tl-home-note-dot" /> {l === 'ru' ? 'Читайте, сохраняйте и открывайте новое' : l === 'en' ? 'Read, save and discover something new' : 'Čitaj, sačuvaj i otkrij nešto novo'}</div>
        </div>
        <div className="tl-home-hero-visual" aria-label={x.featured}>
          <div className="tl-home-hero-orbit tl-home-hero-orbit-one" />
          <div className="tl-home-hero-orbit tl-home-hero-orbit-two" />
          <div className="tl-home-hero-books">
            {heroItems.map((w, i) => (
              <Link key={w.id} href={`/${l}/work/${w.slug}`} className={`tl-home-feature-cover tl-home-feature-cover-${i}`} aria-label={`${w.title} — ${w.author_name}`} title={`${w.title} — ${w.author_name}`}>
                <div className={`cover ${tone(w)}`}>
            {w.cover_path ? <img className="book-cover-image" src={w.cover_path} alt="" loading="lazy" decoding="async" /> : null}
          </div>
              </Link>
            ))}
          </div>
          <div className="tl-home-feature-label"><span className="tl-home-feature-icon">✦</span><div><strong>{x.featured}</strong><span>{l === 'ru' ? 'Подборка из каталога' : l === 'en' ? 'Selected from the catalog' : 'Izbor iz kataloga'}</span></div></div>
        </div>
      </section>
      <aside className="tl-home-desktop-rail" aria-label={l === 'ru' ? 'Быстрый доступ' : l === 'en' ? 'Quick discovery' : 'Brzo otkrivanje'}>
        <div className="tl-home-rail-heading">
          <span className="eyebrow">TEROLIBRARY</span>
          <h2>{l === 'ru' ? 'Найди свою историю' : l === 'en' ? 'Find your next story' : 'Pronađi svoju priču'}</h2>
          <p>{l === 'ru' ? 'Переходи сразу к нужному типу произведений.' : l === 'en' ? 'Jump straight into the kind of stories you enjoy.' : 'Odmah pređi na vrstu priča koju voliš.'}</p>
        </div>
        <div className="tl-home-rail-links">
          <Link href={`/${l}/catalog?kind=books`}><span className="tl-home-rail-icon">▤</span><span>{l === 'ru' ? 'Книги' : l === 'en' ? 'Books' : 'Knjige'}<small>{l === 'ru' ? 'Издательства и самиздат' : l === 'en' ? 'Publishers and self-published' : 'Izdavači i samizdat'}</small></span><b>↗</b></Link>
          <Link href={`/${l}/catalog?kind=fanfic`}><span className="tl-home-rail-icon is-fanfic">✦</span><span>{x.fanTitle}<small>{l === 'ru' ? 'Фэндомы и персонажи' : l === 'en' ? 'Fandoms and characters' : 'Fandomi i likovi'}</small></span><b>↗</b></Link>
          <Link href={`/${l}/catalog?kind=comic`}><span className="tl-home-rail-icon is-graphic">▧</span><span>{x.graphicTitle}<small>{l === 'ru' ? 'Манга, манхва и вебтуны' : l === 'en' ? 'Manga, manhwa and webtoons' : 'Manga, manhwa i vebtuni'}</small></span><b>↗</b></Link>
          <Link href={`/${l}/catalog?kind=top`}><span className="tl-home-rail-icon is-top">★</span><span>{l === 'ru' ? 'Топ произведений' : l === 'en' ? 'Top stories' : 'Top dela'}<small>{l === 'ru' ? 'Что читают сейчас' : l === 'en' ? 'What readers enjoy now' : 'Šta se sada čita'}</small></span><b>↗</b></Link>
        </div>
        {popularTags.filter((tag) => tag.count > 0).length ? (
          <div className="tl-home-rail-tags">
            <div className="tl-home-rail-tags-head"><strong>{l === 'ru' ? 'Популярные теги' : l === 'en' ? 'Popular tags' : 'Popularne oznake'}</strong><Link href={`/${l}/catalog`}>{l === 'ru' ? 'Все' : l === 'en' ? 'All' : 'Sve'} →</Link></div>
            <div className="tl-home-tag-cloud">{popularTags.filter((tag) => tag.count > 0).slice(0, 8).map((tag) => <Link key={tag.slug} href={`/${l}/catalog?tag=${encodeURIComponent(tag.slug)}`} className="tl-home-tag-chip">#{tag.name}</Link>)}</div>
          </div>
        ) : null}
      </aside>
      </div>

      <section className="section tl-home-foryou">
        <div className="sectionhead">
          <div>
            <div className="eyebrow">{forYou.length ? (l === 'ru' ? 'ПЕРСОНАЛЬНО' : l === 'en' ? 'FOR YOU' : 'ZA VAS') : (l === 'ru' ? 'ВЫБОР TEROLIBRARY' : l === 'en' ? 'TEROLIBRARY PICKS' : 'IZBOR TEROLIBRARY')}</div>
            <h2>{forYou.length ? (l === 'ru' ? 'Для вас' : l === 'en' ? 'For you' : 'Za vas') : (l === 'ru' ? 'Популярные произведения' : l === 'en' ? 'Popular stories' : 'Popularna dela')}</h2>
          </div>
          <span className="muted">{forYou.length ? (l === 'ru' ? 'По вашей истории чтения' : l === 'en' ? 'Based on your reading history' : 'Na osnovu vaše istorije čitanja') : (l === 'ru' ? 'Подборка по популярности' : l === 'en' ? 'Selected by popularity' : 'Izbor po popularnosti')}</span>
        </div>
        <div className="tl-home-mobile-rail"><Grid items={recommendedItems} lang={l} x={x} /></div>
      </section>

      {popularTags.length ? (
        <section className="section tl-home-popular-tags">
          <div className="sectionhead">
            <h2>{l === 'ru' ? 'Популярные теги' : l === 'en' ? 'Popular tags' : 'Popularne oznake'}</h2>
            <Link className="btn" href={`/${l}/catalog`}>{l === 'ru' ? 'Все теги' : l === 'en' ? 'All tags' : 'Sve oznake'} →</Link>
          </div>
          <div className="tl-home-tag-cloud">
            {popularTags.filter((tag) => tag.count > 0).slice(0, 12).map((tag) => (
              <Link key={tag.slug} href={`/${l}/catalog?tag=${encodeURIComponent(tag.slug)}`} className="tl-home-tag-chip">#{tag.name}</Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="tl-home-quicklinks" aria-label={x.directions}>
        <Link href={`/${l}/catalog?kind=books`} className="tl-home-quicklink tl-home-quicklink-books"><span className="tl-home-quicklink-mark">▤</span><span>{l === 'ru' ? 'Книги' : l === 'en' ? 'Books' : 'Knjige'}</span><span className="tl-home-quicklink-arrow">↗</span></Link>
        <Link href={`/${l}/catalog?kind=fanfic`} className="tl-home-quicklink tl-home-quicklink-fanfic"><span className="tl-home-quicklink-mark">✦</span><span>{x.fanTitle}</span><span className="tl-home-quicklink-arrow">↗</span></Link>
        <Link href={`/${l}/catalog?kind=comic`} className="tl-home-quicklink tl-home-quicklink-graphic"><span className="tl-home-quicklink-mark">▧</span><span>{x.graphicTitle}</span><span className="tl-home-quicklink-arrow">↗</span></Link>
      </div>

      {cont ? (
        <div className="section">
          <div className="sectionhead">
            <h2>{x.continueReading}</h2>
            <Link className="btn" href={`/${l}/library`}>{x.library} →</Link>
          </div>
          <Link href={`/${l}/read/${cont.chapter_id}`} className="tl-home-continue-card">
            <div className="tl-home-continue-art"><span className="tl-home-continue-symbol">◉</span><span className="tl-home-continue-percent">{cont.percent}%</span></div>
            <div className="tl-home-continue-content"><div className="eyebrow">{x.continueReading}</div><h2>{cont.work_title}</h2><p className="muted">{cont.chapter_title || `${l === 'ru' ? 'Глава' : l === 'en' ? 'Chapter' : 'Glava'} ${cont.number}`}</p><div className="tl-home-progress"><span style={{ width: `${Math.max(0, Math.min(100, Number(cont.percent) || 0))}%` }} /></div><span className="tl-home-continue-button">{l === 'ru' ? 'Продолжить чтение' : l === 'en' ? 'Continue reading' : 'Nastavi čitanje'} <span>→</span></span></div>
          </Link>
        </div>
      ) : null}

      <div className="section">
        <div className="sectionhead">
          <h2>{x.directions}</h2>
          <span className="muted">{x.directionsSub}</span>
        </div>
        <div className="tl-home-directions-grid">
          <Link href={`/${l}/catalog?kind=books`} className="tl-home-direction-card tl-home-direction-books" style={{ borderTop: `3px solid ${COLORS.publisher.line}` }}>
            <div className="eyebrow" style={{ color: COLORS.publisher.fg }}>{l === 'ru' ? 'ИЗДАТЕЛЬСТВА И САМИЗДАТ' : l === 'en' ? 'PUBLISHERS & SELF-PUBLISHED' : 'IZDAVAČI I SAMIZDAT'}</div>
            <h2>{l === 'ru' ? 'Книги' : l === 'en' ? 'Books' : 'Knjige'}</h2>
            <p className="muted" style={{ marginTop: 6 }}>{l === 'ru' ? 'Издательские произведения и независимые авторы в одном каталоге.' : l === 'en' ? 'Publisher titles and independent creators in one catalog.' : 'Izdavačka dela i nezavisni autori u jednom katalogu.'}</p>
            <span className="tl-home-direction-action">{x.openCatalog} <span>↗</span></span>
          </Link>
          <Link href={`/${l}/catalog?kind=fanfic`} className="tl-home-direction-card tl-home-direction-fanfic" style={{ borderTop: `3px solid ${COLORS.fanfic.line}` }}>
            <div className="eyebrow" style={{ color: COLORS.fanfic.fg }}>FANFICTION</div><h2>{x.fanTitle}</h2>
            <p className="muted" style={{ marginTop: 6 }}>{x.fanText}</p><span className="tl-home-direction-action">{x.openCatalog} <span>↗</span></span>
          </Link>
          <Link href={`/${l}/catalog?kind=comic`} className="tl-home-direction-card tl-home-direction-graphic" style={{ borderTop: `3px solid ${COLORS.graphic.line}` }}>
            <div className="eyebrow" style={{ color: COLORS.graphic.fg }}>GRAPHIC LITERATURE</div><h2>{x.graphicTitle}</h2>
            <p className="muted" style={{ marginTop: 6 }}>{x.graphicText}</p><span className="tl-home-direction-action">{x.openCatalog} <span>↗</span></span>
          </Link>
        </div>
      </div>

      {sections.map((s) => (
        <section key={s.key} className={`tl-home-content-section tl-home-content-${s.key}`}>
          <div className="tl-home-section-heading">
            <div><span className="tl-home-section-kicker">{s.key === 'publisher' ? 'PUBLISHERS' : s.key === 'selfpub' ? 'CREATORS' : s.key === 'fanfic' ? 'FANDOM' : 'GRAPHIC'}</span><h2 style={{ color: s.color.fg }}>{s.title}</h2></div>
            <Link className="btn" href={s.href}>{x.allCatalog} →</Link>
          </div>
          <Grid items={s.rec} lang={l} x={x} />
          <div className="tl-home-top-heading">
            <h3>{s.topTitle}</h3>
            <Link className="btn" href={`${s.href}&filter=popular`}>{x.rating} →</Link>
          </div>
          <Grid items={s.top} lang={l} x={x} />
        </section>
      ))}

      <section className="tl-home-author-banner">
        <div>
          <h2>{x.ctaTitle}</h2>
          <p>{x.ctaText}</p>
        </div>
        <Link className="btn primary" href={`/${l}/author`}>{x.ctaBtn} →</Link>
      </section>
    </main>
  );
}
