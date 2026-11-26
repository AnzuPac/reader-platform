import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLang, type Lang } from '@/lib/i18n';
import { readSession } from '@/lib/auth';
import {
  getPublisher, getPublisherForUser, isPublisherMember, listPayouts,
  listPublishers, publisherReport, publisherWorks,
} from '@/lib/publisher';
import PublisherReport from '@/components/PublisherReport';
import PublisherPriceEditor from '@/components/PublisherPriceEditor';
import PublisherRightsEditor from '@/components/PublisherRightsEditor';
import PayoutForm from '@/components/PayoutForm';
import PublisherMembers from '@/components/PublisherMembers';
import { protectionMode } from '@/lib/rights';
import PublisherLicenses from '@/components/PublisherLicenses';

export const dynamic = 'force-dynamic';

function money(cents: number, currency: string): string {
  void currency; // отчёт всегда в RSD
  const n = Math.trunc(cents || 0);
  return n % 100 === 0 ? `${n / 100} RSD` : `${(n / 100).toFixed(2).replace('.', ',')} RSD`;
}

export default async function PublisherPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ publisher?: string; from?: string; to?: string }>;
}) {
  const { lang } = await params;
  const sp = await searchParams;
  const l = (isLang(lang) ? lang : 'sr') as Lang;

  const session = await readSession();
  if (!session) {
    return (
      <main id="main" className="tl-screen tl-screen--publisher mx-auto max-w-3xl px-5 py-16">
        <div className="card p-8 text-center">
          <h1 className="mb-2 text-2xl font-bold">Kabinet izdavača</h1>
          <p className="mb-5 muted">Prodaje, rojaliti i izveštaji — dostupno izdavačima.</p>
          <div className="flex justify-center gap-3">
            <Link href={`/${l}/login`} className="btn btn-ghost">Prijava</Link>
            <Link href={`/${l}/register`} className="btn btn-primary">Registracija</Link>
          </div>
        </div>
      </main>
    );
  }

  const isAdmin = session.role === 'admin';
  const mine = await getPublisherForUser(session.uid);
  const all = isAdmin ? await listPublishers() : [];

  if (!mine && !isAdmin) {
    return (
      <main className="tl-screen tl-screen--publisher mx-auto max-w-3xl px-5 py-16">
        <div className="card p-8">
          <h1 className="mb-2 text-2xl font-bold">Kabinet izdavača</h1>
          <p className="muted">
            Tvoj nalog nije član nijednog izdavaštva. Obrati se administratoru da te poveže sa izdavačem.
          </p>
        </div>
      </main>
    );
  }

  const wanted = Number(sp.publisher) || null;
  let publisherId: number | null = mine?.id ?? all[0]?.id ?? null;

  if (wanted) {
    if (isAdmin) publisherId = wanted;
    else if (wanted === mine?.id || (await isPublisherMember(session.uid, wanted))) publisherId = wanted;
    else publisherId = mine?.id ?? null;
  }

  if (!publisherId) {
    return (
      <main className="tl-screen tl-screen--publisher mx-auto max-w-3xl px-5 py-16">
        <div className="card p-8">
          <h1 className="mb-2 text-2xl font-bold">Kabinet izdavača</h1>
          <p className="muted">Još nema izdavaštva u sistemu.</p>
        </div>
      </main>
    );
  }

  const publisher = await getPublisher(publisherId);
  if (!publisher) notFound();

  const defaultFrom = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const defaultTo = new Date().toISOString().slice(0, 10);
  const from = sp.from || defaultFrom;
  const to = sp.to || defaultTo;

  const [works, report, payouts] = await Promise.all([
    publisherWorks(publisherId),
    publisherReport(publisherId, from, to),
    listPayouts(publisherId),
  ]);

  const payableTotal = report.payable.reduce((s, p) => s + p.amount_cents, 0);
  const payableCurrency = report.payable[0]?.currency || '';

  return (
    <main id="main" className="tl-screen tl-screen--publisher tlp-publisher-dashboard">
      <div className="tlp-publisher-layout">
        <aside className="tlp-publisher-sidebar" aria-label="Навигация кабинета издателя">
          <Link href={`/${l}/publisher`} className="tlp-author-sidebar-brand">
            <span className="tlp-author-sidebar-mark">T</span>
            <span><strong>TeroLibrary</strong><small>PUBLISHER STUDIO</small></span>
          </Link>
          <div className="tlp-author-sidebar-label">ИЗДАТЕЛЬСТВО</div>
          <nav>
            <a className="is-active" href="#overview"><span>⌂</span>Обзор</a>
            <a href="#report"><span>▥</span>Отчёты</a>
            <a href="#works"><span>▤</span>Произведения</a>
            <a href="#licenses"><span>▧</span>Лицензии и права</a>
            <a href="#members"><span>♙</span>Команда</a>
            <a href="#payouts"><span>◷</span>Выплаты</a>
          </nav>
          <div className="tlp-author-sidebar-bottom"><Link href={`/${l}/`}>← TeroLibrary</Link></div>
        </aside>
        <div className="tlp-publisher-main">
      <div className="tlp-publisher-topbar"><div><span className="muted">TeroLibrary</span><span className="tlp-author-breadcrumb-sep">/</span><strong>Кабинет издателя</strong></div><span className="tlp-author-avatar">{publisher.name.trim().slice(0, 1).toLocaleUpperCase()}</span></div>
      <section className="tlp-stage8-publisher-hero mb-6"><div><p className="tlp-stage8-kicker">TeroLibrary Publisher</p><h1 className="text-2xl font-bold">{publisher.name}</h1><p className="text-sm muted">Prodaja, prava, tim i finansije na jednom mestu.</p></div><Link href={`/${l}/publishers`} className="btn btn-ghost">Informacije za izdavače</Link></section>
      <div id="overview" className="tlp-publisher-overview mb-6 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <p className="text-sm muted">
            Provizija platforme: {publisher.commission_pct}% (podrazumevano 50%) · tvoj deo: {100 - publisher.commission_pct}% · kontakt: {publisher.contact_email || '—'}
          </p>
        </div>
        {isAdmin && all.length > 1 ? (
          <form method="get" className="flex items-center gap-2">
            <select className="input max-w-[220px]" name="publisher" defaultValue={String(publisherId)}>
              {all.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button className="btn btn-ghost">Prikaži</button>
          </form>
        ) : null}
        <Link href={`/${l}`} className="btn btn-ghost">Nazad</Link>
      </div>

      <div className="tlp-publisher-kpis mb-6 grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="text-xs muted">Knjige u katalogu</div>
          <div className="text-2xl font-bold">{works.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs muted">Prodaje (period {from} — {to})</div>
          <div className="text-2xl font-bold">{report.byCurrency.reduce((s, r) => s + r.sales, 0)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs muted">Za isplatu</div>
          <div className="text-2xl font-bold">
            {payableCurrency ? money(payableTotal, payableCurrency) : '—'}
          </div>
        </div>
      </div>

      <section id="report" className="tlp-stage8-section"><PublisherReport
        publisherId={publisherId}
        initialFrom={from}
        initialTo={to}
        initialReport={report}
      /></section>

      <section id="works" className="card mt-6 overflow-hidden tlp-stage8-section">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-bold">Knjige, cene i prodaje</h2>
          <span className="text-sm muted">{works.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase muted">
              <tr>
                <th className="px-4 py-2">Delo</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Cena</th>
                <th className="px-4 py-2">Prodaje</th>
                <th className="px-4 py-2">Rojalit</th>
                <th className="px-4 py-2">Zaštita</th>
              </tr>
            </thead>
            <tbody>
              {works.map((w) => (
                <tr key={w.id} className="border-t border-line align-top">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{w.title}</div>
                    <div className="text-xs muted">{w.slug} · {w.type === 'comic' ? 'strip' : 'roman'}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className={w.status === 'published' ? 'text-brand' : 'muted'}>{w.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <PublisherPriceEditor
                      workId={w.id}
                      publisherId={publisherId}
                      amountCents={w.amount_cents}
                      currency={w.currency}
                      active={w.active}
                    />
                    <PublisherRightsEditor
                      workId={w.id}
                      publisherId={publisherId}
                      rightsSale={Number(w.rights_sale ?? 1)}
                      rightsSubscription={Number(w.rights_subscription ?? 1)}
                      windowDays={Number(w.subscription_window_days ?? 0)}
                      regions={String(w.regions ?? 'RS')}
                      tts={Number(w.tts_allowed ?? 0)}
                      excerpt={Number(w.free_excerpt_pct ?? 10)}
                    />
                  </td>
                  <td className="px-4 py-3">{w.sales}</td>
                  <td className="px-4 py-3">
                    {w.currency ? money(w.royalty_cents, w.currency) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {(() => {
                      const mode = protectionMode({
                        exportPolicy: w.license_export_policy ?? null,
                        hasLicense: Boolean(w.license_territory),
                      });
                      return (
                        <>
                          <div className="font-semibold">{mode.mode === 'enhanced' ? 'Enhanced' : 'Standard'}</div>
                          <div className="muted">DRM: {mode.drmConnected ? 'да' : 'не подключён'}</div>
                        </>
                      );
                    })()}
                  </td>
                </tr>
              ))}
              {works.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center muted">Nema dela povezanih sa izdavaštvom.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div id="licenses" className="tlp-stage8-section"><PublisherLicenses
        publisherId={publisherId}
        works={works.map((w) => ({ id: w.id, title: w.title }))}
      />

      </div><div id="members" className="tlp-stage8-section"><PublisherMembers publisherId={publisherId} /></div>

      <section id="payouts" className="card mt-6 p-5 tlp-stage8-section">
        <h2 className="mb-3 font-bold">Isplate</h2>
        <PayoutForm publisherId={publisherId} />
        <ul className="mt-4 divide-y divide-line text-sm">
          {payouts.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="muted">#{p.id}</span>
              <span className="flex-1">{money(p.amount_cents, 'RSD')}</span>
              <span className={p.status === 'paid' ? 'text-brand' : 'badge-hot'}>{p.status}</span>
              <span className="text-xs muted">{String(p.created_at).slice(0, 10)}</span>
            </li>
          ))}
          {payouts.length === 0 ? <li className="py-3 muted">Isplata još nema.</li> : null}
        </ul>
      </section>
        </div>
      </div>
    </main>
  );
}
