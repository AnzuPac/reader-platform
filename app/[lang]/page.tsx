import Link from 'next/link';
import { isLang, t, type Lang } from '@/lib/i18n';
import { readSession } from '@/lib/auth';
import { listWorks, getContinueReading } from '@/lib/repo';

export const dynamic = 'force-dynamic';

type Card = {
  id: number; slug: string; title: string; author_name: string;
  cover_path: string | null; rating_avg: string; completion: string;
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
  eyebrow: string; heroTitle: string; heroText: string; discover: string; subscribe: string;
  continueReading: string; library: string; directions: string; directionsSub: string;
  pubTitle: string; pubText: string; selfTitle: string; selfText: string;
  fanTitle: string; fanText: string; graphicTitle: string; graphicText: string;
  allCatalog: string; rec: string; top: string; topPub: string; topSelf: string; topFan: string; topGraphic: string;
  rating: string; openCatalog: string; empty: string;
  ctaTitle: string; ctaText: string; ctaBtn: string; completed: string; ongoing: string;
}> = {
  sr: {
    eyebrow: 'TVOJA SLEDEĆA PRIČA', heroTitle: 'Svetovi u koje se vraćaš', heroText: 'Knjige izdavača, samizdat, fanfikcija i grafička literatura. Nađi omiljeno, sakupi biblioteku i prati nove glave.',
    discover: 'Otvori katalog', subscribe: 'Pretplata', continueReading: 'Nastavi čitanje', library: 'Moja biblioteka',
    directions: 'Izaberi pravac', directionsSub: 'Četiri kataloga · jedna platforma',
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
    eyebrow: 'ТВОЯ СЛЕДУЮЩАЯ ИСТОРИЯ', heroTitle: 'Миры, в которые хочется возвращаться', heroText: 'Книги издательств, самиздат, фанфики и графическая литература. Найди любимое, собери библиотеку и следи за новыми главами.',
    discover: 'Открыть каталог', subscribe: 'Подписка', continueReading: 'Продолжить чтение', library: 'Моя библиотека',
    directions: 'Выбери направление', directionsSub: 'Четыре каталога · одна платформа',
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
    eyebrow: 'YOUR NEXT STORY', heroTitle: 'Worlds worth returning to', heroText: 'Publisher books, self-published works, fan fiction and graphic literature. Find a favourite, build a library and follow new chapters.',
    discover: 'Open catalog', subscribe: 'Subscription', continueReading: 'Continue reading', library: 'My library',
    directions: 'Choose a direction', directionsSub: 'Four catalogs · one platform',
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
  const ai = aiLabel(w.ai_usage, lang);
  return (
    <Link href={`/${lang}/work/${w.slug}`} className="book" style={{ display: 'block' }}>
      <div className={`cover ${tone(w)}`}>
        {ai ? <span className={ai.cls}>{ai.text}</span> : null}
        <span className="tiny">TEROLIBRARY</span>
        <span className="cover-title">{w.title}</span>
        <span className="cover-author">{w.author_name}</span>
      </div>
      <div className="bookbody">
        <div className="meta">
          <span>{w.kind === 'fanfic' ? (lang === 'ru' ? 'Фанфик' : lang === 'en' ? 'Fanfic' : 'Fanfikcija') : w.type === 'comic' ? (lang === 'ru' ? 'Графика' : lang === 'en' ? 'Graphic' : 'Grafika') : (lang === 'ru' ? 'Книга' : lang === 'en' ? 'Book' : 'Knjiga')}</span>
          <span className="rating">★ {Number(w.rating_avg || 0).toFixed(1)}</span>
        </div>
        <h3>{w.title}</h3>
        <div className="author">{w.author_name}</div>
        <div className="tags">
          <span className="status">{w.completion === 'completed' ? x.completed : x.ongoing}</span>
        </div>
      </div>
    </Link>
  );
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
  const cont = session ? await getContinueReading(session.uid).catch(() => null) : null;

  const [pubRec, pubTop, selfRec, selfTop, fanRec, fanTop, graphicRec, graphicTop] = await Promise.all([
    listWorks({ type: 'novel', source: 'publisher', sort: 'new', limit: 5 }).catch(() => []),
    listWorks({ type: 'novel', source: 'publisher', sort: 'views', limit: 5 }).catch(() => []),
    listWorks({ type: 'novel', source: 'selfpub', sort: 'new', limit: 5 }).catch(() => []),
    listWorks({ type: 'novel', source: 'selfpub', sort: 'views', limit: 5 }).catch(() => []),
    listWorks({ fanfic: true, sort: 'new', limit: 5 }).catch(() => []),
    listWorks({ fanfic: true, sort: 'views', limit: 5 }).catch(() => []),
    listWorks({ type: 'comic', sort: 'new', limit: 5 }).catch(() => []),
    listWorks({ type: 'comic', sort: 'views', limit: 5 }).catch(() => []),
  ]);

  const heroItems = [pubRec[0], selfRec[0], fanRec[0]].filter(Boolean) as Card[];

  const sections = [
    { key: 'publisher', title: x.pubTitle, rec: pubRec as Card[], top: pubTop as Card[], href: `/${l}/catalog?kind=publisher`, color: COLORS.publisher, topTitle: x.topPub },
    { key: 'selfpub', title: x.selfTitle, rec: selfRec as Card[], top: selfTop as Card[], href: `/${l}/catalog?kind=selfpub`, color: COLORS.selfpub, topTitle: x.topSelf },
    { key: 'fanfic', title: x.fanTitle, rec: fanRec as Card[], top: fanTop as Card[], href: `/${l}/catalog?kind=fanfic`, color: COLORS.fanfic, topTitle: x.topFan },
    { key: 'graphic', title: x.graphicTitle, rec: graphicRec as Card[], top: graphicTop as Card[], href: `/${l}/catalog?kind=comic`, color: COLORS.graphic, topTitle: x.topGraphic },
  ];

  return (
    <main id="main" className="shell">
      <section className="hero">
        <div>
          <div className="eyebrow">{x.eyebrow}</div>
          <h1>{x.heroTitle}</h1>
          <p>{x.heroText}</p>
          <Link className="btn primary" href={`/${l}/catalog`}>{x.discover} →</Link>{' '}
          <Link className="btn" href={`/${l}/subscribe`}>{x.subscribe}</Link>
        </div>
        <div className="heroart" aria-hidden="true">
          {heroItems.map((w) => (
            <div key={w.id} className={`cover ${tone(w)}`}>
              <span className="tiny">TEROLIBRARY</span>
              <span className="cover-title">{w.title}</span>
              <span className="cover-author">{w.author_name}</span>
            </div>
          ))}
        </div>
      </section>

      {cont ? (
        <div className="section">
          <div className="sectionhead">
            <h2>{x.continueReading}</h2>
            <Link className="btn" href={`/${l}/library`}>{x.library} →</Link>
          </div>
          <div className="grid4">
            <Link href={`/${l}/read/${cont.chapter_id}`} className="panel" style={{ display: 'block' }}>
              <div className="eyebrow">{x.continueReading} · {cont.percent}%</div>
              <h2 style={{ marginTop: 8 }}>{cont.work_title}</h2>
              <p className="muted" style={{ marginTop: 6 }}>
                {cont.chapter_title || `${l === 'ru' ? 'Глава' : l === 'en' ? 'Chapter' : 'Glava'} ${cont.number}`}
              </p>
              <span className="btn primary" style={{ marginTop: 14, display: 'inline-block' }}>{l === 'ru' ? 'Продолжить' : l === 'en' ? 'Continue' : 'Nastavi'} →</span>
            </Link>
          </div>
        </div>
      ) : null}

      <div className="section">
        <div className="sectionhead">
          <h2>{x.directions}</h2>
          <span className="muted">{x.directionsSub}</span>
        </div>
        <div className="grid4">
          {sections.map((s) => (
            <div key={s.key} className="panel" style={{ borderTop: `3px solid ${s.color.line}` }}>
              <div className="eyebrow" style={{ color: s.color.fg }}>{s.key === 'publisher' ? 'PUBLISHERS' : s.key === 'selfpub' ? 'SELF-PUBLISHED' : s.key === 'fanfic' ? 'FANFICTION' : 'GRAPHIC LITERATURE'}</div>
              <h2>{s.title}</h2>
              <p className="muted" style={{ marginTop: 6 }}>{s.key === 'publisher' ? x.pubText : s.key === 'selfpub' ? x.selfText : s.key === 'fanfic' ? x.fanText : x.graphicText}</p>
              <Link className="btn soft" style={{ marginTop: 12, display: 'inline-block' }} href={s.href}>{x.openCatalog} →</Link>
            </div>
          ))}
        </div>
      </div>

      {sections.map((s) => (
        <div key={s.key} className="section">
          <div className="sectionhead">
            <h2 style={{ color: s.color.fg }}>{s.title} · {x.rec}</h2>
            <Link className="btn" href={s.href}>{x.allCatalog} →</Link>
          </div>
          <Grid items={s.rec} lang={l} x={x} />
          <div className="sectionhead" style={{ marginTop: 22 }}>
            <h3>{s.topTitle}</h3>
            <Link className="btn" href={`${s.href}&filter=popular`}>{x.rating} →</Link>
          </div>
          <Grid items={s.top} lang={l} x={x} />
        </div>
      ))}

      <div className="section banner">
        <div>
          <h2>{x.ctaTitle}</h2>
          <p>{x.ctaText}</p>
        </div>
        <Link className="btn primary" href={`/${l}/author`}>{x.ctaBtn} →</Link>
      </div>
    </main>
  );
}
