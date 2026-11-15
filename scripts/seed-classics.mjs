// Классика (общественное достояние): короткие оригинальные описания, свободный доступ.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const dir = process.env.SQLITE_DIR || path.join(process.cwd(), 'data');
mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(path.join(dir, 'reader.db'));

// Колонка могла не появиться, если миграция ещё не прогонялась приложением.
const cols = db.prepare('PRAGMA table_info(works)').all().map((c) => c.name);
if (!cols.includes('is_classic')) db.exec('ALTER TABLE works ADD COLUMN is_classic INTEGER NOT NULL DEFAULT 0');

const author = db.prepare("SELECT id FROM users WHERE email = 'klasici@yureid.local'").get()
  || db.prepare("INSERT INTO users (email, display_name, role) VALUES ('klasici@yureid.local','Klasici','author') RETURNING id").get();

const works = [
  { slug: 'hasanaginica', title: 'Hasanaginica', desc: 'Narodna balada zapisana u Dalmaciji; priča o ponosu, tugovanju i sudbini žene u osmanskom svetu. Tekst je deo usmene tradicije i u javnom je domenu.', chapters: [
    ['Prvi deo', 'Balada počinje slikom bolne supruge koja moli brata da je poseti. Pesma je poznata po uzdržanom tonu i ponavljanjima koja pojačavaju tugu.'],
    ['Drugi deo', 'Rasplet donosi tišinu i osudu — junakinja ostaje sama sa svojom odlukom. Delo se često čita kao primer rane zapisane usmene lirike.'],
  ]},
  { slug: 'smrt-smail-age-cengica', title: 'Smrt Smail-age Čengića', desc: 'Epska pesma Ivana Mažuranića (1846), jedno od najznačajnijih dela hrvatskog i srpskog romantizma. U javnom je domenu.', chapters: [
    ['Agovanje', 'Uvod prikazuje silu i strah; pesnik gradi sliku vlasti koja počiva na nasilju.'],
    ['Noćnik', 'Središnji deo uvodi lik koji nosi odluku i unutrašnji sukob, sa naglašenim moralnim pitanjima.'],
  ]},
  { slug: 'srpske-narodne-pripovetke', title: 'Srpske narodne pripovetke', desc: 'Izbor iz zbirke Vuka Stefanovića Karadžića (19. vek): basne, predanja i priče o lukavstvu i pravdi. Zapis je u javnom domenu.', chapters: [
    ['O zbirci', 'Karadžić je beležio govor naroda i tako sačuvao forme koje su se prenosile usmeno. Zbirka je uticala na književni jezik i školu.'],
    ['Motive', 'Ponavljaju se motivi provere, nagrade za poštenje i kazne za oholost — obrasci zajednički za usmenu epiku regiona.'],
  ]},
];

for (const w of works) {
  const existing = db.prepare('SELECT id FROM works WHERE slug = ?').get(w.slug);
  let workId = existing?.id;
  if (!workId) {
    workId = db.prepare(
      "INSERT INTO works (slug, author_id, original_language, title, description, status, completion, is_classic, published_at) VALUES (?,?,'sr',?,?,'published','completed',1,CURRENT_TIMESTAMP) RETURNING id"
    ).get(w.slug, author.id, w.title, w.desc).id;
  } else {
    db.prepare('UPDATE works SET is_classic = 1 WHERE id = ?').run(workId);
  }
  w.chapters.forEach(([title, content], i) => {
    const has = db.prepare('SELECT id FROM chapters WHERE work_id = ? AND number = ?').get(workId, i + 1);
    if (!has) {
      db.prepare("INSERT INTO chapters (work_id, number, title, content, access, status, published_at) VALUES (?,?,?,?,'free','published',CURRENT_TIMESTAMP)")
        .run(workId, i + 1, title, content);
    }
  });
  console.log('·', w.title, '| глав:', w.chapters.length);
}
console.log('Готово: классика в базе');
