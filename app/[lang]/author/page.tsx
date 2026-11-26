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
import { authorDashboard } from '@/lib/author-dashboard';

export const dynamic = 'force-dynamic';

export default async function AuthorPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const s = await requireAuthor();
  if (!s) { const session = await readSession(); redirect(session ? `/${l}/account` : `/${l}/login`); }
  const income = await authorIncome(s.uid);
  const dash = await authorDashboard(s.uid);

  const recentWorks = dash.works.slice(0, 4);
  const formatDate = (value: string | null) => value
    ? new Intl.DateTimeFormat(l === 'ru' ? 'ru-RU' : l === 'en' ? 'en-GB' : 'sr-Latn-RS', { day: '2-digit', month: 'short' }).format(new Date(value))
    : (l === 'ru' ? 'Нет изменений' : l === 'en' ? 'No edits yet' : 'Bez izmena');

  return (
    <main id="main" className="tl-screen tl-screen--author tlp-author-dashboard">
      <div className="tlp-author-layout">
        <aside className="tlp-author-sidebar" aria-label="Навигация авторской мастерской">
          <Link href={`/${l}/author`} className="tlp-author-sidebar-brand">
            <span className="tlp-author-sidebar-mark">T</span>
            <span><strong>TeroLibrary</strong><small>AUTHOR STUDIO</small></span>
          </Link>
          <div className="tlp-author-sidebar-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
          <nav>
            <a className="is-active" href="#overview"><span>⌂</span>Обзор</a>
            <a href="#works"><span>▤</span>Произведения</a>
            <a href="#author-new-work"><span>✎</span>Редактор</a>
            <a href="#publications"><span>◷</span>Публикации</a>
            <a href="#files"><span>↕</span>Файлы и перенос</a>
            <a href="#stats"><span>▥</span>Статистика</a>
            <a href="#income"><span>◉</span>Доход и выплаты</a>
          </nav>
          <div className="tlp-author-sidebar-bottom"><Link href={`/${l}/`}>← TeroLibrary</Link></div>
        </aside>

        <div className="tlp-author-main">
          <div className="tlp-author-topbar">
            <div><span className="muted">TeroLibrary</span><span className="tlp-author-breadcrumb-sep">/</span><strong>Обзор</strong></div>
            <div className="tlp-author-topbar-actions"><span className="tlp-author-period">Текущая статистика</span><span className="tlp-author-avatar">{s.name.trim().slice(0, 1).toLocaleUpperCase() || 'A'}</span></div>
          </div>

          <section id="overview" className="tlp-author-heading">
            <div><p className="tlp-stage8-kicker">АВТОРСКАЯ МАСТЕРСКАЯ</p><h1>Добро пожаловать, {s.name}</h1><p>Ваше пространство для историй, публикаций и общения с читателями.</p></div>
            <a href="#author-new-work" className="btn primary">＋ Новое произведение</a>
          </section>

          <section className="tlp-author-kpis" aria-label="Сводка автора">
            {([
              ['Произведения', dash.totals.works, 'Всего в мастерской'],
              ['Главы', dash.totals.chapters, 'Во всех произведениях'],
              ['Опубликовано', dash.totals.published, 'Доступны читателям'],
              ['Запланировано', dash.totals.scheduled, 'Ожидают публикации'],
              ['Слов', dash.totals.words.toLocaleString('ru-RU'), 'Общий объём текстов'],
              ['Правки на проверке', dash.totals.pendingEdits, 'Ожидают решения'],
            ] as Array<[string, number | string, string]>).map(([label, value, note]) => (
              <article className="tlp-author-kpi" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>
            ))}
          </section>

          <div className="tlp-author-overview-grid">
            <section id="stats" className="tlp-author-panel tlp-author-stats-panel">
              <div className="tlp-author-panel-heading"><div><h2>Активность читателей</h2><p>Сводка по вашим опубликованным произведениям</p></div><span className="tlp-author-panel-meta">Реальные данные</span></div>
              <AuthorStats />
            </section>
            <aside className="tlp-author-panel tlp-author-recent-panel">
              <div className="tlp-author-panel-heading"><div><h2>Продолжить работу</h2><p>Последние изменённые произведения</p></div><a href="#works">Все →</a></div>
              <div className="tlp-author-recent-list">
                {recentWorks.map((w) => (
                  <Link href={`/${l}/author/${w.slug}`} key={w.id} className="tlp-author-recent-item">
                    <span className="tlp-author-recent-cover">✧</span>
                    <span className="tlp-author-recent-copy"><strong>{w.title}</strong><small>{Number(w.chapters)} глав · изменено {formatDate(w.updated_at)}</small></span>
                    <span className="tlp-author-recent-action">Открыть</span>
                  </Link>
                ))}
                {recentWorks.length === 0 ? <p className="muted text-sm">Пока нет произведений. Создайте первое в разделе ниже.</p> : null}
              </div>
            </aside>
          </div>

          <section id="works" className="tlp-author-section tlp-stage8-section">
            <div className="tlp-author-section-heading"><div><h2>Мои произведения</h2><p>Черновики, публикации и работа над главами</p></div><a className="btn" href="#author-new-work">＋ Добавить</a></div>
            <div id="publications"><AuthorWorks lang={l} /></div>
          </section>

          <section id="files" className="tlp-author-section tlp-stage8-section">
            <div className="tlp-author-section-heading"><div><h2>Файлы и перенос</h2><p>Импорт книги в рабочее пространство</p></div></div>
            <EpubImportForm />
          </section>

          <section id="income" className="tlp-author-section tlp-stage8-section">
            <div className="tlp-author-section-heading"><div><h2>Доход и выплаты</h2><p>Финансовые показатели и настройки выплат</p></div></div>
            <AuthorIncome initial={income} />
            <div className="mt-5"><AuthorDonations /></div>
          </section>
        </div>
      </div>
    </main>
  );
}
