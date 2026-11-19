import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLang, type Lang } from '@/lib/i18n';
import { readSession } from '@/lib/auth';
import { getProfile, canViewProfile } from '@/lib/profiles';
import { followerCount, isFollowing } from '@/lib/follows';
import FollowButton from '@/components/FollowButton';
import {
  getPrivacy, getUserCard, getStats, getHistory, getBookmarks,
  getAchievements, getFavoriteGenres, getSubscription, getPublicCollections,
} from '@/lib/reader-profile';

export const dynamic = 'force-dynamic';

type Tab = 'overview' | 'library' | 'history' | 'bookmarks' | 'achievements' | 'about';
const TABS: Tab[] = ['overview', 'library', 'history', 'bookmarks', 'achievements', 'about'];

const TXT: Record<Lang, Record<string, string>> = {
  sr: {
    overview: 'Pregled', library: 'Biblioteka', history: 'Istorija', bookmarks: 'Zabeleške',
    achievements: 'Dostignuća', about: 'O meni', reader: 'Čitalac', since: 'Na platformi od',
    edit: 'Uredi profil', follow: 'Zaprati', unfollow: 'Otprati',
    statsChapters: 'Poglavlja', statsWorks: 'Dela', statsBookmarks: 'Zabeleške', statsAchievements: 'Dostignuća',
    continueReading: 'Nastavi čitanje', recentHistory: 'Nedavno čitano', noHistory: 'Još nema istorije čitanja.',
    noBookmarks: 'Još nema zabeleški.', noAchievements: 'Dostignuća se otključavaju čitanjem.',
    favoriteGenres: 'Omiljeni žanrovi', noGenres: 'Žanrovi se pojavljuju posle prvih poglavlja.',
    mySubscription: 'Moja pretplata', noSubscription: 'Bez pretplate', manage: 'Upravljaj pretplatom',
    statusActive: 'aktivna', statusCanceled: 'otkazana', statusExpired: 'istekla', statusPastDue: 'dospeće',
    until: 'do', autoRenew: 'automatsko obnavljanje',
    privateProfile: 'Ovaj profil je privatan.', privateSection: 'Ovaj deo profila je privatan.',
    libraryReading: 'Čitam', libraryWant: 'U planu', libraryDone: 'Pročitano', libraryFavorite: 'Omiljeno',
    libraryPostponed: 'Odloženo', libraryDropped: 'Napušteno',
    openLibrary: 'Otvori biblioteku', collections: 'Kolekcije', noCollections: 'Javnih kolekcija nema.',
    achievementsEarned: 'Otključeno', achievementsLocked: 'Zaključano', progress: 'napredak',
    open: 'Otvori', toCatalog: 'U katalog', privacyNote: 'Neke sekcije su skrivene prema podešavanjima privatnosti.',
    share: 'Podeli', copy: 'Kopiraj link', openWork: 'Otvori delo',
  },
  ru: {
    overview: 'Обзор', library: 'Библиотека', history: 'История', bookmarks: 'Закладки',
    achievements: 'Достижения', about: 'Обо мне', reader: 'Читатель', since: 'На платформе с',
    edit: 'Редактировать профиль', follow: 'Подписаться', unfollow: 'Отписаться',
    statsChapters: 'Главы', statsWorks: 'Произведения', statsBookmarks: 'Закладки', statsAchievements: 'Достижения',
    continueReading: 'Продолжить чтение', recentHistory: 'Недавно прочитано', noHistory: 'Истории чтения пока нет.',
    noBookmarks: 'Закладок пока нет.', noAchievements: 'Достижения открываются чтением.',
    favoriteGenres: 'Любимые жанры', noGenres: 'Жанры появятся после первых глав.',
    mySubscription: 'Моя подписка', noSubscription: 'Без подписки', manage: 'Управлять подпиской',
    statusActive: 'активна', statusCanceled: 'отменена', statusExpired: 'истекла', statusPastDue: 'просрочена',
    until: 'до', autoRenew: 'автопродление',
    privateProfile: 'Этот профиль приватный.', privateSection: 'Этот раздел профиля приватный.',
    libraryReading: 'Читаю', libraryWant: 'В планах', libraryDone: 'Прочитано', libraryFavorite: 'Любимое',
    libraryPostponed: 'Отложено', libraryDropped: 'Брошено',
    openLibrary: 'Открыть библиотеку', collections: 'Коллекции', noCollections: 'Публичных коллекций нет.',
    achievementsEarned: 'Открыто', achievementsLocked: 'Закрыто', progress: 'прогресс',
    open: 'Открыть', toCatalog: 'В каталог', privacyNote: 'Некоторые разделы скрыты настройками приватности.',
    share: 'Поделиться', copy: 'Скопировать ссылку', openWork: 'Открыть произведение',
  },
  en: {
    overview: 'Overview', library: 'Library', history: 'History', bookmarks: 'Bookmarks',
    achievements: 'Achievements', about: 'About', reader: 'Reader', since: 'On the platform since',
    edit: 'Edit profile', follow: 'Follow', unfollow: 'Unfollow',
    statsChapters: 'Chapters', statsWorks: 'Works', statsBookmarks: 'Bookmarks', statsAchievements: 'Achievements',
    continueReading: 'Continue reading', recentHistory: 'Recently read', noHistory: 'No reading history yet.',
    noBookmarks: 'No bookmarks yet.', noAchievements: 'Achievements unlock through reading.',
    favoriteGenres: 'Favourite genres', noGenres: 'Genres appear after the first chapters.',
    mySubscription: 'My subscription', noSubscription: 'No subscription', manage: 'Manage subscription',
    statusActive: 'active', statusCanceled: 'canceled', statusExpired: 'expired', statusPastDue: 'past due',
    until: 'until', autoRenew: 'auto-renew',
    privateProfile: 'This profile is private.', privateSection: 'This profile section is private.',
    libraryReading: 'Reading', libraryWant: 'Planned', libraryDone: 'Completed', libraryFavorite: 'Favourite',
    libraryPostponed: 'Postponed', libraryDropped: 'Dropped',
    openLibrary: 'Open library', collections: 'Collections', noCollections: 'No public collections.',
    achievementsEarned: 'Unlocked', achievementsLocked: 'Locked', progress: 'progress',
    open: 'Open', toCatalog: 'To catalog', privacyNote: 'Some sections are hidden by privacy settings.',
    share: 'Share', copy: 'Copy link', openWork: 'Open work',
  },
};

function fmtDate(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-GB' : 'sr-RS', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatusLabel(status: string, t: Record<string, string>): string {
  if (status === 'active') return t.statusActive;
  if (status === 'canceled') return t.statusCanceled;
  if (status === 'expired') return t.statusExpired;
  if (status === 'past_due') return t.statusPastDue;
  return status;
}

export default async function UserProfilePage({
  params, searchParams,
}: {
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang, id } = await params;
  const sp = await searchParams;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const t = TXT[l];
  const tabRaw = typeof sp.tab === 'string' ? sp.tab : 'overview';
  const tab = (TABS.includes(tabRaw as Tab) ? tabRaw : 'overview') as Tab;

  const userId = Number(id);
  if (!Number.isFinite(userId) || userId <= 0) notFound();

  const session = await readSession();
  const base = await getProfile(userId);
  if (!base) notFound();

  const privacy = await getPrivacy(userId);
  const isMe = session?.uid === userId;
  const isStaff = session?.role === 'admin' || session?.role === 'moderator';
  const allowed = privacy.publicProfile || isMe || isStaff || canViewProfile(base, session ? { uid: session.uid, role: session.role } : null);

  const card = await getUserCard(userId);
  if (!card) notFound();

  if (!allowed) {
    return (
      <main id="main" className="shell">
        <div className="panel" style={{ textAlign: 'center', padding: 40 }}>
          <h1 style={{ marginBottom: 8 }}>{card.name}</h1>
          <p className="muted">{t.privateProfile}</p>
        </div>
      </main>
    );
  }

  const showHistory = isMe || privacy.showHistory;
  const showLibrary = isMe || privacy.showLibrary;
  const showBookmarks = isMe || privacy.showBookmarks;
  const showAchievements = isMe || privacy.showAchievements;
  const showGenres = isMe || privacy.showGenres;

  const [stats, history, bookmarks, achievements, genres, subscription, collections] = await Promise.all([
    getStats(userId),
    showHistory ? getHistory(userId, 20) : Promise.resolve([]),
    showBookmarks ? getBookmarks(userId, 50) : Promise.resolve([]),
    showAchievements ? getAchievements(userId, l) : Promise.resolve([]),
    showGenres ? getFavoriteGenres(userId, 5) : Promise.resolve([]),
    isMe ? getSubscription(userId) : Promise.resolve(null),
    getPublicCollections(userId),
  ]);

  const following = session && !isMe ? await isFollowing(session.uid, userId).catch(() => false) : false;
  const followers = await followerCount(userId).catch(() => 0);
  const earned = achievements.filter((a) => a.unlockedAt);
  const locked = achievements.filter((a) => !a.unlockedAt);
  const continueItem = history[0];

  const tabHref = (x: Tab) => `/${l}/u/${userId}${x === 'overview' ? '' : `?tab=${x}`}`;

  return (
    <main id="main" className="shell">
      <section className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          height: 160,
          background: card.cover
            ? `url(${card.cover}) center/cover no-repeat`
            : 'linear-gradient(110deg,#e8edf4,#ffffff 70%)',
          borderBottom: '1px solid var(--tlp-line)',
        }} />
        <div style={{ display: 'flex', gap: 20, padding: 22, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{
            width: 96, height: 96, borderRadius: '50%', overflow: 'hidden', marginTop: -60,
            border: '4px solid var(--tlp-panel)', background: 'var(--tlp-soft)',
            display: 'grid', placeItems: 'center', fontSize: 34, fontWeight: 800, color: 'var(--tlp-a)',
          }}>
            {card.avatar
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={card.avatar} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : card.name.slice(0, 1).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0 }}>{card.name}</h1>
              <span className="tag">{t.reader}</span>
            </div>
            <p className="muted" style={{ marginTop: 6 }}>{t.since} {fmtDate(card.createdAt, l)} · {followers} {l === 'ru' ? 'подписчиков' : l === 'en' ? 'followers' : 'pratilaca'}</p>
            {card.bio ? <p style={{ marginTop: 10, maxWidth: 620 }}>{card.bio}</p> : null}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isMe ? (
              <Link className="btn primary" href={`/${l}/account`}>{t.edit}</Link>
            ) : session ? (
              <FollowButton authorId={userId} initialFollowing={Boolean(following)} initialFollowers={followers} lang={l} />
            ) : null}
          </div>
        </div>
      </section>

      <nav className="subnav" style={{ marginTop: 18, width: '100%', overflowX: 'auto' }} aria-label="Profile tabs">
        {TABS.map((x) => (
          <Link key={x} href={tabHref(x)} className={tab === x ? 'active' : ''} style={{ textDecoration: 'none' }}>
            {t[x]}
          </Link>
        ))}
      </nav>

      {!isMe && (!showHistory || !showLibrary || !showBookmarks || !showAchievements || !showGenres) ? (
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t.privacyNote}</p>
      ) : null}

      {tab === 'overview' ? (
        <>
          <div className="statrow section">
            <div className="stat"><strong>{stats.chapters}</strong><span>{t.statsChapters}</span></div>
            <div className="stat"><strong>{stats.works}</strong><span>{t.statsWorks}</span></div>
            <div className="stat"><strong>{stats.bookmarks}</strong><span>{t.statsBookmarks}</span></div>
            <div className="stat"><strong>{earned.length}</strong><span>{t.statsAchievements}</span></div>
          </div>

          <div className="split section">
            <div className="stack">
              {showHistory ? (
                <div className="panel">
                  <div className="sectionhead"><h2>{t.continueReading}</h2><Link className="btn" href={`/${l}/library`}>{t.openLibrary} →</Link></div>
                  {continueItem ? (
                    <Link href={continueItem.chapterId ? `/${l}/read/${continueItem.chapterId}` : `/${l}/work/${continueItem.slug}`} className="book" style={{ display: 'flex', gap: 14, textDecoration: 'none', padding: 10 }}>
                      <div className="cover blue" style={{ width: 84, minWidth: 84 }}>
                        <span className="tiny">TEROLIBRARY</span>
                        <span className="cover-title" style={{ fontSize: 13 }}>{continueItem.title}</span>
                      </div>
                      <div>
                        <h3>{continueItem.title}</h3>
                        <p className="muted">{continueItem.author}</p>
                        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {continueItem.chapterTitle || ''} · {Math.round(continueItem.percent)}%
                        </p>
                      </div>
                    </Link>
                  ) : <p className="muted">{t.noHistory}</p>}
                </div>
              ) : null}

              {showHistory ? (
                <div className="panel">
                  <div className="sectionhead"><h2>{t.recentHistory}</h2><Link className="btn" href={tabHref('history')}>{t.open} →</Link></div>
                  {history.slice(0, 5).length ? (
                    <div className="grid4">
                      {history.slice(0, 5).map((h) => (
                        <Link key={h.workId} href={h.chapterId ? `/${l}/read/${h.chapterId}` : `/${l}/work/${h.slug}`} className="book" style={{ display: 'block' }}>
                          <div className="cover blue">
                            <span className="tiny">TEROLIBRARY</span>
                            <span className="cover-title">{h.title}</span>
                            <span className="cover-author">{h.author}</span>
                          </div>
                          <div className="bookbody">
                            <div className="meta"><span>{fmtDate(h.updatedAt, l)}</span><span className="rating">{Math.round(h.percent)}%</span></div>
                            <h3>{h.title}</h3>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : <p className="muted">{t.noHistory}</p>}
                </div>
              ) : null}
            </div>

            <div className="stack">
              {showBookmarks ? (
                <div className="panel">
                  <div className="sectionhead"><h2>{t.bookmarks}</h2><Link className="btn" href={tabHref('bookmarks')}>{t.open} →</Link></div>
                  {bookmarks.length ? bookmarks.slice(0, 4).map((b) => (
                    <Link key={b.id} href={`/${l}/read/${b.chapterId}`} style={{ display: 'block', padding: '8px 0', borderBottom: '1px solid var(--tlp-line)' }}>
                      <strong>{b.title}</strong>
                      <p className="muted" style={{ fontSize: 12 }}>{b.chapterTitle || ''} {b.note ? `· ${b.note}` : ''}</p>
                    </Link>
                  )) : <p className="muted">{t.noBookmarks}</p>}
                </div>
              ) : null}

              {showAchievements ? (
                <div className="panel">
                  <div className="sectionhead"><h2>{t.achievements}</h2><Link className="btn" href={tabHref('achievements')}>{t.open} →</Link></div>
                  {earned.length ? (
                    <div className="chips">
                      {earned.slice(0, 6).map((a) => <span key={a.key} className="chip selected" title={a.description}>{a.icon} {a.title}</span>)}
                    </div>
                  ) : <p className="muted">{t.noAchievements}</p>}
                </div>
              ) : null}

              {showGenres ? (
                <div className="panel">
                  <h2>{t.favoriteGenres}</h2>
                  {genres.length ? (
                    <div className="chips" style={{ marginTop: 10 }}>
                      {genres.map((g) => <Link key={g.slug} className="chip" href={`/${l}/catalog?genre=${g.slug}`}>{g.name} · {g.count}</Link>)}
                    </div>
                  ) : <p className="muted" style={{ marginTop: 8 }}>{t.noGenres}</p>}
                </div>
              ) : null}

              {isMe ? (
                <div className="panel">
                  <h2>{t.mySubscription}</h2>
                  {subscription ? (
                    <>
                      <p style={{ marginTop: 8 }}><strong>{subscription.planName}</strong> · {StatusLabel(subscription.status, t)}</p>
                      <p className="muted" style={{ fontSize: 12 }}>{t.until} {fmtDate(subscription.periodEnd, l)}{subscription.autoRenew ? ` · ${t.autoRenew}` : ''}</p>
                      <Link className="btn" style={{ marginTop: 10, display: 'inline-block' }} href={`/${l}/subscribe`}>{t.manage} →</Link>
                    </>
                  ) : (
                    <>
                      <p className="muted" style={{ marginTop: 8 }}>{t.noSubscription}</p>
                      <Link className="btn primary" style={{ marginTop: 10, display: 'inline-block' }} href={`/${l}/subscribe`}>{t.manage} →</Link>
                    </>
                  )}
                </div>
              ) : null}

              {collections.length ? (
                <div className="panel">
                  <h2>{t.collections}</h2>
                  <div className="chips" style={{ marginTop: 10 }}>
                    {collections.map((c) => <Link key={c.slug} className="chip" href={`/${l}/collections/${c.slug}`}>{c.title}</Link>)}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      {tab === 'library' ? (
        <section className="section">
          {showLibrary ? (
            <div className="panel">
              <h2>{t.library}</h2>
              <div className="statrow" style={{ marginTop: 14 }}>
                <div className="stat"><strong>{stats.library.reading || 0}</strong><span>{t.libraryReading}</span></div>
                <div className="stat"><strong>{stats.library.want || 0}</strong><span>{t.libraryWant}</span></div>
                <div className="stat"><strong>{stats.library.done || 0}</strong><span>{t.libraryDone}</span></div>
                <div className="stat"><strong>{stats.library.favorite || 0}</strong><span>{t.libraryFavorite}</span></div>
              </div>
              <Link className="btn primary" style={{ marginTop: 14, display: 'inline-block' }} href={`/${l}/library`}>{t.openLibrary} →</Link>
            </div>
          ) : <p className="muted">{t.privateSection}</p>}
        </section>
      ) : null}

      {tab === 'history' ? (
        <section className="section">
          {showHistory ? (
            history.length ? (
              <div className="stack">
                {history.map((h) => (
                  <div key={h.workId} className="panel" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="cover blue" style={{ width: 64, minWidth: 64 }}>
                      <span className="cover-title" style={{ fontSize: 11 }}>{h.title}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <strong>{h.title}</strong>
                      <p className="muted" style={{ fontSize: 12 }}>{h.author} · {h.chapterTitle || ''}</p>
                      <p className="muted" style={{ fontSize: 12 }}>{fmtDate(h.updatedAt, l)} · {Math.round(h.percent)}%</p>
                    </div>
                    <Link className="btn" href={h.chapterId ? `/${l}/read/${h.chapterId}` : `/${l}/work/${h.slug}`}>{t.open} →</Link>
                  </div>
                ))}
              </div>
            ) : <p className="muted">{t.noHistory}</p>
          ) : <p className="muted">{t.privateSection}</p>}
        </section>
      ) : null}

      {tab === 'bookmarks' ? (
        <section className="section">
          {showBookmarks ? (
            bookmarks.length ? (
              <div className="stack">
                {bookmarks.map((b) => (
                  <div key={b.id} className="panel" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <strong>{b.title}</strong>
                      <p className="muted" style={{ fontSize: 12 }}>{b.chapterTitle || ''}{b.note ? ` · ${b.note}` : ''}</p>
                      <p className="muted" style={{ fontSize: 12 }}>{fmtDate(b.createdAt, l)}</p>
                    </div>
                    <Link className="btn" href={`/${l}/read/${b.chapterId}`}>{t.open} →</Link>
                  </div>
                ))}
              </div>
            ) : <p className="muted">{t.noBookmarks}</p>
          ) : <p className="muted">{t.privateSection}</p>}
        </section>
      ) : null}

      {tab === 'achievements' ? (
        <section className="section">
          {showAchievements ? (
            <>
              <h2>{t.achievementsEarned} · {earned.length}</h2>
              {earned.length ? (
                <div className="grid4" style={{ marginTop: 12 }}>
                  {earned.map((a) => (
                    <div key={a.key} className="panel">
                      <div style={{ fontSize: 26 }}>{a.icon}</div>
                      <h3 style={{ marginTop: 6 }}>{a.title}</h3>
                      <p className="muted" style={{ fontSize: 12 }}>{a.description}</p>
                      <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>{a.unlockedAt ? fmtDate(a.unlockedAt, l) : ''}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="muted">{t.noAchievements}</p>}

              <h2 style={{ marginTop: 24 }}>{t.achievementsLocked} · {locked.length}</h2>
              <div className="grid4" style={{ marginTop: 12 }}>
                {locked.map((a) => (
                  <div key={a.key} className="panel" style={{ opacity: 0.6 }}>
                    <div style={{ fontSize: 26 }}>{a.icon}</div>
                    <h3 style={{ marginTop: 6 }}>{a.title}</h3>
                    <p className="muted" style={{ fontSize: 12 }}>{a.description}</p>
                    <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>{t.progress}: {a.progress}/{a.threshold}</p>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="muted">{t.privateSection}</p>}
        </section>
      ) : null}

      {tab === 'about' ? (
        <section className="section">
          <div className="panel">
            <h2>{t.about}</h2>
            {card.bio ? <p style={{ marginTop: 10, maxWidth: 720 }}>{card.bio}</p> : <p className="muted" style={{ marginTop: 10 }}>—</p>}
            {showGenres ? (
              <div style={{ marginTop: 16 }}>
                <h3>{t.favoriteGenres}</h3>
                {genres.length ? (
                  <div className="chips" style={{ marginTop: 8 }}>
                    {genres.map((g) => <Link key={g.slug} className="chip" href={`/${l}/catalog?genre=${g.slug}`}>{g.name}</Link>)}
                  </div>
                ) : <p className="muted" style={{ marginTop: 6 }}>{t.noGenres}</p>}
              </div>
            ) : null}
            {isMe ? (
              <Link className="btn primary" style={{ marginTop: 16, display: 'inline-block' }} href={`/${l}/account`}>{t.edit} →</Link>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
