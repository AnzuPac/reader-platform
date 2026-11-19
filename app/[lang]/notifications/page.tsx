import Link from 'next/link';
import { isLang, type Lang } from '@/lib/i18n';
import { readSession } from '@/lib/auth';
import { listLibraryUpdates } from '@/lib/repo';
import { newChaptersFromFollowed } from '@/lib/follows';

export const dynamic = 'force-dynamic';

const TXT: Record<Lang, { title: string; empty: string; chapter: string; login: string }> = {
  sr: { title: 'Obaveštenja', empty: 'Nema novih glava u delima iz tvoje biblioteke.', chapter: 'Glava', login: 'Prijavi se da vidiš obaveštenja.' },
  ru: { title: 'Уведомления', empty: 'В произведениях из твоей библиотеки новых глав нет.', chapter: 'Глава', login: 'Войди, чтобы видеть уведомления.' },
  en: { title: 'Notifications', empty: 'No new chapters in works from your library.', chapter: 'Chapter', login: 'Sign in to see notifications.' },
};

export default async function NotificationsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const x = TXT[l];
  const session = await readSession();

  if (!session) {
    return (
      <main id="main" className="mx-auto max-w-3xl px-5 py-16">
        <div className="card p-8 text-center">
          <h1 className="mb-3 text-2xl font-bold">{x.title}</h1>
          <p className="mb-5 muted">{x.login}</p>
          <Link href={`/${l}/login`} className="btn btn-primary">{l === 'ru' ? 'Войти' : l === 'en' ? 'Sign in' : 'Prijava'}</Link>
        </div>
      </main>
    );
  }

  // Две ленты: новые главы в библиотеке и у авторов, на которых подписан.
  const [fromLibrary, fromFollows] = await Promise.all([
    listLibraryUpdates(session.uid).catch(() => []),
    newChaptersFromFollowed(session.uid).catch(() => []),
  ]);
  const seen = new Set<number>();
  const updates = [...fromLibrary, ...fromFollows]
    .filter((u) => (seen.has(u.chapter_id) ? false : (seen.add(u.chapter_id), true)))
    .sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)))
    .slice(0, 50);

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="mb-6 text-2xl font-bold">{x.title}</h1>
      {updates.length === 0 ? (
        <div className="card p-8 text-center muted">{x.empty}</div>
      ) : (
        <ul className="space-y-2">
          {updates.map((u) => (
            <li key={u.chapter_id} className="card flex items-center gap-4 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/15">🆕</span>
              <div className="min-w-0 flex-1">
                <Link href={`/${l}/work/${u.slug}`} className="font-semibold hover:text-brand">{u.title}</Link>
                <div className="text-xs muted">
                  {u.author_name} · {u.chapter_title || `${x.chapter} ${u.number}`} ·{' '}
                  {new Date(u.published_at).toLocaleDateString(l === 'ru' ? 'ru-RU' : l === 'en' ? 'en-GB' : 'sr-RS')}
                </div>
              </div>
              <Link href={`/${l}/read/${u.chapter_id}`} className="btn btn-ghost">
                {l === 'ru' ? 'Читать' : l === 'en' ? 'Read' : 'Čitaj'}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
