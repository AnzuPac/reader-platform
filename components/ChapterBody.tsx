'use client';
import { useEffect, useState } from 'react';
import ParagraphComments from './ParagraphComments';

type Lang = 'sr' | 'en' | 'ru';

const LABEL: Record<Lang, string> = { sr: 'SR', en: 'EN', ru: 'RU' };

export default function ChapterBody({
  chapterId,
  initialHtml,
  originalLang = 'sr',
  protected: isProtected = false,
  fetchOnMount = false,
  script,
  paragraphComments = false,
}: {
  chapterId: number;
  initialHtml: string;
  originalLang?: Lang;
  protected?: boolean;
  fetchOnMount?: boolean;
  script?: 'lat' | 'cir';
  paragraphComments?: boolean;
}) {
  const [content, setContent] = useState(initialHtml);
  const [originContent, setOriginContent] = useState(initialHtml);
  const [lang, setLang] = useState<Lang>(originalLang);
  const [busy, setBusy] = useState<Lang | null>(null);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>(fetchOnMount ? 'loading' : 'idle');
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (!fetchOnMount) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/chapter/text?chapter=${chapterId}${script ? `&script=${script}` : ''}`, { cache: 'no-store' });
        const j = await r.json().catch(() => ({}));
        if (!alive) return;
        if (r.status === 429) {
          setStatus('error');
          setErrorText('Previše zahteva za tekst. Sačekaj minut i pokušaj ponovo.');
          return;
        }
        if (r.status === 403 && j.error === 'device_limit') {
          setStatus('error');
          setErrorText(String(j.message || 'Dostigli ste limit od 3 uređaja za plaćeni sadržaj.'));
          return;
        }
        if (!r.ok) {
          setStatus('error');
          setErrorText(j.error === 'locked' ? 'Ova glava više nije dostupna. Osveži stranicu.' : 'Tekst nije moguće učitati.');
          return;
        }
        setContent(String(j.content || ''));
        setOriginContent(String(j.content || ''));
        setStatus('idle');
      } catch {
        if (alive) {
          setStatus('error');
          setErrorText('Greška u mreži.');
        }
      }
    })();
    return () => { alive = false; };
  }, [chapterId, fetchOnMount]);

  async function switchTo(target: Lang) {
    if (target === lang) return;
    if (target === originalLang) {
      setContent(originContent);
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

  if (status === 'loading') {
    return <div className="py-16 text-center muted">Učitavam tekst…</div>;
  }
  if (status === 'error') {
    return (
      <div className="card p-6">
        <h2 className="mb-2 text-lg font-semibold">🔒 Tekst nije dostupan</h2>
        <p className="muted">{errorText}</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="muted">Čitaj na:</span>
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

      <div
        className={`reader-surface px-1 py-2 sm:px-6 sm:py-5 ${isProtected ? 'paid-text' : ''}`}
        onCopy={isProtected ? (e) => e.preventDefault() : undefined}
        onCut={isProtected ? (e) => e.preventDefault() : undefined}
        onContextMenu={isProtected ? (e) => e.preventDefault() : undefined}
        onDragStart={isProtected ? (e) => e.preventDefault() : undefined}
      >
        <article className="prose-reader whitespace-pre-line" dangerouslySetInnerHTML={{ __html: content }} />
      </div>
      {paragraphComments ? <ParagraphComments chapterId={chapterId} /> : null}
    </>
  );
}
