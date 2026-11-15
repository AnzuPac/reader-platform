'use client';
import { useEffect, useState } from 'react';

type Lang = 'sr' | 'en' | 'ru';
type Script = 'lat' | 'cir';

const LABEL: Record<Lang, string> = { sr: 'SR', en: 'EN', ru: 'RU' };

export default function ChapterBody({
  chapterId,
  initialHtml,
  originalLang = 'sr',
  protected: isProtected = false,
  fetchOnMount = false,
  translitAllowed = false,
  paragraphCommentsEnabled = false,
}: {
  chapterId: number;
  initialHtml: string;
  originalLang?: Lang;
  protected?: boolean;
  fetchOnMount?: boolean;
  translitAllowed?: boolean;
  paragraphCommentsEnabled?: boolean;
}) {
  const [content, setContent] = useState(initialHtml);
  const [originContent, setOriginContent] = useState(initialHtml);
  const [lang, setLang] = useState<Lang>(originalLang);
  const [script, setScript] = useState<Script | null>(null);
  const [busy, setBusy] = useState<Lang | null>(null);
  const [scriptBusy, setScriptBusy] = useState<Script | null>(null);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>(fetchOnMount ? 'loading' : 'idle');
  const [errorText, setErrorText] = useState('');
  const [translitDenied, setTranslitDenied] = useState(false);

  useEffect(() => {
    if (!fetchOnMount) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/chapter/text?chapter=${chapterId}`, { cache: 'no-store' });
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
      setScript(null);
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
      setScript(null);
      setNote(j.cached ? 'Перевод из кэша' : 'Переведено ИИ');
    } catch {
      setNote('Перевод не удался');
    } finally {
      setBusy(null);
    }
  }

  /** Транслитерация выполняется на сервере: текст выдаётся уже в нужном письме. */
  async function switchScript(target: Script) {
    if (target === script) return;
    setScriptBusy(target);
    setNote('');
    try {
      const r = await fetch(`/api/chapter/text?chapter=${chapterId}&script=${target}`, { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (r.status === 403 && j.error === 'translit_not_allowed') {
        setTranslitDenied(true);
        setNote('Prava na prenos pisma nisu dozvoljena za ovo delo.');
        return;
      }
      if (!r.ok) { setNote('Prenos pisma nije uspeo.'); return; }
      setContent(String(j.content || ''));
      setScript(target);
      setLang(originalLang);
      setNote(target === 'lat' ? 'Pismo: latinica' : 'Pismo: ćirilica');
    } catch {
      setNote('Prenos pisma nije uspeo.');
    } finally {
      setScriptBusy(null);
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

        {translitAllowed && !translitDenied ? (
          <>
            <span className="ml-2 muted">Pismo:</span>
            <button
              onClick={() => switchScript('cir')}
              disabled={scriptBusy !== null || lang !== originalLang}
              className={`rounded px-2.5 py-1 font-bold ${
                script === 'cir' ? 'bg-brand text-white' : 'border border-line text-mist hover:text-ink'
              }`}
              title="Ćirilica"
            >
              {scriptBusy === 'cir' ? '…' : 'Ћир'}
            </button>
            <button
              onClick={() => switchScript('lat')}
              disabled={scriptBusy !== null || lang !== originalLang}
              className={`rounded px-2.5 py-1 font-bold ${
                script === 'lat' ? 'bg-brand text-white' : 'border border-line text-mist hover:text-ink'
              }`}
              title="Latinica"
            >
              {scriptBusy === 'lat' ? '…' : 'Lat'}
            </button>
          </>
        ) : null}
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
      {paragraphCommentsEnabled ? null : null}
    </>
  );
}
