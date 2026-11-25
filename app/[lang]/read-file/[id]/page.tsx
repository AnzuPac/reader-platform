import fs from 'node:fs/promises';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { resolveStoredFile } from '@/lib/user-files';
import { normalizeText, splitParagraphs } from '@/lib/personal-reader';
import { isLang, type Lang } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

const TXT: Record<Lang, {
  back: string; download: string; empty: string; unsupported: string; reading: string;
}> = {
  sr: { back: 'Nazad u biblioteku', download: 'Preuzmi fajl', empty: 'Tekst nije pronađen.', unsupported: 'Ovaj format još nije podržan u čitaonici — preuzmite fajl.', reading: 'Čitanje' },
  ru: { back: 'Назад в библиотеку', download: 'Скачать файл', empty: 'Текст не найден.', unsupported: 'Этот формат пока не поддерживается в читалке — скачайте файл.', reading: 'Чтение' },
  en: { back: 'Back to library', download: 'Download file', empty: 'Text not found.', unsupported: 'This format is not yet supported in the reader — download the file.', reading: 'Reading' },
};

export default async function ReadFilePage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
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
