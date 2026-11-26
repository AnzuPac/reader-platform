'use client';
import { useEffect, useRef, useState } from 'react';
import ChapterBuyButton from './ChapterBuyButton';
import { coinsWithRsd } from '@/lib/money';

type Page = { page_no: number; url?: string; file_path?: string };

export default function ComicReader({
  chapterId,
  workId,
  workSlug,
  coins = 0,
  lang = 'sr',
}: {
  chapterId: number;
  workId?: number;
  workSlug?: string;
  coins?: number;
  lang?: string;
}) {
  const [pages, setPages] = useState<Page[]>([]);
  const [locked, setLocked] = useState(false);
  const [mode, setMode] = useState<'webtoon' | 'pages'>('webtoon');
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr');
  const [idx, setIdx] = useState(0);
  const [width, setWidth] = useState(100);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const lastTap = useRef(0);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('comic_reader_prefs');
      if (!raw) return;
      const prefs = JSON.parse(raw) as { mode?: 'webtoon' | 'pages'; direction?: 'ltr' | 'rtl' };
      if (prefs.mode === 'webtoon' || prefs.mode === 'pages') setMode(prefs.mode);
      if (prefs.direction === 'ltr' || prefs.direction === 'rtl') setDirection(prefs.direction);
    } catch {}
  }, []);

  function updateMode(next: 'webtoon' | 'pages') {
    setMode(next);
    try { localStorage.setItem('comic_reader_prefs', JSON.stringify({ mode: next, direction })); } catch {}
  }
  function updateDirection(next: 'ltr' | 'rtl') {
    setDirection(next);
    try { localStorage.setItem('comic_reader_prefs', JSON.stringify({ mode, direction: next })); } catch {}
  }
  function nextPage() { setIdx((i) => Math.min(pages.length - 1, i + 1)); }
  function previousPage() { setIdx((i) => Math.max(0, i - 1)); }
  function onPageTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 1) swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    onTouchStart(e);
  }
  function onPageTouchEnd(e: React.TouchEvent) {
    if (e.changedTouches.length && swipeStart.current && mode === 'pages') {
      const dx = e.changedTouches[0].clientX - swipeStart.current.x;
      const dy = e.changedTouches[0].clientY - swipeStart.current.y;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.25) {
        const advance = direction === 'ltr' ? dx < 0 : dx > 0;
        if (advance) nextPage(); else previousPage();
      }
    }
    swipeStart.current = null;
    onTouchEnd();
  }

  useEffect(() => {
    fetch(`/api/pages?chapter=${chapterId}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.locked) {
          setLocked(true);
          setPages([]);
          return;
        }
        setPages(j.pages || []);
      })
      .catch(() => setPages([]))
      .finally(() => setLoading(false));
  }, [chapterId]);

  useEffect(() => {
    if (mode !== 'pages') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); nextPage(); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); direction === 'ltr' ? nextPage() : previousPage(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); direction === 'ltr' ? previousPage() : nextPage(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, pages.length, direction]);

  // двойное касание/клик — переключение зума
  function onDoubleTap() {
    setZoom((z) => (z > 1 ? 1 : 2));
  }
  function handleTap() {
    const now = Date.now();
    if (now - lastTap.current < 300) onDoubleTap();
    lastTap.current = now;
  }

  // пинч двумя пальцами
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      pinch.current = { dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), zoom };
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinch.current) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const next = Math.min(4, Math.max(1, (pinch.current.zoom * dist) / pinch.current.dist));
      setZoom(Number(next.toFixed(2)));
    }
  }
  function onTouchEnd() { pinch.current = null; }

  if (loading) return <div className="py-16 text-center muted">Učitavam stranice…</div>;
  if (locked) {
    return (
      <div className="card p-6">
        <h2 className="mb-2 text-lg font-semibold">🔒 Ova glava se kupuje</h2>
        <p className="muted mb-4">Kupi glavu ili celu knjigu — pristup ostaje tvoj zauvek.</p>
        <div className="flex flex-wrap items-center gap-3">
          {coins > 0 ? (
            <ChapterBuyButton chapterId={chapterId} coins={coins} priceLabel={coinsWithRsd(coins)} label="Kupi glavu" />
          ) : null}
          {workId ? (
            <a className="btn btn-ghost" href={workSlug ? `/${lang}/work/${workSlug}` : `/${lang}/catalog`}>
              Nazad na delo
            </a>
          ) : null}
        </div>
      </div>
    );
  }
  if (!pages.length) return <div className="card p-6 text-center muted">Za ovu glavu još nema stranica.</div>;

  const style = { transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform .15s ease' };
  const labels = lang === 'ru'
    ? { webtoon: 'Вебтун', pages: 'По страницам', ltr: 'Слева → направо', rtl: 'Справа → налево', width: 'Ширина', zoom: 'Масштаб', previous: '← Предыдущая', next: 'Следующая →', page: 'страниц' }
    : lang === 'en'
      ? { webtoon: 'Webtoon', pages: 'Pages', ltr: 'Left → right', rtl: 'Right → left', width: 'Width', zoom: 'Zoom', previous: '← Previous', next: 'Next →', page: 'pages' }
      : { webtoon: 'Vebtun', pages: 'Po stranicama', ltr: 'Sleva → desno', rtl: 'Zdesna → levo', width: 'Širina', zoom: 'Zum', previous: '← Prethodna', next: 'Sledeća →', page: 'stranica' };

  return (
    <div>
      <div className="tlp-comic-toolbar sticky top-[57px] z-30 mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-[#150f21]/95 px-3 py-2 text-xs backdrop-blur">
        <div className="flex rounded border border-line">
          <button onClick={() => updateMode('webtoon')} className={`px-2 py-1 ${mode === 'webtoon' ? 'bg-brand text-white' : 'text-mist'}`}>{labels.webtoon}</button>
          <button onClick={() => updateMode('pages')} className={`px-2 py-1 ${mode === 'pages' ? 'bg-brand text-white' : 'text-mist'}`}>{labels.pages}</button>
        </div>
        {mode === 'pages' ? (
          <div className="flex rounded border border-line" aria-label="Направление перелистывания">
            <button onClick={() => updateDirection('ltr')} className={`px-2 py-1 ${direction === 'ltr' ? 'bg-brand text-white' : 'text-mist'}`}>{labels.ltr}</button>
            <button onClick={() => updateDirection('rtl')} className={`px-2 py-1 ${direction === 'rtl' ? 'bg-brand text-white' : 'text-mist'}`}>{labels.rtl}</button>
          </div>
        ) : null}
        <span className="muted">{labels.width}:</span>
        {[70, 85, 100, 120].map((w) => (
          <button key={w} onClick={() => setWidth(w)} className={`rounded px-2 py-1 ${width === w ? 'bg-brand text-white' : 'border border-line text-mist'}`}>{w}%</button>
        ))}
        <span className="muted">{labels.zoom}:</span>
        <button onClick={() => setZoom(1)} className={`rounded px-2 py-1 ${zoom === 1 ? 'bg-brand text-white' : 'border border-line text-mist'}`}>1×</button>
        <button onClick={() => setZoom(2)} className={`rounded px-2 py-1 ${zoom === 2 ? 'bg-brand text-white' : 'border border-line text-mist'}`}>2×</button>
        <button onClick={() => setZoom(3)} className={`rounded px-2 py-1 ${zoom === 3 ? 'bg-brand text-white' : 'border border-line text-mist'}`}>3×</button>
        <span className="ml-auto muted">{mode === 'pages' ? `${idx + 1} / ${pages.length}` : `${pages.length} ${labels.page}`}</span>
      </div>

      {mode === 'webtoon' ? (
        <div
          className="tlp-comic-pages mx-auto space-y-2"
          style={{ maxWidth: `${width}%` }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {pages.map((p) => (
            <img key={p.page_no} src={(p.url || p.file_path)} alt={`Strana ${p.page_no}`} loading="lazy"
                 onClick={handleTap} style={style}
                 className="w-full cursor-zoom-in rounded-lg border border-line bg-black/20" />
          ))}
        </div>
      ) : (
        <div
          className="tlp-comic-single mx-auto"
          style={{ maxWidth: `${width}%` }}
          onTouchStart={onPageTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onPageTouchEnd}
        >
          <img src={(pages[idx].url || pages[idx].file_path)} alt={`Strana ${pages[idx].page_no}`}
               onClick={handleTap} style={style}
               className="w-full cursor-zoom-in rounded-lg border border-line bg-black/20" />
          <div className="mt-3 flex items-center justify-between">
            <button className="btn btn-ghost" onClick={direction === 'ltr' ? previousPage : nextPage} disabled={direction === 'ltr' ? idx === 0 : idx === pages.length - 1}>{direction === 'ltr' ? labels.previous : labels.next}</button>
            <span className="text-sm muted">{idx + 1} / {pages.length}</span>
            <button className="btn btn-ghost" onClick={direction === 'ltr' ? nextPage : previousPage} disabled={direction === 'ltr' ? idx === pages.length - 1 : idx === 0}>{direction === 'ltr' ? labels.next : labels.previous}</button>
          </div>
        </div>
      )}
    </div>
  );
}
