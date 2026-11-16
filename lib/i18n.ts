export const LANGS = ['sr', 'en', 'ru'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'sr';

export function isLang(v: string): v is Lang {
  return (LANGS as readonly string[]).includes(v);
}

type Dict = Record<string, string>;

const sr: Dict = {
  brand: 'Čitaonica',
  nav_home: 'Početna',
  nav_catalog: 'Katalog',
  nav_library: 'Moja biblioteka',
  nav_login: 'Prijava',
  nav_register: 'Registracija',
  hero_title: 'Priče koje se čitaju u jednom dahu',
  hero_sub: 'Romani i priče domaćih autora. Čitaj besplatno, podrži pisce pretplatom.',
  cta_read: 'Počni da čitaš',
  catalog_title: 'Katalog',
  catalog_empty: 'Još nema objavljenih dela.',
  search_placeholder: 'Pretraga po naslovu ili autoru',
  login_title: 'Prijava',
  email: 'E-pošta',
  password: 'Lozinka',
  display_name: 'Ime ili nadimak',
  submit_login: 'Prijavi se',
  submit_register: 'Napravi nalog',
  logout: 'Odjava',
  err_required: 'Popuni sva polja',
  err_credentials: 'Pogrešna e-pošta ili lozinka',
  err_exists: 'Nalog sa ovom e-poštom već postoji',
  ok_registered: 'Nalog je napravljen',
};

const en: Dict = {
  brand: 'Reader',
  nav_home: 'Home',
  nav_catalog: 'Catalog',
  nav_library: 'My library',
  nav_login: 'Sign in',
  nav_register: 'Sign up',
  hero_title: 'Stories you read in one breath',
  hero_sub: 'Novels and stories by local authors. Read free, support writers with a subscription.',
  cta_read: 'Start reading',
  catalog_title: 'Catalog',
  catalog_empty: 'No published works yet.',
  search_placeholder: 'Search by title or author',
  login_title: 'Sign in',
  email: 'Email',
  password: 'Password',
  display_name: 'Name or nickname',
  submit_login: 'Sign in',
  submit_register: 'Create account',
  logout: 'Sign out',
  err_required: 'Fill in all fields',
  err_credentials: 'Wrong email or password',
  err_exists: 'An account with this email already exists',
  ok_registered: 'Account created',
};

const ru: Dict = {
  brand: 'Čitaonica',
  nav_home: 'Početna',
  nav_catalog: 'Katalog',
  nav_library: 'Moja biblioteka',
  nav_login: 'Prijava',
  nav_register: 'Registracija',
  hero_title: 'Priče koje se čitaju u dahu',
  hero_sub: 'Romani i priče domaćih autora. Čitaj besplatno, podrži autore pretplatom.',
  cta_read: 'Počni da čitaš',
  catalog_title: 'Katalog',
  catalog_empty: 'Još nema objavljenih dela.',
  search_placeholder: 'Pretraga po naslovu ili autoru',
  login_title: 'Prijava',
  email: 'Pošta',
  password: 'Lozinka',
  display_name: 'Ime ili nadimak',
  submit_login: 'Prijava',
  submit_register: 'Napravi nalog',
  logout: 'Odjavi se',
  err_required: 'Popuni sva polja',
  err_credentials: 'Pogrešna adresa ili lozinka',
  err_exists: 'Nalog sa tom adresom već postoji',
  ok_registered: 'Nalog napravljen',
};

export const dict: Record<Lang, Dict> = { sr, en, ru };

export function t(lang: Lang, key: string): string {
  return dict[lang][key] ?? dict[DEFAULT_LANG][key] ?? key;
}
