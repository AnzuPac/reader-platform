import Link from 'next/link';
import { isLang, type Lang } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

const COPY: Record<Lang, { kicker: string; title: string; lead: string; cards: { title: string; body: string; href: string; action: string }[] }> = {
  ru: { kicker: 'Сообщество TeroLibrary', title: 'Читайте. Создавайте. Находите своих.', lead: 'Откройте новые произведения, собирайте личные подборки, следите за авторами и знакомьтесь с издательствами.', cards: [
    { title: 'Каталог произведений', body: 'Новые книги, фанфики и комиксы — исследуйте каталог и находите следующую историю.', href: '/catalog', action: 'Перейти в каталог' },
    { title: 'Коллекции читателей', body: 'Тематические подборки произведений и коллекции, созданные участниками.', href: '/collections', action: 'Смотреть коллекции' },
    { title: 'Авторы', body: 'Публикуйте собственные истории, управляйте главами и следите за статистикой.', href: '/author', action: 'Кабинет автора' },
    { title: 'Издательства', body: 'Информация о партнёрстве, публикациях, правах и пилотной программе.', href: '/publishers', action: 'Для издателей' },
  ] },
  sr: { kicker: 'TeroLibrary zajednica', title: 'Čitajte. Stvarajte. Pronađite svoje.', lead: 'Otkrijte nova dela, pravite kolekcije, pratite autore i upoznajte izdavače.', cards: [
    { title: 'Katalog dela', body: 'Knjige, fanfiction i stripovi — istražite katalog i pronađite sledeću priču.', href: '/catalog', action: 'Otvori katalog' },
    { title: 'Kolekcije čitalaca', body: 'Tematske zbirke dela i kolekcije koje stvaraju članovi.', href: '/collections', action: 'Pogledaj kolekcije' },
    { title: 'Autori', body: 'Objavljujte priče, upravljajte poglavljima i pratite statistiku.', href: '/author', action: 'Autorski kabinet' },
    { title: 'Izdavači', body: 'Informacije o saradnji, objavljivanju, pravima i pilot programu.', href: '/publishers', action: 'Za izdavače' },
  ] },
  en: { kicker: 'TeroLibrary community', title: 'Read. Create. Find your people.', lead: 'Discover new works, curate collections, follow authors and connect with publishers.', cards: [
    { title: 'Works catalogue', body: 'Books, fanfiction and comics — explore the catalogue and find your next story.', href: '/catalog', action: 'Browse catalogue' },
    { title: 'Reader collections', body: 'Themed lists and collections curated by community members.', href: '/collections', action: 'Explore collections' },
    { title: 'Authors', body: 'Publish stories, manage chapters and track your readership.', href: '/author', action: 'Author studio' },
    { title: 'Publishers', body: 'Partnership information, publishing, rights and the pilot programme.', href: '/publishers', action: 'For publishers' },
  ] },
};

export default async function CommunityPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const c = COPY[l];
  return <main id="main" className="tl-screen tlp-stage8-community mx-auto max-w-6xl px-5 py-10">
    <header className="tlp-stage8-community-hero">
      <p className="tlp-stage8-kicker">{c.kicker}</p><h1>{c.title}</h1><p>{c.lead}</p>
    </header>
    <div className="tlp-stage8-community-grid">
      {c.cards.map((card, i) => <article className="tlp-stage8-community-card" key={card.title}>
        <span className="tlp-stage8-community-number">0{i + 1}</span><h2>{card.title}</h2><p>{card.body}</p>
        <Link href={`/${l}${card.href}`} className="btn btn-primary">{card.action} →</Link>
      </article>)}
    </div>
  </main>;
}
