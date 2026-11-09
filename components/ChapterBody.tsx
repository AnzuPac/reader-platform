'use client';
import { useState } from 'react';

type Lang = 'sr' | 'en' | 'ru';

const LABEL: Record<Lang, string> = { sr: 'SR', en: 'EN', ru: 'RU' };

export default function ChapterBody({
  chapterId,
  initialHtml,
  originalLang = 'sr',
}: {
  chapterId: number;
  initialHtml: string;
  originalLang?: Lang;
}) {
  const [content, setContent] = useState(initialHtml);
  const [lang, setLang] = useState<Lang>(originalLang);
  const [busy, setBusy] = useState<Lang | null>(null);
  const [note, setNote] = useState('');

  async function switchTo(target: Lang) {
    if (target === lang) return;
    if (target === originalLang) {
      setContent(initialHtml);
      setLang(target);
      setNote('');
      return;
    }
    setBusy(target);
    setNote('');
    try {
      const r = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterId, lang: target }),
      });
      const j = await r.json();
      if (!r.ok) { setNote('Перевод не удался: ' + (j.error || r.status)); return; }
      setContent(j.content);
      setLang(target);
      setNote(j.cached ? 'Перевод из кэша' : 'Переведено ИИ');
    } catch {
      setNote('Перевод не удался');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="muted">Читать на:</span>
        {(['sr', 'en', 'ru'] as Lang[]).map((code) => (
          <button
            key={code}
            onClick={() => switchTo(code)}
            disabled={busy !== null}
            className={`rounded px-2.5 py-1 font-bold ${
              lang === code ? 'bg-brand text-white' : 'border border-line text-mist hover:text-ink'
            }`}
          >
            {busy === code ? '…' : LABEL[code]}
          </button>
        ))}
        {note ? <span className="rounded bg-brand/15 px-2 py-1 text-brand">{note}</span> : null}
      </div>

      <div className="reader-surface px-1 py-2 sm:px-6 sm:py-5">
        <article className="prose-reader whitespace-pre-line" dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </>
  );
}
