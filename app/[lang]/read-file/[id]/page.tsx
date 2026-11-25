import fs from 'node:fs/promises';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { resolveStoredFile } from '@/lib/user-files';
import { normalizeText, splitParagraphs } from '@/lib/personal-reader';
import { parseEpub, listComicPages } from '@/lib/epub';
import { parseFb2 } from '@/lib/fb2';
import { isLang, type Lang } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

const TXT: Record<Lang, {
  back: string; download: string; empty: string; unsupported: string; reading: string;
}> = {
  sr: { back: 'Nazad u biblioteku', download: 'Preuzmi fajl', empty: 'Tekst nije pronađen.', unsupported: 'Ovaj format još nije podržan u čitaonici — preuzmite fajl.', reading: 'Čitanje' },
  ru: { back: 'Назад в библиотеку', download: 'Скачать файл', empty: 'Текст не найден.', unsupported: 'Этот формат пока не поддерживается в читалке — скачайте файл.', reading: 'Чтение' },
  en: { back: 'Back to library', download: 'Download file', empty: 'Text not found.', unsupported: 'This format is not yet supported in the reader — download the file.', reading: 'Reading' },
};

export default async function ReadFilePage({ params, searchParams }: { params: Promise<{ lang: string; id: string }>; searchParams: Promise<{ page?: string }> }) {
  const { lang, id } = await params;
  const { page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const t = TXT[l];

  const session = await readSession();
  if (!session) redirect(`/${l}/login`);

  const rows = await query<{ id: number; path: string; mime: string | null; title: string; format: string; size_bytes: number | string }>(
    `SELECT f.id, f.path, f.mime, f.size_bytes, b.title, b.format
       FROM user_book_files f JOIN user_books b ON b.id = f.user_book_id
      WHERE f.id = $1 AND b.user_id = $2`,
    [Number(id) || 0, session.uid],
  );
  const file = rows[0];
  if (!file) notFound();

  const back = `/${l}/library?tab=files`;
  const bar = (
    <div className="readerbar">
      <Link className="btn btn-ghost" href={back}>← {t.back}</Link>
      <div className="flex items-center gap-2">
        <span className="text-xs muted">{file.format.toUpperCase()}</span>
        <a className="btn" href={`/api/library/files/${file.id}`}>{t.download}</a>
      </div>
    </div>
  );

  if (file.format === 'txt') {
    let text = '';
    try {
      text = normalizeText(await fs.readFile(resolveStoredFile(file.path), 'utf8'));
    } catch {
      text = '';
    }
    const paragraphs = splitParagraphs(text);
    return (
      <main id="main" className="shell">
        {bar}
        <article className="reader" aria-label={t.reading}>
          <h1 style={{ marginBottom: 18 }}>{file.title}</h1>
          {paragraphs.length ? paragraphs.map((part, index) => <p key={index}>{part}</p>) : <p className="muted">{t.empty}</p>}
        </article>
      </main>
    );
  }

  if (file.format === 'pdf') {
    return (
      <main id="main" className="shell">
        {bar}
        <iframe
          title={file.title}
          src={`/api/library/files/${file.id}?inline=1`}
          style={{ width: '100%', height: '82vh', border: 0, borderRadius: 12 }}
        />
      </main>
    );
  }

  if (file.format === 'epub') {
    let parsed: ReturnType<typeof parseEpub> | null = null;
    try {
      parsed = parseEpub(await fs.readFile(resolveStoredFile(file.path)));
    } catch {
      parsed = null;
    }
    if (!parsed) {
      return (
        <main id="main" className="shell">
          {bar}
          <div className="card p-6"><h1>{file.title}</h1><p className="muted">{t.unsupported}</p></div>
        </main>
      );
    }
    return (
      <main id="main" className="shell">
        {bar}
        <article className="reader" aria-label={t.reading}>
          <h1 style={{ marginBottom: 6 }}>{file.title}</h1>
          <p className="muted" style={{ fontSize: 12, marginBottom: 18 }}>
            EPUB · {parsed.chapters.length} {lang === 'ru' ? 'глав' : lang === 'en' ? 'chapters' : 'glava'}
            {parsed.warnings.length ? ` · ${parsed.warnings.length} ${lang === 'ru' ? 'предупреждений' : 'warnings'}` : ''}
          </p>
          {parsed.chapters.map((chapter, index) => (
            <section key={index} style={{ marginBottom: 28 }}>
              <h2 style={{ marginBottom: 10 }}>{chapter.title}</h2>
              <div dangerouslySetInnerHTML={{ __html: chapter.html }} />
            </section>
          ))}
        </article>
      </main>
    );
  }

  if (file.format === 'fb2') {
    let parsed: ReturnType<typeof parseFb2> | null = null;
    try {
      parsed = parseFb2(await fs.readFile(resolveStoredFile(file.path)));
    } catch {
      parsed = null;
    }
    if (!parsed) {
      return (
        <main id="main" className="shell">
          {bar}
          <div className="card p-6"><h1>{file.title}</h1><p className="muted">{t.unsupported}</p></div>
        </main>
      );
    }
    return (
      <main id="main" className="shell">
        {bar}
        <article className="reader" aria-label={t.reading}>
          <h1 style={{ marginBottom: 6 }}>{parsed.title || file.title}</h1>
          <p className="muted" style={{ fontSize: 12, marginBottom: 18 }}>
            FB2{parsed.author ? ` · ${parsed.author}` : ''} · {parsed.chapters.length} {lang === 'ru' ? 'глав' : lang === 'en' ? 'chapters' : 'glava'}
          </p>
          {parsed.chapters.map((chapter, index) => (
            <section key={index} style={{ marginBottom: 28 }}>
              <h2 style={{ marginBottom: 10 }}>{chapter.title}</h2>
              <div dangerouslySetInnerHTML={{ __html: chapter.html }} />
            </section>
          ))}
        </article>
      </main>
    );
  }

  if (file.format === 'cbz') {
    let pages: ReturnType<typeof listComicPages> = [];
    try {
      pages = listComicPages(await fs.readFile(resolveStoredFile(file.path)));
    } catch {
      pages = [];
    }
    if (!pages.length) {
      return (
        <main id="main" className="shell">
          {bar}
          <div className="card p-6"><h1>{file.title}</h1><p className="muted">{t.unsupported}</p></div>
        </main>
      );
    }
    const current = Math.min(Math.max(1, page), pages.length);
    const prev = current > 1 ? current - 1 : null;
    const next = current < pages.length ? current + 1 : null;
    const href = (n: number) => `/${lang}/read-file/${file.id}?page=${n}`;
    return (
      <main id="main" className="shell">
        {bar}
        <div className="flex items-center justify-between" style={{ margin: '8px 0 12px' }}>
          {prev ? <Link className="btn" href={href(prev)}>←</Link> : <span />}
          <strong>{current} / {pages.length}</strong>
          {next ? <Link className="btn" href={href(next)}>→</Link> : <span />}
        </div>
        <img
          src={`/api/library/files/${file.id}/page/${current}`}
          alt={`${file.title} — ${current}`}
          style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 12 }}
        />
      </main>
    );
  }

  return (
    <main id="main" className="shell">
      {bar}
      <div className="card p-6">
        <h1 style={{ marginBottom: 8 }}>{file.title}</h1>
        <p className="muted">{t.unsupported}</p>
      </div>
    </main>
  );
}
