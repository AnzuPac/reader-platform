import { redirect } from 'next/navigation';
import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { isLang, type Lang } from '@/lib/i18n';
import { requireAuthor } from '@/lib/author';
import AuthorWorks from '@/components/AuthorWorks';
import AuthorDonations from '@/components/AuthorDonations';
import AuthorIncome from '@/components/AuthorIncome';
import { authorIncome } from '@/lib/earnings';
import EpubImportForm from '@/components/EpubImportForm';
import AuthorStats from '@/components/AuthorStats';

export const dynamic = 'force-dynamic';

export default async function AuthorPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const s = await requireAuthor();
  if (!s) { const session = await readSession(); redirect(session ? `/${l}/account` : `/${l}/login`); }
  const income = await authorIncome(s.uid);

  return (
    <main id="main" className="tl-screen tl-screen--author mx-auto max-w-4xl px-5 py-10">
      <section className="tlp-stage8-author-hero mb-6">
      <div>
        <p className="tlp-stage8-kicker">TeroLibrary Studio</p>
        <h1 className="mb-2 text-2xl font-bold">Кабинет автора</h1>
        <p className="muted">Управляйте произведениями, публикациями и доходом в одном месте.</p>
      </div>
      <Link href={`/${l}/catalog`} className="btn btn-ghost">Открыть каталог →</Link>
    </section>
    <nav className="tlp-stage8-studio-nav" aria-label="Навигация кабинета автора">
      <a href="#works">Произведения</a><a href="#stats">Статистика</a><a href="#income">Доход</a><a href="#donations">Донаты</a>
    </nav>
      <EpubImportForm />
      <section id="works" className="tlp-stage8-section"><AuthorWorks lang={l} /></section>
      <div id="stats" className="mt-8 tlp-stage8-section">
        <AuthorStats />
      </div>
      <div id="income" className="mt-8 tlp-stage8-section">
        <AuthorIncome initial={income} />
      </div>
      <div id="donations" className="mt-8 tlp-stage8-section">
        <AuthorDonations />
      </div>
    </main>
  );
}
