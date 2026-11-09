import Link from 'next/link';
import { isLang, t, type Lang } from '@/lib/i18n';
import { readSession } from '@/lib/auth';
import { listLibrary } from '@/lib/repo';

export const dynamic = 'force-dynamic';

type LibItem = {
  id: number; slug: string; title: string; description: string;
  rating_avg: string; words_total: number; age_rating: number;
  completion: string; author_name: string; added_at: string;
};

export default async function LibraryPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const session = await readSession();

  if (!session) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <div className="card p-8 text-center">
          <h1 className="mb-2 text-2xl font-bold">{t(l, 'nav_library')}</h1>
          <p className="mb-5 muted">Sačuvaj omiljena dela i nastavi čitanje sa istog mesta.</p>
          <div className="flex justify-center gap-3">
            <Link href={`/${l}/login`} className="btn btn-ghost">{t(l, 'nav_login')}</Link>
            <Link href={`/${l}/register`} className="btn btn-primary">{t(l, 'nav_register')}</Link>
          </div>
        </div>
      </main>
    );
  }

  const items = (await listLibrary(session.uid)) as unknown as LibItem[];

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold">{t(l, 'nav_library')}</h1>
        <span className="text-sm muted">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="card p-8 text-center muted">
          Biblioteka je prazna. Otvori delo i klikni „Dodaj u biblioteku“.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((w) => (
            <Link key={w.id} href={`/${l}/work/${w.slug}`} className="group">
              <div className="cover cover-sm relative">
                <span className="relative line-clamp-3">{w.title}</span>
              </div>
              <div className="mt-2 line-clamp-1 text-sm font-semibold group-hover:text-brand">{w.title}</div>
              <div className="text-xs muted">{w.author_name}</div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
