export const LANGS = ['sr', 'en', 'ru'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'sr';

export function isLang(v: string): v is Lang {
  return (LANGS as readonly string[]).includes(v);
}

type Dict = Record<string, string>;

const sr: Dict = {
  brand: 'TeroLibrary',
  nav_home: 'Početna', nav_catalog: 'Katalog', nav_library: 'Moja biblioteka', nav_login: 'Prijava', nav_register: 'Registracija',
  nav_top: 'Top', nav_community: 'Zajednica', nav_authors: 'Za autore', nav_publishers: 'Izdavači',
  nav_books: 'Knjige', nav_fanfics: 'Fanfikcija', nav_graphic: 'Grafička literatura',
  hero_title: 'Priče koje se čitaju u jednom dahu',
  hero_sub: 'Knjige, samizdat, fanfikcija i grafička literatura na jednom mestu. Otkrij, čitaj i podrži autore.',
  cta_read: 'Počni da čitaš', catalog_title: 'Katalog', catalog_empty: 'Još nema objavljenih dela.',
  search_placeholder: 'Pretraži po naslovu, autoru ili fandomu', login_title: 'Prijava', email: 'E-pošta', password: 'Lozinka',
  display_name: 'Ime ili nadimak', submit_login: 'Prijavi se', submit_register: 'Napravi nalog', logout: 'Odjava',
  err_required: 'Popuni sva polja', err_credentials: 'Pogrešna e-pošta ili lozinka',
  err_exists: 'Nalog sa ovom e-poštom već postoji', ok_registered: 'Nalog je napravljen',
};

const en: Dict = {
  brand: 'TeroLibrary',
  nav_home: 'Home', nav_catalog: 'Explore', nav_library: 'My library', nav_login: 'Sign in', nav_register: 'Sign up',
  nav_top: 'Top', nav_community: 'Community', nav_authors: 'For authors', nav_publishers: 'Publishers',
  nav_books: 'Books', nav_fanfics: 'Fan fiction', nav_graphic: 'Graphic literature',
  hero_title: 'Stories you want to return to',
  hero_sub: 'Publisher books, self-published works, fan fiction and graphic literature in one place. Discover, read and support creators.',
  cta_read: 'Start reading', catalog_title: 'Catalog', catalog_empty: 'No published works yet.',
  search_placeholder: 'Search by title, author or fandom', login_title: 'Sign in', email: 'Email', password: 'Password',
  display_name: 'Name or nickname', submit_login: 'Sign in', submit_register: 'Create account', logout: 'Sign out',
  err_required: 'Please fill in all fields', err_credentials: 'Incorrect email or password',
  err_exists: 'An account with this email already exists', ok_registered: 'Account created',
};

const ru: Dict = {
  brand: 'TeroLibrary',
  nav_home: 'Главная', nav_catalog: 'Каталог', nav_library: 'Моя библиотека', nav_login: 'Войти', nav_register: 'Регистрация',
  nav_top: 'Топ', nav_community: 'Сообщество', nav_authors: 'Авторам', nav_publishers: 'Издательства',
  nav_books: 'Книги', nav_fanfics: 'Фанфики', nav_graphic: 'Графическая литература',
  hero_title: 'Истории, в которые хочется возвращаться',
  hero_sub: 'Книги издательств, самиздат, фанфики и графическая литература на одной платформе. Открывай, читай и поддерживай авторов.',
  cta_read: 'Начать читать', catalog_title: 'Каталог', catalog_empty: 'Пока нет опубликованных произведений.',
  search_placeholder: 'Поиск по названию, автору или фэндому', login_title: 'Вход', email: 'Электронная почта', password: 'Пароль',
  display_name: 'Имя или псевдоним', submit_login: 'Войти', submit_register: 'Создать аккаунт', logout: 'Выйти',
  err_required: 'Заполните все поля', err_credentials: 'Неверная почта или пароль',
  err_exists: 'Аккаунт с такой почтой уже существует', ok_registered: 'Аккаунт создан',
};

export const dict: Record<Lang, Dict> = { sr, en, ru };

export function t(lang: Lang, key: string): string {
  return dict[lang][key] ?? dict[DEFAULT_LANG][key] ?? key;
}
