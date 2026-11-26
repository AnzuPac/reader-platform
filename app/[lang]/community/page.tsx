import Link from 'next/link';
import { isLang, type Lang } from '@/lib/i18n';
import { readSession } from '@/lib/auth';
import { listWorks } from '@/lib/repo';
import { listCollections } from '@/lib/collections';
import { newChaptersFromFollowed } from '@/lib/follows';

export const dynamic = 'force-dynamic';

type Copy = {
  kicker: string; title: string; lead: string; browse: string; collections: string; authors: string; publishers: string;
  feed: string; feedLead: string; following: string; followingLead: string; fresh: string; freshLead: string;
  popular: string; popularLead: string; curated: string; allCollections: string; allWorks: string;
  noFollowing: string; noFollowingAction: string; noCollections: string; chapters: string; open: string;
  views: string; collection: string; items: string; communityActions: string;
};
const COPY: Record<Lang, Copy> = {
  ru: {
    kicker: 'СООБЩЕСТВО TEROLIBRARY', title: 'Читайте. Создавайте. Находите своих.',
    lead: 'Открывайте новые произведения, собирайте подборки, следите за авторами и обсуждайте истории с читателями.',
    browse: 'Каталог', collections: 'Коллекции', authors: 'Авторам', publishers: 'Издательствам',
    feed: 'Лента подписок', feedLead: 'Новые главы авторов, на которых вы подписаны', following: 'Новые главы', followingLead: 'Обновления из вашей библиотеки авторов',
    fresh: 'Недавно опубликовано', freshLead: 'Новые истории на TeroLibrary', popular: 'Сейчас читают', popularLead: 'Популярные произведения каталога',
    curated: 'Подборки читателей', allCollections: 'Все коллекции', allWorks: 'Весь каталог',
    noFollowing: 'Пока нет новых глав от авторов, на которых вы подписаны.', noFollowingAction: 'Найти авторов', noCollections: 'Публичных подборок пока нет.',
    chapters: 'глав', open: 'Открыть', views: 'прочтений', collection: 'Коллекция', items: 'произведений', communityActions: 'Быстрые переходы',
  },
  sr: {
    kicker: 'TEROLIBRARY ZAJEDNICA', title: 'Čitajte. Stvarajte. Pronađite svoje.',
    lead: 'Otkrijte nova dela, pravite kolekcije, pratite autore i razgovarajte o pričama sa čitaocima.',
    browse: 'Katalog', collections: 'Kolekcije', authors: 'Za autore', publishers: 'Izdavači',
    feed: 'Novosti iz praćenja', feedLead: 'Nova poglavlja autora koje pratite', following: 'Nova poglavlja', followingLead: 'Novosti iz vaše autorske biblioteke',
    fresh: 'Nedavno objavljeno', freshLead: 'Nove priče na TeroLibrary', popular: 'Trenutno se čita', popularLead: 'Popularna dela iz kataloga',
    curated: 'Kolekcije čitalaca', allCollections: 'Sve kolekcije', allWorks: 'Ceo katalog',
    noFollowing: 'Još nema novih poglavlja autora koje pratite.', noFollowingAction: 'Pronađi autore', noCollections: 'Još nema javnih kolekcija.',
    chapters: 'poglavlja', open: 'Otvori', views: 'čitanja', collection: 'Kolekcija', items: 'dela', communityActions: 'Brzi pristup',
  },
  en: {
    kicker: 'TEROLIBRARY COMMUNITY', title: 'Read. Create. Find your people.',
    lead: 'Discover new works, curate collections, follow authors and discuss stories with other readers.',
    browse: 'Catalogue', collections: 'Collections', authors: 'For authors', publishers: 'For publishers',
    feed: 'Following feed', feedLead: 'New chapters from authors you follow', following: 'New chapters', followingLead: 'Updates from your followed authors',
    fresh: 'Recently published', freshLead: 'New stories on TeroLibrary', popular: 'Readers are enjoying', popularLead: 'Popular works from the catalogue',
    curated: 'Reader collections', allCollections: 'All collections', allWorks: 'Full catalogue',
    noFollowing: 'There are no new chapters from authors you follow yet.', noFollowingAction: 'Discover authors', noCollections: 'No public collections yet.',
    chapters: 'chapters', open: 'Open', views: 'reads', collection: 'Collection', items: 'works', communityActions: 'Quick access',
  },
};

export default async function CommunityPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const c = COPY[l];
  const session = await readSession().catch(() => null);
  const viewer = session ? { uid: session.uid, role: session.role } : null;
  const [updates, freshWorks, popularWorks, collections] = await Promise.all([
    session ? newChaptersFromFollowed(session.uid, 45, 12).catch(() => []) : Promise.resolve([]),
    listWorks({ sort: 'new', limit: 8 }).catch(() => []),
    listWorks({ sort: 'views', limit: 6 }).catch(() => []),
    listCollections(viewer).then((rows) => rows.filter((row) => row.is_public === true || row.is_public === 1).slice(0, 6)).catch(() => []),
  ]);

  return (
    <main id="main" className="tl-screen tlp-stage8-community tlp-community-page mx-auto max-w-6xl px-5 py-10">
      <header className="tlp-stage8-community-hero">
        <p className="tlp-stage8-kicker">{c.kicker}</p>
        <h1>{c.title}</h1>
        <p>{c.lead}</p>
      </header>

      <section className="tlp-community-actions" aria-label={c.communityActions}>
        <Link href={`/${l}/catalog`}><span>⌕</span><strong>{c.browse}</strong><small>{l === 'ru' ? 'Ищите книги, фанфики и графику' : l === 'en' ? 'Find books, fan fiction and graphic stories' : 'Pronađite knjige, fanfikciju i grafiku'}</small><b>↗</b></Link>
        <Link href={`/${l}/collections`}><span>▤</span><strong>{c.collections}</strong><small>{l === 'ru' ? 'Подборки по интересам' : l === 'en' ? 'Curated reading lists' : 'Tematske liste za čitanje'}</small><b>↗</b></Link>
        <Link href={`/${l}/author`}><span>✎</span><strong>{c.authors}</strong><small>{l === 'ru' ? 'Публикуйте и развивайте истории' : l === 'en' ? 'Publish and grow your stories' : 'Objavljujte i razvijajte priče'}</small><b>↗</b></Link>
        <Link href={`/${l}/publishers`}><span>▥</span><strong>{c.publishers}</strong><small>{l === 'ru' ? 'Издательские проекты и партнёрство' : l === 'en' ? 'Publishing and partnerships' : 'Izdavaštvo i saradnja'}</small><b>↗</b></Link>
      </section>

      <div className="tlp-community-grid">
        <div className="tlp-community-main-column">
          <section className="tlp-community-panel">
            <div className="tlp-community-section-heading"><div><h2>{c.feed}</h2><p>{c.feedLead}</p></div><span className="tlp-community-count">{updates.length}</span></div>
            {session && updates.length ? (
              <div className="tlp-community-feed-list">
                {updates.map((item) => (
                  <article key={item.chapter_id} className="tlp-community-feed-item">
                    <span className="tlp-community-feed-icon">↗</span>
                    <div><strong><Link href={`/${l}/work/${item.slug}`}>{item.title}</Link></strong><p>{item.author_name} · {item.chapter_title || `${l === 'ru' ? 'Глава' : l === 'en' ? 'Chapter' : 'Glava'} ${item.number}`}</p></div>
                    <Link className="btn btn-ghost" href={`/${l}/read/${item.chapter_id}`}>{c.open}</Link>
                  </article>
                ))}
              </div>
            ) : (
              <div className="tlp-community-empty"><p>{session ? c.noFollowing : (l === 'ru' ? 'Войди, чтобы видеть новые главы авторов, на которых ты подписан.' : l === 'en' ? 'Sign in to see new chapters from authors you follow.' : 'Prijavite se da biste videli nova poglavlja autora koje pratite.')}</p><Link className="btn btn-primary" href={session ? `/${l}/catalog` : `/${l}/login`}>{session ? c.noFollowingAction : (l === 'ru' ? 'Войти' : l === 'en' ? 'Sign in' : 'Prijava')}</Link></div>
            )}
          </section>

          <section className="tlp-community-panel">
            <div className="tlp-community-section-heading"><div><h2>{c.fresh}</h2><p>{c.freshLead}</p></div><Link href={`/${l}/catalog?filter=fresh`}>{c.allWorks} →</Link></div>
            <div className="tlp-community-work-list">
              {freshWorks.map((work) => (
                <Link key={work.id} href={`/${l}/work/${work.slug}`} className="tlp-community-work-item">
                  <span className={`tlp-community-work-cover ${work.kind === 'fanfic' ? 'is-fanfic' : work.type === 'comic' ? 'is-graphic' : ''}`}>
                    {work.cover_path ? <img src={work.cover_path} alt="" loading="lazy" decoding="async" /> : <span>▤</span>}
                  </span>
                  <span className="tlp-community-work-copy"><strong>{work.title}</strong><small>{work.author_name}</small><span>★ {Number(work.rating_avg || 0).toFixed(1)}</span></span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <aside className="tlp-community-side-column">
          <section className="tlp-community-panel">
            <div className="tlp-community-section-heading"><div><h2>{c.popular}</h2><p>{c.popularLead}</p></div></div>
            <ol className="tlp-community-popular-list">
              {popularWorks.map((work, index) => <li key={work.id}><span>{String(index + 1).padStart(2, '0')}</span><div><Link href={`/${l}/work/${work.slug}`}>{work.title}</Link><small>{work.author_name} · {Number(work.views_total || 0).toLocaleString(l === 'ru' ? 'ru-RU' : l === 'en' ? 'en-GB' : 'sr-Latn-RS')} {c.views}</small></div></li>)}
            </ol>
          </section>
          <section className="tlp-community-panel">
            <div className="tlp-community-section-heading"><div><h2>{c.curated}</h2></div><Link href={`/${l}/collections`}>{c.allCollections} →</Link></div>
            {collections.length ? <div className="tlp-community-collection-list">{collections.map((item) => <Link key={item.id} href={`/${l}/collections/${item.slug}`}><span className="tlp-community-collection-icon">▤</span><span><strong>{item.title}</strong><small>{item.items_count ?? 0} {c.items}</small></span><b>↗</b></Link>)}</div> : <p className="tlp-community-empty-text">{c.noCollections}</p>}
          </section>
        </aside>
      </div>
    </main>
  );
}
