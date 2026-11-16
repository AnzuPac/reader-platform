'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { splitParagraphs } from '@/lib/paragraph-split';

type Lang = 'sr' | 'en' | 'ru';
type Script = 'lat' | 'cir';

const LABEL: Record<Lang, string> = { sr: 'SR', en: 'EN', ru: 'RU' };

/** Лимит текста комментария na pasus: тот же, что проверяет lib/paragraph-comments.ts. */
const PC_MAX = 1000;

type ParagraphComment = {
  id: number;
  chapter_id: number;
  paragraph_index: number;
  user_id: number;
  text: string;
  hidden: number | boolean;
  created_at: string;
  author: string;
};

function formatWhen(value: unknown): string {
  const s = String(value ?? '');
  // SQLite отдаёт 'YYYY-MM-DD HH:MM:SS', PostgreSQL — ISO: показываем минуты.
  return s.length >= 16 ? s.slice(0, 16).replace('T', ' ') : s;
}

export default function ChapterBody({
  chapterId,
  initialHtml,
  originalLang = 'sr',
  protected: isProtected = false,
  fetchOnMount = false,
  translitAllowed = false,
  paragraphCommentsEnabled = false,
  script: initialScript = null,
}: {
  chapterId: number;
  initialHtml: string;
  originalLang?: Lang;
  protected?: boolean;
  fetchOnMount?: boolean;
  translitAllowed?: boolean;
  paragraphCommentsEnabled?: boolean;
  /** Начальный выбор письма из ?script=: сервер уже отдал текст в этой графике. */
  script?: Script | null;
}) {
  const [content, setContent] = useState(initialHtml);
  const [originContent, setOriginContent] = useState(initialHtml);
  const [lang, setLang] = useState<Lang>(originalLang);
  const [script, setScript] = useState<Script | null>(initialScript);
  const [busy, setBusy] = useState<Lang | null>(null);
  const [scriptBusy, setScriptBusy] = useState<Script | null>(null);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>(fetchOnMount ? 'loading' : 'idle');
  const [errorText, setErrorText] = useState('');
  const [translitDenied, setTranslitDenied] = useState(false);

  /* === Komentari к абзацам (ТЗ 4.6, 5.4) === */
  const [pcItems, setPcItems] = useState<ParagraphComment[]>([]);
  const [pcCanModerate, setPcCanModerate] = useState(false);
  const [pcActive, setPcActive] = useState<number | null>(null);
  const [pcDraft, setPcDraft] = useState('');
  const [pcMsg, setPcMsg] = useState('');
  const [pcSending, setPcSending] = useState(false);
  const [pcBusyId, setPcBusyId] = useState<number | null>(null);

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

  const pcUrl = `/api/chapters/${chapterId}/paragraph-comments`;

  /** Lista комментариев главы. Скрытые приходят только тем, кто может их вернуть. */
  const loadParagraphComments = useCallback(async () => {
    if (!paragraphCommentsEnabled) return;
    try {
      const r = await fetch(pcUrl, { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.enabled === false) {
        setPcItems([]);
        setPcCanModerate(false);
        return;
      }
      setPcItems(Array.isArray(j.comments) ? (j.comments as ParagraphComment[]) : []);
      setPcCanModerate(!!j.canModerate);
    } catch {
      setPcItems([]);
    }
  }, [paragraphCommentsEnabled, pcUrl]);

  useEffect(() => {
    if (!paragraphCommentsEnabled) return;
    void loadParagraphComments();
  }, [loadParagraphComments, paragraphCommentsEnabled]);

  const blocks = useMemo(() => splitParagraphs(content), [content]);

  /** Komentari по абзацам: skrivenые не считаем и не показываем без прав. */
  const pcByParagraph = useMemo(() => {
    const map = new Map<number, ParagraphComment[]>();
    for (const c of pcItems) {
      if (!pcCanModerate && c.hidden) continue;
      const list = map.get(Number(c.paragraph_index)) ?? [];
      list.push(c);
      map.set(Number(c.paragraph_index), list);
    }
    return map;
  }, [pcItems, pcCanModerate]);

  function togglePanel(index: number) {
    setPcDraft('');
    setPcMsg('');
    setPcActive((prev) => (prev === index ? null : index));
  }

  async function sendComment(index: number, e: React.FormEvent) {
    e.preventDefault();
    const text = pcDraft.trim();
    if (pcSending) return;
    if (!text) { setPcMsg('Unesite tekst komentara.'); return; }
    if (text.length > PC_MAX) { setPcMsg(`Maksimum ${PC_MAX} karaktera.`); return; }
    setPcSending(true);
    setPcMsg('');
    try {
      const r = await fetch(pcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paragraphIndex: index, text }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { setPcMsg('Prijavite se da ostavite komentar.'); return; }
      if (r.status === 403) { setPcMsg('Komentari isključeni od strane nosioca prava.'); return; }
      if (!r.ok) {
        setPcMsg(
          j.error === 'bad_text' ? `Tekst je prazan ili duži od ${PC_MAX} karaktera.`
            : j.error === 'bad_index' ? 'Neispravan broj pasusa.'
            : 'Komentar nije poslat.'
        );
        return;
      }
      setPcDraft('');
      await loadParagraphComments();
    } catch {
      setPcMsg('Greška mreže. Pokušajte ponovo.');
    } finally {
      setPcSending(false);
    }
  }

  async function toggleHidden(c: ParagraphComment) {
    setPcBusyId(c.id);
    setPcMsg('');
    try {
      const r = await fetch(pcUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId: c.id, hidden: !c.hidden }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { setPcMsg('Prijavite se da biste moderirali komentare.'); return; }
      if (r.status === 403) { setPcMsg('Nema prava: skriva autor dela ili moderator.'); return; }
      if (!r.ok) { setPcMsg(j.error === 'not_found' ? 'Komentar nije pronađen.' : 'Vidljivost nije promenjena.'); return; }
      await loadParagraphComments();
    } catch {
      setPcMsg('Greška mreže. Pokušajte ponovo.');
    } finally {
      setPcBusyId(null);
    }
  }

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
      if (!r.ok) { setNote('Prevod nije uspeo: ' + (j.error || r.status)); return; }
      setContent(j.content);
      setLang(target);
      setScript(null);
      setNote(j.cached ? 'Prevod iz keša' : 'Preveo AI');
    } catch {
      setNote('Prevod nije uspeo');
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

  /** Сколько vidljivih (не skrivenых) комментариев у абзаца — число на иконке. */
  function visibleCount(index: number): number {
    return (pcByParagraph.get(index) ?? []).filter((c) => !c.hidden).length;
  }

  function renderPanel(index: number) {
    const list = pcByParagraph.get(index) ?? [];
    const visible = list.filter((c) => !c.hidden).length;
    return (
      <div className="pc-panel mb-5 rounded-xl border border-line bg-panel p-3 text-sm font-sans">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-mist">Komentari na pasus {index + 1}</span>
          <span className="muted">{visible ? `${visible} vidljivih` : 'za sada prazno'}</span>
        </div>

        {list.length ? (
          <ul className="mb-3 list-none space-y-2 p-0">
            {list.map((c) => (
              <li key={c.id} className={`rounded-lg border border-line px-2.5 py-2 ${c.hidden ? 'opacity-60' : ''}`}>
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-ink">{c.author}</span>
                  <span className="muted">{formatWhen(c.created_at)}</span>
                  {c.hidden ? <span className="badge-hot">skriven</span> : null}
                  {pcCanModerate ? (
                    <button
                      type="button"
                      className="ml-auto text-xs underline decoration-dotted"
                      onClick={() => void toggleHidden(c)}
                      disabled={pcBusyId === c.id}
                    >
                      {pcBusyId === c.id ? '…' : c.hidden ? 'Prikaži' : 'Sakrij'}
                    </button>
                  ) : null}
                </div>
                <div className="whitespace-pre-line text-sm text-ink/90">{c.text}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted mb-3 text-xs">Пока никто не комментировал этот абзац.</p>
        )}

        <form onSubmit={(e) => void sendComment(index, e)} className="flex flex-col gap-2">
          <textarea
            className="input"
            rows={2}
            maxLength={PC_MAX}
            placeholder="Vaš komentar na pasus…"
            value={pcDraft}
            onChange={(e) => setPcDraft(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary" disabled={pcSending || !pcDraft.trim()}>
              {pcSending ? 'Šaljem…' : 'Pošalji'}
            </button>
            <span className="text-xs muted">{pcDraft.length}/{PC_MAX}</span>
            {pcMsg ? <span className="text-xs text-hot">{pcMsg}</span> : null}
          </div>
        </form>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="muted">Čitaj на:</span>
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
        <article className="prose-reader whitespace-pre-line">
          {blocks.map((block, i) => {
            if (block.kind === 'raw' || block.index === null) {
              return <div key={`raw-${i}`} dangerouslySetInnerHTML={{ __html: block.html }} />;
            }
            const idx = block.index;
            return (
              <div key={`para-${idx}`} className="flow-root" data-paragraph={idx}>
                {paragraphCommentsEnabled ? (
                  <button
                    type="button"
                    className={`pc-icon${visibleCount(idx) ? ' has-comments' : ''}${pcActive === idx ? ' active' : ''}`}
                    onClick={() => togglePanel(idx)}
                    aria-expanded={pcActive === idx}
                    aria-label={`Komentari na pasus ${idx + 1}`}
                    title={visibleCount(idx) ? `Komentari: ${visibleCount(idx)}` : 'Komentariši pasus'}
                  >
                    {visibleCount(idx) ? `💬 ${visibleCount(idx)}` : '💬'}
                  </button>
                ) : null}
                <div dangerouslySetInnerHTML={{ __html: block.html }} />
                {paragraphCommentsEnabled && pcActive === idx ? renderPanel(idx) : null}
              </div>
            );
          })}
        </article>
      </div>
    </>
  );
}
