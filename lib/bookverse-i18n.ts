import type { Lang } from './i18n';

/**
 * Подписи интерфейса каталога BOOKVERSE на трёх языках.
 *
 * Названия произведений, имена авторов и содержимое книг здесь не переводятся:
 * это оригинальные данные. Локализуется только обвязка — навигация, кнопки,
 * заголовки разделов, фильтры и подсказки.
 */

type SectionCopy = { label: string; eyebrow: string; title: string; subtitle: string; action: string };

export type CatalogDict = {
  sections: { books: SectionCopy; fanfics: SectionCopy; comics: SectionCopy };
  platform: string;
  mySpace: string;
  library: string;
  history: string;
  bookmarks: string;
  publishing: string;
  publishingSub: string;
  guest: string;
  guestSub: string;
  login: string;
  searchPlaceholder: string;
  allTypes: string;
  sectionBooks: string;
  sectionFanfics: string;
  sectionComics: string;
  viewAll: string;
  catalogKicker: string;
  catalogTitle: string;
  wholeCatalog: string;
  filters: { forYou: string; popular: string; fresh: string; completed: string };
  empty: string;
  promoAuthorKicker: string;
  promoAuthorTitle: string;
  promoAuthorText: string;
  promoAuthorLink: string;
  promoLibKicker: string;
  promoLibTitle: string;
  promoLibText: string;
  promoLibLink: string;
  footerTagline: string;
  footerAbout: string;
  footerRules: string;
  footerHelp: string;
  badgeClassic: string;
  badgeCompleted: string;
  genreBook: string;
  genreFanfic: string;
  genreManga: string;
  notifications: string;
  brandHome: string;
};

const sr: CatalogDict = {
  sections: {
    books: { label: 'Knjige', eyebrow: 'KNJIGE I ORIGINALI', title: 'Priče koje ostaju s tobom', subtitle: 'Izdavaštva, nezavisni autori i nove web-novele.', action: 'Otvori katalog knjiga' },
    fanfics: { label: 'Fanfikcija', eyebrow: 'FANFIKCIJA', title: 'Poznati svetovi. Nove priče.', subtitle: 'Fanatske priče, omiljeni fandomi i novi autori.', action: 'Istraži fanfikove' },
    comics: { label: 'Manga i stripovi', eyebrow: 'MANGA & STRIPOVI', title: 'Priče u svakom kadru', subtitle: 'Manga, manhva, manhua, zapadni stripovi i grafički romani.', action: 'Otvori katalog stripova' },
  },
  platform: 'PLATFORMA',
  mySpace: 'TVOJ PROSTOR',
  library: 'Moja biblioteka',
  history: 'Istorija čitanja',
  bookmarks: 'Obaleživači',
  publishing: 'Objavljujete priče?',
  publishingSub: 'Vaše mesto za stvaranje',
  guest: 'Gost',
  guestSub: 'Prijavite se ili otvorite nalog',
  login: 'Prijava',
  searchPlaceholder: 'Naslov, autor, žanr ili fandom...',
  allTypes: 'Svi tipovi',
  sectionBooks: 'Knjige',
  sectionFanfics: 'Fanfikcija',
  sectionComics: 'Manga i stripovi',
  viewAll: 'Vidi sve',
  catalogKicker: 'OTKRIJ NOVO',
  catalogTitle: 'Izabrano za tebe',
  wholeCatalog: 'Ceo katalog',
  filters: { forYou: 'Otkrij', popular: 'Popularno', fresh: 'Novo', completed: 'Završeno' },
  empty: 'Ništa nije nađeno. Promenite upit.',
  promoAuthorKicker: 'ZA AUTORE',
  promoAuthorTitle: 'Tvoja priča može početi ovde',
  promoAuthorText: 'Stvaraj, objavljuj i pronađi svoje čitaoce.',
  promoAuthorLink: 'Studio autora',
  promoLibKicker: 'TVOJA BIBLIOTEKA',
  promoLibTitle: 'Sve pročitano na jednom mestu',
  promoLibText: 'Sačuvaj priče i vrati im se kad god želiš.',
  promoLibLink: 'Otvori biblioteku',
  footerTagline: 'Prostor priča i mašte',
  footerAbout: 'O platformi',
  footerRules: 'Pravila',
  footerHelp: 'Pomoć',
  badgeClassic: 'Klasik',
  badgeCompleted: 'Završeno',
  genreBook: 'Knjiga',
  genreFanfic: 'Fanfik',
  genreManga: 'Manga · strip',
  notifications: 'Obaveštenja',
  brandHome: 'terolibrary — početna',
};

const ru: CatalogDict = {
  sections: {
    books: { label: 'Книги', eyebrow: 'КНИГИ И ОРИГИНАЛЫ', title: 'Истории, которые остаются с тобой', subtitle: 'Издательства, независимые авторы и новые веб-новеллы.', action: 'Открыть каталог книг' },
    fanfics: { label: 'Фанфики', eyebrow: 'ФАНФИКШЕН', title: 'Знакомые миры. Новые истории.', subtitle: 'Фанатские истории, любимые фандомы и новые авторы.', action: 'Исследовать фанфики' },
    comics: { label: 'Манга и комиксы', eyebrow: 'МАНГА И КОМИКСЫ', title: 'Истории в каждом кадре', subtitle: 'Манга, манхва, маньхуа, западные комиксы и графические романы.', action: 'Открыть каталог комиксов' },
  },
  platform: 'ПЛАТФОРМА',
  mySpace: 'ТВОЁ ПРОСТРАНСТВО',
  library: 'Моя библиотека',
  history: 'История чтения',
  bookmarks: 'Закладки',
  publishing: 'Публикуете истории?',
  publishingSub: 'Ваше место для творчества',
  guest: 'Гость',
  guestSub: 'Войти или создать аккаунт',
  login: 'Войти',
  searchPlaceholder: 'Название, автор, жанр или фандом...',
  allTypes: 'Все типы',
  sectionBooks: 'Книги',
  sectionFanfics: 'Фанфики',
  sectionComics: 'Манга и комиксы',
  viewAll: 'Смотреть всё',
  catalogKicker: 'ОТКРОЙ НОВОЕ',
  catalogTitle: 'Подобрано для тебя',
  wholeCatalog: 'Весь каталог',
  filters: { forYou: 'Подборка', popular: 'Популярное', fresh: 'Новинки', completed: 'Завершённые' },
  empty: 'Ничего не найдено. Попробуйте изменить запрос.',
  promoAuthorKicker: 'ДЛЯ АВТОРОВ',
  promoAuthorTitle: 'Твоя история может начаться здесь',
  promoAuthorText: 'Создавай, публикуй и находи своих читателей.',
  promoAuthorLink: 'Студия автора',
  promoLibKicker: 'ТВОЯ БИБЛИОТЕКА',
  promoLibTitle: 'Всё прочитанное в одном месте',
  promoLibText: 'Сохраняй истории и возвращайся к ним в любое время.',
  promoLibLink: 'Открыть библиотеку',
  footerTagline: 'Пространство историй и воображения',
  footerAbout: 'О платформе',
  footerRules: 'Правила',
  footerHelp: 'Помощь',
  badgeClassic: 'Классика',
  badgeCompleted: 'Завершено',
  genreBook: 'Книга',
  genreFanfic: 'Фанфик',
  genreManga: 'Манга · комикс',
  notifications: 'Уведомления',
  brandHome: 'terolibrary — главная',
};

const en: CatalogDict = {
  sections: {
    books: { label: 'Books', eyebrow: 'BOOKS & ORIGINALS', title: 'Stories that stay with you', subtitle: 'Publishers, independent authors and new web novels.', action: 'Open the book catalog' },
    fanfics: { label: 'Fanfiction', eyebrow: 'FANFICTION', title: 'Familiar worlds. New stories.', subtitle: 'Fan stories, favourite fandoms and new authors.', action: 'Explore fanfiction' },
    comics: { label: 'Manga & comics', eyebrow: 'MANGA & COMICS', title: 'A story in every frame', subtitle: 'Manga, manhwa, manhua, western comics and graphic novels.', action: 'Open the comics catalog' },
  },
  platform: 'PLATFORM',
  mySpace: 'YOUR SPACE',
  library: 'My library',
  history: 'Reading history',
  bookmarks: 'Bookmarks',
  publishing: 'Publishing stories?',
  publishingSub: 'Your place to create',
  guest: 'Guest',
  guestSub: 'Sign in or create an account',
  login: 'Sign in',
  searchPlaceholder: 'Title, author, genre or fandom...',
  allTypes: 'All types',
  sectionBooks: 'Books',
  sectionFanfics: 'Fanfiction',
  sectionComics: 'Manga & comics',
  viewAll: 'See all',
  catalogKicker: 'DISCOVER',
  catalogTitle: 'Picked for you',
  wholeCatalog: 'Whole catalog',
  filters: { forYou: 'Discover', popular: 'Popular', fresh: 'New', completed: 'Completed' },
  empty: 'Nothing found. Try a different query.',
  promoAuthorKicker: 'FOR AUTHORS',
  promoAuthorTitle: 'Your story can start here',
  promoAuthorText: 'Create, publish and find your readers.',
  promoAuthorLink: 'Author studio',
  promoLibKicker: 'YOUR LIBRARY',
  promoLibTitle: 'Everything you read in one place',
  promoLibText: 'Save stories and come back to them anytime.',
  promoLibLink: 'Open the library',
  footerTagline: 'A space for stories and imagination',
  footerAbout: 'About',
  footerRules: 'Rules',
  footerHelp: 'Help',
  badgeClassic: 'Classic',
  badgeCompleted: 'Completed',
  genreBook: 'Book',
  genreFanfic: 'Fanfic',
  genreManga: 'Manga · comic',
  notifications: 'Notifications',
  brandHome: 'terolibrary — home',
};

export const CATALOG_DICT: Record<Lang, CatalogDict> = { sr, ru, en };

export function catalogDict(lang: Lang): CatalogDict {
  return CATALOG_DICT[lang] || CATALOG_DICT.sr;
}
