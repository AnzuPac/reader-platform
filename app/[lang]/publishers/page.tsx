import Link from 'next/link';
import { isLang, type Lang } from '@/lib/i18n';
import PublisherLeadForm from '@/components/PublisherLeadForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const title = l === 'en' ? 'For publishers — Čitaonica' : l === 'ru' ? 'Издателям — Čitaonica' : 'Za izdavače — Čitaonica';
  return { title, description: 'Knjige, fanfiction i stripovi na jednom mestu. Pilot 3–6 naslova bez ekskluzivnosti.' };
}

const COPY = {
  sr: {
    kicker: 'Za izdavače',
    h1: 'Vaše knjige, fanfiction i stripovi — na jednom mestu',
    lead:
      'Čitaonica je regionalna platforma za čitanje sa plaćanjem po knjizi, pretplatom i direktnom podrškom autorima. Ulazimo u pilot sa 3–6 naslova, bez ekskluzivnosti.',
    streamsTitle: 'Tri toka sadržaja',
    streams: [
      {
        t: 'Knjige',
        d: 'Romani, pripovetke i serijali. Prodaja po knjizi ili kroz pretplatu; čitalac zadržava pristup zauvek nakon kupovine.',
      },
      {
        t: 'Fanfiction',
        d: 'Autori objavljuju besplatno, čitaoci podržavaju donacijama. Platforma uzima 10%, autor dobija 90%.',
      },
      {
        t: 'Stripovi',
        d: 'Stranica-po-stranica čitač, prodaja po glavi ili celom stripu. Isti model pristupa kao kod knjiga.',
      },
    ],
    rightsTitle: 'Zaštita prava — šta stvarno postoji',
    rightsNowTitle: 'Već radi',
    rightsNow: [
      'Plaćeni tekst se ne indeksira i ne kešira (no-store zaglavlja).',
      'Nežni nevidljivi vodeni žig sa ID-jem čitaoca u svakom plaćenom tekstu — kopija se može pripisati nalogu.',
      'Limit od 60 zahteva za tekst u minuti po korisniku i meki limit od 3 uređaja.',
      'Pristup se proverava na serveru za svaku glavu; nema skrivenog sadržaja u HTML-u za zaključane glave.',
      'Blokirano selektovanje i kopiranje plaćenog teksta u čitaču (uz očuvanu dostupnost za čitače ekrana).',
    ],
    rightsSoonTitle: 'Uvodimo / pregovaramo',
    rightsSoon: [
      'Automatsko prepoznavanje masovnog preuzimanja i privremeno zamrzavanje naloga.',
      'Proces prijave povrede prava sa rokovima odgovora i uklanjanjem sadržaja.',
      'Vidljivi vodeni žig sa imenom čitaoca kao opcija za izdavače koji je traže.',
      'Integracija sa eksternim DRM rešenjem — tek ako se pokaže potreba u pilotu.',
    ],
    moneyTitle: 'Provizije, bez sitnih slova',
    money: [
      ['Knjige — prodaja', '70% autoru/izdavaču · 30% platformi'],
      ['Stripovi — prodaja po glavi', '70% autoru/izdavaču · 30% platformi'],
      ['Donacije čitalaca', '90% autoru · 10% platformi'],
      ['Pilot (3–6 naslova)', 'Iste stope; bez ekskluzivnosti i bez ulazne naknade'],
    ],
    pilotTitle: 'Pilot: 3–6 knjiga, bez ekskluzivnosti',
    pilot: [
      'Vi birate naslove i cene; mi postavljamo stranicu, čitač i plaćanje.',
      'Ne tražimo ekskluzivno pravo — knjiga može istovremeno biti i u drugim prodavnicama.',
      'Zajedno merimo 60 dana: prodaje, dovršenost čitanja, povrate i donacije.',
      'Ako pilot radi, širimo na ceo katalog uz iste uslove.',
    ],
    linksTitle: 'Dalje',
    cabinet: 'Kabinet izdavača',
    cabinetNote: 'Prodaje, rojaliti, izveštaji i zahtevi za isplatu.',
    demo: 'Pogledajte demo knjigu',
    demoNote: 'Kako izgleda stranica dela i čitač.',
    formNote: 'Za pilot i pitanja popunite formu — odgovaramo u roku od dva radna dana.',
  },
  en: {
    kicker: 'For publishers',
    h1: 'Your books, fanfiction and comics — in one place',
    lead:
      'Čitaonica is a regional reading platform with per-book purchases, subscription and direct reader support. We start with a pilot of 3–6 titles, no exclusivity.',
    streamsTitle: 'Three content streams',
    streams: [
      { t: 'Books', d: 'Novels and serials. Sold per book or through subscription; buyers keep permanent access.' },
      { t: 'Fanfiction', d: 'Authors publish free, readers support with donations. Platform takes 10%, author gets 90%.' },
      { t: 'Comics', d: 'Page-by-page reader, per-chapter or full-comic sales. Same access model as books.' },
    ],
    rightsTitle: 'Rights protection — what actually exists',
    rightsNowTitle: 'Already live',
    rightsNow: [
      'Paid text is not cached or indexed (no-store headers).',
      'Invisible watermark carrying the reader ID in every paid text — a leak can be traced to an account.',
      '60 text requests per minute per user and a soft limit of 3 devices.',
      'Server-side access check for every chapter; locked chapters leave no hidden content in HTML.',
      'Selection and copying disabled in the paid reader (screen-reader access preserved).',
    ],
    rightsSoonTitle: 'In progress / under negotiation',
    rightsSoon: [
      'Automatic detection of bulk downloads and temporary account freezes.',
      'A takedown process with response deadlines and content removal.',
      'Visible watermark with the reader name as an option for publishers who ask.',
      'External DRM integration — only if the pilot proves the need.',
    ],
    moneyTitle: 'Commissions, no fine print',
    money: [
      ['Books — sales', '70% author/publisher · 30% platform'],
      ['Comics — per chapter', '70% author/publisher · 30% platform'],
      ['Reader donations', '90% author · 10% platform'],
      ['Pilot (3–6 titles)', 'Same rates; no exclusivity, no entry fee'],
    ],
    pilotTitle: 'Pilot: 3–6 books, no exclusivity',
    pilot: [
      'You choose titles and prices; we set up the page, reader and payments.',
      'No exclusive rights — the book can stay in other stores at the same time.',
      'We measure together for 60 days: sales, completion, refunds and donations.',
      'If the pilot works, we expand to the whole catalogue on the same terms.',
    ],
    linksTitle: 'Next',
    cabinet: 'Publisher cabinet',
    cabinetNote: 'Sales, royalties, reports and payout requests.',
    demo: 'See a demo book',
    demoNote: 'What a work page and reader look like.',
    formNote: 'For the pilot and questions, fill in the form — we reply within two business days.',
  },
  ru: {
    kicker: 'Издателям',
    h1: 'Vaše knjige, fanfikovi i stripovi — na jednom mestu',
    lead:
      'Čitaonica — regionalna platforma za čitanje sa kupovinom knjiga, pretplatom i direktnom podrškom autorima. Počinjemo s pilotom od 3–6 knjiga, bez ekskluzive.',
    streamsTitle: 'Tri toka sadržaja',
    streams: [
      { t: 'Knjige', d: 'Romani i serije. Prodaja po knjizi ili po pretplati; posle kupovine pristup ostaje zauvek.' },
      { t: 'Fanfikovi', d: 'Autori objavljuju besplatno, čitaoci podržavaju donacijama. Platforma uzima 10%, autor dobija 90%.' },
      { t: 'Fanfikovi', d: 'Autori objavljuju besplatno, čitaoci podržavaju donacijama. Platforma uzima 10%, autor dobija 90%.' },
    ],
    rightsTitle: 'Защита прав — что реально есть',
    rightsNowTitle: 'Već radi',
    rightsNow: [
      'Платный текст не кешируется и не индексируется (no-store).',
      'Невидимый водяной знак с ID читателя в каждом платном тексте — утечку можно привязать к аккаунту.',
      'Лимит 60 запросов текста в минуту на пользователя и мягкий лимит 3 устройств.',
      'Limit 60 zahteva za tekst u minuti po korisniku i meki limit od 3 uređaja.',
      'Запрет выделения и копирования в платной читалке (доступность для скринридеров сохранена).',
    ],
    rightsSoonTitle: 'Uvodimo / diskutujemo',
    rightsSoon: [
      'Automatsko otkrivanje masovnih preuzimanja i privremeno zamrzavanje naloga.',
      'Процесс жалобы на нарушение прав со сроками ответа и удалением контента.',
      'Vidljiv vodeni žig sa imenom čitaoca — opcija za izdavače kojima je to potrebno.',
      'Интеграция с внешним DRM — только если пилот покажет потребность.',
    ],
    moneyTitle: 'Комиссии, без мелкого fonta',
    money: [
      ['Knjige — prodaja', '70% autoru/izdavaču · 30% platformi'],
      ['Stripovi — prodaja glave', '70% autoru/izdavaču · 30% platformi'],
      ['Donacije čitalaca', '90% autoru · 10% platformi'],
      ['Пилот (3–6 книг)', 'Iste stope; bez ekskluzive i ulazne naknade'],
    ],
    pilotTitle: 'Пилот: 3–6 книг, без эксклюзива',
    pilot: [
      'Вы выбираете книги и цены; мы настраиваем страницу, читалку и оплату.',
      'Ekskluzivitet ne zahtevamo — knjiga može istovremeno da se prodaje u drugim prodavnicama.',
      'Zajedno merimo 60 dana: prodaja, dočitavanja, povraćaji i donacije.',
      'Если пилот работает — расширяем на весь каталог на тех же условиях.',
    ],
    linksTitle: 'Дальше',
    cabinet: 'Кабинет издателя',
    cabinetNote: 'Продажи, роялти, отчёты и prijave на выплату.',
    demo: 'Pogledaj demo knjigu',
    demoNote: 'Как выглядят страница произведения и читалка.',
    formNote: 'Для пилота и вопросов заполните форму — ответим в течение двух рабочих дней.',
  },
} as const;

export default async function PublishersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const c = COPY[l];

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <section className="mb-10">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand">{c.kicker}</p>
        <h1 className="mb-4 max-w-3xl text-3xl font-extrabold leading-tight sm:text-4xl">{c.h1}</h1>
        <p className="max-w-3xl text-sm leading-relaxed muted">{c.lead}</p>
      </section>

      <section className="mb-10">
        <h2 className="section-title">{c.streamsTitle}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {c.streams.map((s) => (
            <div key={s.t} className="card p-5">
              <h3 className="mb-2 font-bold">{s.t}</h3>
              <p className="text-sm leading-relaxed muted">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="section-title">{c.rightsTitle}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card p-5">
            <h3 className="mb-3 font-bold text-brand">{c.rightsNowTitle}</h3>
            <ul className="space-y-2 text-sm">
              {c.rightsNow.map((x) => <li key={x} className="flex gap-2"><span aria-hidden>✓</span><span>{x}</span></li>)}
            </ul>
          </div>
          <div className="card p-5">
            <h3 className="mb-3 font-bold">🛠 {c.rightsSoonTitle}</h3>
            <ul className="space-y-2 text-sm">
              {c.rightsSoon.map((x) => <li key={x} className="flex gap-2"><span aria-hidden>→</span><span>{x}</span></li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="section-title">{c.moneyTitle}</h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {c.money.map(([k, v]) => (
                <tr key={k} className="border-b border-line last:border-0">
                  <th className="px-5 py-3 text-left font-semibold">{k}</th>
                  <td className="px-5 py-3 muted">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="section-title">{c.pilotTitle}</h2>
        <ul className="grid gap-3 text-sm md:grid-cols-2">
          {c.pilot.map((x) => (
            <li key={x} className="card flex gap-3 p-4"><span aria-hidden className="text-brand">•</span><span>{x}</span></li>
          ))}
        </ul>
      </section>

      <section className="mb-10 grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-1 font-bold">{c.cabinet}</h3>
          <p className="mb-3 text-sm muted">{c.cabinetNote}</p>
          <Link href={`/${l}/publisher`} className="btn btn-primary">Otvori kabinet</Link>
        </div>
        <div className="card p-5">
          <h3 className="mb-1 font-bold">{c.demo}</h3>
          <p className="mb-3 text-sm muted">{c.demoNote}</p>
          <Link href={`/${l}/work/nocna-straza`} className="btn btn-ghost">Demo</Link>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 className="section-title">{c.linksTitle}</h2>
          <p className="text-sm muted">{c.formNote}</p>
        </div>
        <PublisherLeadForm />
      </section>
    </main>
  );
}
