import Link from 'next/link';
import { isLang, type Lang } from '@/lib/i18n';

export const dynamic = 'force-static';

type PageKey = 'about' | 'rules' | 'help';

const CONTENT: Record<PageKey, Record<Lang, { title: string; lead: string; blocks: { h: string; p: string }[] }>> = {
  about: {
    sr: {
      title: 'O nama',
      lead: 'TeroLibrary je platforma za čitanje i objavljivanje knjiga, stripova i fanfikcije — na srpskom, ruskom i engleskom.',
      blocks: [
        { h: 'Šta radimo', p: 'Autori objavljuju poglavlja po poglavlje, čitaoci prate omiljena dela, a izdavači prodaju knjige i dobijaju royalty na svaku prodaju.' },
        { h: 'Kako se plaća', p: 'Poglavlja mogu biti besplatna, pojedinačno kupljena ili dostupna uz pretplatu. Cene su u dinarima, a deo svake prodaje ide autoru.' },
        { h: 'Kontakt', p: 'Za saradnju, pitanja i prijave: support@terolibrary.com. Odgovaramo u roku od dva radna dana.' },
      ],
    },
    ru: {
      title: 'О платформе',
      lead: 'TeroLibrary — платформа для чтения и публикации книг, комиксов и фанфиков на сербском, русском и английском.',
      blocks: [
        { h: 'Что мы делаем', p: 'Авторы публикуют главы по одной, читатели следят за любимыми произведениями, а издатели продают книги и получают роялти с каждой продажи.' },
        { h: 'Как устроена оплата', p: 'Главы бывают бесплатными, купленными поштучно или доступными по подписке. Цены в динарах, часть каждой продажи уходит автору.' },
        { h: 'Связь', p: 'По вопросам сотрудничества и поддержки: support@terolibrary.com. Отвечаем в течение двух рабочих дней.' },
      ],
    },
    en: {
      title: 'About',
      lead: 'TeroLibrary is a platform for reading and publishing books, comics and fanfiction in Serbian, Russian and English.',
      blocks: [
        { h: 'What we do', p: 'Authors publish chapter by chapter, readers follow their favourite works, and publishers sell books and earn royalties on every sale.' },
        { h: 'How payment works', p: 'Chapters can be free, bought individually, or included in a subscription. Prices are in dinars and part of every sale goes to the author.' },
        { h: 'Contact', p: 'For partnerships, questions and reports: support@terolibrary.com. We reply within two business days.' },
      ],
    },
  },
  rules: {
    sr: {
      title: 'Pravila',
      lead: 'Kratka pravila koja važe za sve korisnike platforme.',
      blocks: [
        { h: 'Sadržaj', p: 'Objavljujte samo svoje delo ili delo za koje imate prava. Tuđi tekst, skenirane knjige i prevodi bez dozvole biće uklonjeni.' },
        { h: 'Uzrast', p: 'Dela sa eksplicitnim sadržajem moraju imati oznaku 18+. Prikrivanje oznake je osnov za uklanjanje.' },
        { h: 'Ponašanje', p: 'Bez uvreda, govora mržnje, spamovanja i reklamiranja van predviđenih mesta. Prijave se razmatraju u roku od 48 sati.' },
      ],
    },
    ru: {
      title: 'Правила',
      lead: 'Короткие правила, действующие для всех пользователей платформы.',
      blocks: [
        { h: 'Контент', p: 'Публикуйте только своё произведение или то, на которое у вас есть права. Чужой текст, сканы книг и переводы без разрешения удаляются.' },
        { h: 'Возраст', p: 'Произведения с откровенным содержанием обязаны иметь метку 18+. Скрытие метки — основание для удаления.' },
        { h: 'Поведение', p: 'Без оскорблений, разжигания вражды, спама и рекламы вне отведённых мест. Жалобы рассматриваются в течение 48 часов.' },
      ],
    },
    en: {
      title: 'Rules',
      lead: 'Short rules that apply to every user of the platform.',
      blocks: [
        { h: 'Content', p: 'Publish only your own work or work you hold rights to. Someone else’s text, scanned books and unauthorised translations are removed.' },
        { h: 'Age', p: 'Works with explicit content must carry an 18+ label. Hiding the label is grounds for removal.' },
        { h: 'Behaviour', p: 'No insults, hate speech, spam or advertising outside the designated places. Reports are reviewed within 48 hours.' },
      ],
    },
  },
  help: {
    sr: {
      title: 'Pomoć',
      lead: 'Najčešća pitanja o čitanju, kupovini i objavljivanju.',
      blocks: [
        { h: 'Kako da nastavim čitanje?', p: 'Otvori „Moja biblioteka“ — pozicija se pamti automatski. Ako je promeniš na drugom uređaju, sinhronizacija ide preko naloga.' },
        { h: 'Kupio sam poglavlje, a ne vidim ga', p: 'Osveži stranicu; ako pristup i dalje nema, pošalji broj naloga i naslov na support@terolibrary.com — proveravamo ručno.' },
        { h: 'Kako da objavim delo?', p: 'Otvori „Za autore“, popuni podatke o delu, dodaj poglavlja i pošalji na pregled. Prvo poglavlje objavljuje se odmah po odobrenju.' },
      ],
    },
    ru: {
      title: 'Помощь',
      lead: 'Частые вопросы о чтении, покупках и публикации.',
      blocks: [
        { h: 'Как продолжить чтение?', p: 'Откройте «Моя библиотека» — позиция сохраняется автоматически. На другом устройстве синхронизация идёт через аккаунт.' },
        { h: 'Купил главу, а её не видно', p: 'Обновите страницу; если доступа всё равно нет — напишите номер аккаунта и название на support@terolibrary.com, проверим вручную.' },
        { h: 'Как опубликовать произведение?', p: 'Откройте «Авторам», заполните данные о произведении, добавьте главы и отправьте на проверку. Первая глава публикуется сразу после одобрения.' },
      ],
    },
    en: {
      title: 'Help',
      lead: 'Frequently asked questions about reading, buying and publishing.',
      blocks: [
        { h: 'How do I continue reading?', p: 'Open “My library” — your position is saved automatically. On another device it syncs through your account.' },
        { h: 'I bought a chapter but cannot see it', p: 'Refresh the page; if access is still missing, send your account id and the title to support@terolibrary.com and we will check manually.' },
        { h: 'How do I publish a work?', p: 'Open “For authors”, fill in the work details, add chapters and submit for review. The first chapter goes live right after approval.' },
      ],
    },
  },
};

export function legalPage(key: PageKey) {
  return async function Page({ params }: { params: Promise<{ lang: string }> }) {
    const { lang } = await params;
    const l = (isLang(lang) ? lang : 'sr') as Lang;
    const c = CONTENT[key][l];

    return (
      <main id="main" className={`tl-screen tl-screen--legal tl-screen--${key} mx-auto max-w-3xl px-5 py-12`}>
        <h1 className="mb-3 text-3xl font-bold">{c.title}</h1>
        <p className="mb-8 text-lg muted">{c.lead}</p>
        <div className="space-y-6">
          {c.blocks.map((b) => (
            <section key={b.h} className="card p-6">
              <h2 className="mb-2 text-xl font-semibold">{b.h}</h2>
              <p className="muted">{b.p}</p>
            </section>
          ))}
        </div>
        <div className="mt-8 flex gap-3">
          <Link href={`/${l}/catalog`} className="btn btn-ghost">← {l === 'ru' ? 'В каталог' : l === 'en' ? 'To catalog' : 'Na katalog'}</Link>
          <Link href={`/${l}/help`} className="btn btn-ghost">{CONTENT.help[l].title}</Link>
          <Link href={`/${l}/rules`} className="btn btn-ghost">{CONTENT.rules[l].title}</Link>
        </div>
      </main>
    );
  };
}
