import Link from 'next/link';
import { isLang, t, type Lang } from '@/lib/i18n';
import { readSession } from '@/lib/auth';
import {
  listLibrary, getContinueReading, listReadingHistory, listBookmarks,
  libraryCounts, isLibraryStatus, LIBRARY_STATUSES, type LibraryStatus,
} from '@/lib/repo';
import LibraryStatusPicker from '@/components/LibraryStatusPicker';
import { listPurchasedWorks } from '@/lib/purchases';

export const dynamic = 'force-dynamic';

type LibItem = {
  id: number; slug: string; title: string; description: string;
  rating_avg: string; words_total: number; age_rating: number;
  completion: string; author_name: string; added_at: string;
};

type Tab = 'saved' | 'history' | 'bookmarks' | 'purchased';

const STATUS_LABELS: Record<Lang, Record<LibraryStatus, string>> = {
  sr: { reading: 'Čitam', want: 'U planu', done: 'Pročitano', favorite: 'Omiljeno', postponed: 'Odloženo', dropped: 'Napušteno' },
  ru: { reading: 'Читаю', want: 'В планах', done: 'Прочитано', favorite: 'Любимое', postponed: 'Отложено', dropped: 'Брошено' },
  en: { reading: 'Reading', want: 'Want to read', done: 'Finished', favorite: 'Favourite', postponed: 'Postponed', dropped: 'Dropped' },
};

const TAB_LABELS: Record<Lang, Record<Tab, string>> = {
  sr: { saved: 'Sačuvano', history: 'Istorija', bookmarks: 'Obeleživači', purchased: 'Kupljeno' },
  ru: { saved: 'Сохранённое', history: 'История', bookmarks: 'Закладки', purchased: 'Куплено' },
  en: { saved: 'Saved', history: 'History', bookmarks: 'Bookmarks', purchased: 'Purchased' },
};

export default async function LibraryPage({
  params, searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ tab?: string; status?: string }>;
}) {
  const { lang } = await params;
  const sp = await searchParams;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const session = await readSession();

  const rawTab = typeof sp.tab === 'string' ? sp.tab : 'saved';
  const tab: Tab = rawTab === 'history' || rawTab === 'bookmarks' || rawTab === 'purchased' ? rawTab : 'saved';
  const rawStatus = typeof sp.status === 'string' ? sp.status : '';
  const status: LibraryStatus | undefined = isLibraryStatus(rawStatus) ? rawStatus : undefined;

  if (!session) {
    return (
      <main id="main" className="mx-auto max-w-3xl px-5 py-16">
        <div className="card p-8 text-center">
          <h1 className="mb-2 text-2xl font-bold">{t(l, 'nav_library')}</h1>
          <p className="mb-5 muted">
            {l === 'ru' ? 'Сохраняй любимые произведения и продолжай с того же места.' : l === 'en' ? 'Save your favourite works and continue where you left off.' : 'Sačuvaj omiljena dela i nastavi čitanje sa istog mesta.'}
          </p>
          <div className="flex justify-center gap-3">
            <Link href={`/${l}/login`} className="btn btn-ghost">{t(l, 'nav_login')}</Link>
            <Link href={`/${l}/register`} className="btn btn-primary">{t(l, 'nav_register')}</Link>
          </div>
        </div>
      </main>
    );
  }

  const items = (await listLibrary(session.uid, status)) as unknown as LibItem[];
  const counts = await libraryCounts(session.uid);
  const cont = await getContinueReading(session.uid);
  const purchased = await listPurchasedWorks(session.uid);
  const history = tab === 'history' ? await listReadingHistory(session.uid) : [];
  const bookmarks = tab === 'bookmarks' ? await listBookmarks(session.uid) : [];

  const label = TAB_LABELS[l];

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold">{t(l, 'nav_library')}</h1>
        <span className="text-sm muted">{items.length}</span>
      </div>

      {/* Вкладки — каждая со своим содержимым, а не три ссылки в одну страницу (аудит, п.21). */}
      <nav className="mb-6 flex flex-wrap gap-2">
        {(['saved', 'history', 'bookmarks', 'purchased'] as Tab[]).map((key) => (
          <Link
            key={key}
            href={`/${l}/library?tab=${key}`}
            className={`btn ${tab === key ? 'btn-primary' : 'btn-ghost'}`}
          >
            {label[key]}
            {key === 'saved' ? ` ${items.length}` : key === 'purchased' ? ` ${purchased.length}` : ''}
          </Link>
        ))}
      </nav>

      {cont ? (
        <Link href={`/${l}/read/${cont.chapter_id}`} className="card mb-6 flex items-center gap-4 p-4 hover:border-brand">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand/20 text-lg">📖</span>
          <div className="min-w-0 flex-1">
            <div className="text-xs muted">
              {l === 'ru' ? 'Продолжить чтение' : l === 'en' ? 'Continue reading' : 'Nastavi čitanje'} · {cont.percent}%
            </div>
            <div className="line-clamp-1 font-semibold">{cont.work_title} — {cont.chapter_title || `${l === 'ru' ? 'Глава' : l === 'en' ? 'Chapter' : 'Glava'} ${cont.number}`}</div>
          </div>
          <span className="btn btn-primary">{l === 'ru' ? 'Дальше' : l === 'en' ? 'Continue' : 'Nastavi'}</span>
        </Link>
      ) : null}

      {tab === 'history' ? (
        history.length === 0 ? (
          <div className="card p-8 text-center muted">
            {l === 'ru' ? 'История пуста — открой любое произведение.' : l === 'en' ? 'No history yet — open any work.' : 'Istorija je prazna — otvori neko delo.'}
          </div>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={`${h.work_id}-${h.chapter_id}`} className="card flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/${l}/work/${h.slug}`} className="font-semibold hover:text-brand">{h.title}</Link>
                  <div className="text-xs muted">{h.author_name} · {h.chapter_title || `Glava ${h.number}`} · {h.percent}%</div>
                </div>
                <Link href={`/${l}/read/${h.chapter_id}`} className="btn btn-ghost">{l === 'ru' ? 'Читать' : l === 'en' ? 'Read' : 'Čitaj'}</Link>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {tab === 'bookmarks' ? (
        bookmarks.length === 0 ? (
          <div className="card p-8 text-center muted">
            {l === 'ru' ? 'Закладок пока нет.' : l === 'en' ? 'No bookmarks yet.' : 'Nema obeleživača.'}
          </div>
        ) : (
          <ul className="space-y-2">
            {bookmarks.map((b) => (
              <li key={b.id} className="card flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/${l}/work/${b.slug}`} className="font-semibold hover:text-brand">{b.title}</Link>
                  <div className="text-xs muted">{b.chapter_title || `Glava ${b.number}`}{b.note ? ` · ${b.note}` : ''}</div>
                </div>
                <Link href={`/${l}/read/${b.chapter_id}`} className="btn btn-ghost">{l === 'ru' ? 'Открыть' : l === 'en' ? 'Open' : 'Otvori'}</Link>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {tab === 'purchased' ? (
        purchased.length === 0 ? (
          <div className="card p-8 text-center muted">
            {l === 'ru' ? 'Покупок пока нет.' : l === 'en' ? 'Nothing purchased yet.' : 'Nema kupovina.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {purchased.map((w) => (
              <Link key={w.id} href={`/${l}/work/${w.slug}`} className="group">
                <div className="cover cover-sm relative">
                  <span className="relative line-clamp-3">{w.title}</span>
                  <span className="absolute right-1 top-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {w.chapter_only ? 'GLAVA' : 'KNJIGA'}
                  </span>
                </div>
                <div className="mt-2 line-clamp-1 text-sm font-semibold group-hover:text-brand">{w.title}</div>
                <div className="text-xs muted">{w.author_name}</div>
              </Link>
            ))}
          </div>
        )
      ) : null}

      {tab === 'saved' ? (
        <>
          <nav className="mb-4 flex flex-wrap gap-2">
            <Link href={`/${l}/library?tab=saved`} className={`btn ${!status ? 'btn-primary' : 'btn-ghost'}`}>
              {l === 'ru' ? 'Все' : l === 'en' ? 'All' : 'Sve'}
            </Link>
            {LIBRARY_STATUSES.map((st) => (
              <Link
                key={st}
                href={`/${l}/library?tab=saved&status=${st}`}
                className={`btn ${status === st ? 'btn-primary' : 'btn-ghost'}`}
              >
                {STATUS_LABELS[l][st]} {counts[st] > 0 ? counts[st] : ''}
              </Link>
            ))}
          </nav>
        </>
      ) : null}

      {tab === 'saved' ? (
        items.length === 0 ? (
          <div className="card p-8 text-center muted">
            {l === 'ru' ? 'Библиотека пуста. Открой произведение и нажми «Добавить в библиотеку».' : l === 'en' ? 'Library is empty. Open a work and press “Add to library”.' : 'Biblioteka je prazna. Otvori delo i klikni „Dodaj u biblioteku“.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((w) => (
              <div key={w.id}>
                <Link href={`/${l}/work/${w.slug}`} className="group block">
                  <div className="cover cover-sm relative">
                    <span className="relative line-clamp-3">{w.title}</span>
                  </div>
                  <div className="mt-2 line-clamp-1 text-sm font-semibold group-hover:text-brand">{w.title}</div>
                  <div className="text-xs muted">{w.author_name}</div>
                </Link>
                <div className="mt-2">
                  <LibraryStatusPicker workId={w.id} initial={(w as unknown as { status?: LibraryStatus }).status ?? null} lang={l} />
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}
    </main>
  );
}
