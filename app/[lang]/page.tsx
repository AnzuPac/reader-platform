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

const TXT: Record<Lang, {
  eyebrow: string; heroTitle: string; heroText: string; discover: string; subscribe: string;
  continueReading: string; library: string; directions: string; directionsSub: string;
  booksTitle: string; booksText: string; fanficsTitle: string; fanficsText: string;
  mangaTitle: string; mangaText: string; allCatalog: string;
  rec: string; top: string; topBooks: string; topFanfics: string; topManga: string;
  rating: string; openCatalog: string; empty: string;
  ctaTitle: string; ctaText: string; ctaBtn: string;
  completed: string; ongoing: string;
}> = {
  sr: {
    eyebrow: 'TVOJA SLEDEĆA PRIČA', heroTitle: 'Svetovi u koje se vraćaš', heroText: 'Knjige, fanfikcija, manga i autorske priče. Nađi omiljeno, sakupi biblioteku i prati nove glave.',
    discover: 'Otvori katalog', subscribe: 'Pretplata',
    continueReading: 'Nastavi čitanje', library: 'Moja biblioteka',
    directions: 'Izaberi pravac', directionsSub: 'Tri kataloga · jedna platforma',
    booksTitle: 'Knjige', booksText: 'Originalne priče, klasici i samizdat.',
    fanficsTitle: 'Fanfikcija', fanficsText: 'Fandomi, AU, likovi i nova čitanja.',
    mangaTitle: 'Manga i stripovi', mangaText: 'Manga, manhva, vebtuni i stripovi.',
    allCatalog: 'Ceo katalog', rec: 'Preporuke', top: 'Top', topBooks: 'Top knjiga', topFanfics: 'Top fanfikcije', topManga: 'Top mange',
    rating: 'Rang', openCatalog: 'U katalog', empty: 'U ovom izboru još nema dela.',
    ctaTitle: 'Objavljuješ svoje priče?', ctaText: 'Autorski kabinet, statistika, čitaoci i isplate.', ctaBtn: 'Autorski kabinet',
    completed: 'Završeno', ongoing: 'U toku',
  },
  ru: {
    eyebrow: 'ТВОЯ СЛЕДУЮЩАЯ ИСТОРИЯ', heroTitle: 'Миры, в которые хочется возвращаться', heroText: 'Книги, фанфики, манга и авторские истории. Найди любимое, собери библиотеку и следи за новыми главами.',
    discover: 'Открыть каталог', subscribe: 'Подписка',
    continueReading: 'Продолжить чтение', library: 'Моя библиотека',
    directions: 'Выбери направление', directionsSub: 'Три каталога · одна платформа',
    booksTitle: 'Книги', booksText: 'Оригинальные истории, классика и самиздат.',
    fanficsTitle: 'Фанфики', fanficsText: 'Фандомы, AU, персонажи и новые прочтения.',
    mangaTitle: 'Манга и стрипы', mangaText: 'Манга, манхва, вебтуны и комиксы.',
    allCatalog: 'Весь каталог', rec: 'Рекомендации', top: 'Топ', topBooks: 'Топ книг', topFanfics: 'Топ фанфиков', topManga: 'Топ манги',
    rating: 'Рейтинг', openCatalog: 'В каталог', empty: 'В этой подборке пока нет произведений.',
    ctaTitle: 'Публикуешь свои истории?', ctaText: 'Авторский кабинет, статистика, читатели и выплаты.', ctaBtn: 'Кабинет автора',
    completed: 'Завершено', ongoing: 'В процессе',
  },
  en: {
    eyebrow: 'YOUR NEXT STORY', heroTitle: 'Worlds worth returning to', heroText: 'Books, fan fiction, manga and original stories. Find a favourite, build a library and follow new chapters.',
    discover: 'Open catalog', subscribe: 'Subscription',
    continueReading: 'Continue reading', library: 'My library',
    directions: 'Choose a direction', directionsSub: 'Three catalogs · one platform',
    booksTitle: 'Books', booksText: 'Original stories, classics and self-published.',
    fanficsTitle: 'Fan fiction', fanficsText: 'Fandoms, AUs, characters and fresh takes.',
    mangaTitle: 'Manga & comics', mangaText: 'Manga, manhwa, webtoons and comics.',
    allCatalog: 'Full catalog', rec: 'Recommended', top: 'Top', topBooks: 'Top books', topFanfics: 'Top fan fiction', topManga: 'Top manga',
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
  if (ai === 'no_ai') return { cls: 'ai', text: l === 'ru' ? '✓ БЕЗ ИИ' : l === 'en' ? '✓ NO AI' : '✓ BEZ AI' };
  if (ai === 'assisted') return { cls: 'ai assist', text: '✦ AI-ASSISTED' };
  return { cls: 'ai gen', text: '✦ AI CONTENT' };
}

function ProtoCard({ w, lang, x }: { w: Card; lang: Lang; x: (typeof TXT)[Lang] }) {
  const ai = aiLabel(w.ai_usage, lang);
  const rating = Number(w.rating_avg || 0);
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
          <span>{w.kind === 'fanfic' ? (lang === 'ru' ? 'Фанфик' : lang === 'en' ? 'Fanfic' : 'Fanfikcija') : w.type === 'comic' ? (lang === 'ru' ? 'Манга' : lang === 'en' ? 'Manga' : 'Manga') : (lang === 'ru' ? 'Книга' : lang === 'en' ? 'Book' : 'Knjiga')}</span>
          <span className="rating">★ {rating.toFixed(1)}</span>
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

  const [booksRec, booksTop, fanficRec, fanficTop, mangaRec, mangaTop] = await Promise.all([
    listWorks({ type: 'novel', fanfic: false, sort: 'new', limit: 5 }).catch(() => []),
    listWorks({ type: 'novel', fanfic: false, sort: 'views', limit: 5 }).catch(() => []),
    listWorks({ fanfic: true, sort: 'new', limit: 5 }).catch(() => []),
    listWorks({ fanfic: true, sort: 'views', limit: 5 }).catch(() => []),
    listWorks({ type: 'comic', sort: 'new', limit: 5 }).catch(() => []),
    listWorks({ type: 'comic', sort: 'views', limit: 5 }).catch(() => []),
  ]);

  const heroItems = [booksRec[0], fanficRec[0], mangaRec[0]].filter(Boolean) as Card[];

  const cat = (kind: 'book' | 'fanfic' | 'manga') => `/${l}/catalog?kind=${kind}`;

  const sections = [
    { key: 'books', title: x.booksTitle, emoji: '📚', rec: booksRec as Card[], top: booksTop as Card[], href: cat('book'), topTitle: x.topBooks },
    { key: 'fanfics', title: x.fanficsTitle, emoji: '✦', rec: fanficRec as Card[], top: fanficTop as Card[], href: cat('fanfic'), topTitle: x.topFanfics },
    { key: 'manga', title: x.mangaTitle, emoji: '▣', rec: mangaRec as Card[], top: mangaTop as Card[], href: cat('manga'), topTitle: x.topManga },
  ];

  return (
    <main id="main" className="shell">
      <section className="hero">
        <div>
          <div className="eyebrow">{x.eyebrow}</div>
          <h1>{session ? `${x.heroTitle}` : x.heroTitle}</h1>
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
              <button className="btn primary" style={{ marginTop: 14 }}>{l === 'ru' ? 'Продолжить' : l === 'en' ? 'Continue' : 'Nastavi'} →</button>
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
          <div className="panel">
            <div className="eyebrow">BOOKS</div>
            <h2>{x.booksTitle}</h2>
            <p className="muted" style={{ marginTop: 6 }}>{x.booksText}</p>
            <Link className="btn soft" style={{ marginTop: 12, display: 'inline-block' }} href={cat('book')}>{x.openCatalog} →</Link>
          </div>
          <div className="panel">
            <div className="eyebrow" style={{ color: '#9061c4' }}>FANFICTION</div>
            <h2>{x.fanficsTitle}</h2>
            <p className="muted" style={{ marginTop: 6 }}>{x.fanficsText}</p>
            <Link className="btn soft" style={{ marginTop: 12, display: 'inline-block' }} href={cat('fanfic')}>{x.openCatalog} →</Link>
          </div>
          <div className="panel">
            <div className="eyebrow" style={{ color: '#df843b' }}>COMICS</div>
            <h2>{x.mangaTitle}</h2>
            <p className="muted" style={{ marginTop: 6 }}>{x.mangaText}</p>
            <Link className="btn soft" style={{ marginTop: 12, display: 'inline-block' }} href={cat('manga')}>{x.openCatalog} →</Link>
          </div>
        </div>
      </div>

      {sections.map((s) => (
        <div key={s.key} className="section">
          <div className="sectionhead">
            <h2>{s.emoji} {s.title} · {x.rec}</h2>
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
