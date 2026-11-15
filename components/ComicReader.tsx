'use client';
import { useEffect, useRef, useState } from 'react';
import ChapterBuyButton from './ChapterBuyButton';
import { coinsWithRsd } from '@/lib/money';

type Page = { page_no: number; file_path: string };

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
  const [mode, setMode] = useState<'scroll' | 'single'>('scroll');
  const [idx, setIdx] = useState(0);
  const [width, setWidth] = useState(100);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const lastTap = useRef(0);

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
    if (mode !== 'single') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') setIdx((i) => Math.min(pages.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, pages.length]);

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

  return (
    <div>
      <div className="sticky top-[57px] z-30 mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-[#150f21]/95 px-3 py-2 text-xs backdrop-blur">
        <div className="flex rounded border border-line">
          <button onClick={() => setMode('scroll')} className={`px-2 py-1 ${mode === 'scroll' ? 'bg-brand text-white' : 'text-mist'}`}>Lenta</button>
          <button onClick={() => setMode('single')} className={`px-2 py-1 ${mode === 'single' ? 'bg-brand text-white' : 'text-mist'}`}>Stranica</button>
        </div>
        <span className="muted">Širina:</span>
        {[70, 85, 100, 120].map((w) => (
          <button key={w} onClick={() => setWidth(w)} className={`rounded px-2 py-1 ${width === w ? 'bg-brand text-white' : 'border border-line text-mist'}`}>{w}%</button>
        ))}
        <span className="muted">Zoom:</span>
        <button onClick={() => setZoom(1)} className={`rounded px-2 py-1 ${zoom === 1 ? 'bg-brand text-white' : 'border border-line text-mist'}`}>1×</button>
        <button onClick={() => setZoom(2)} className={`rounded px-2 py-1 ${zoom === 2 ? 'bg-brand text-white' : 'border border-line text-mist'}`}>2×</button>
        <button onClick={() => setZoom(3)} className={`rounded px-2 py-1 ${zoom === 3 ? 'bg-brand text-white' : 'border border-line text-mist'}`}>3×</button>
        <span className="ml-auto muted">{mode === 'single' ? `${idx + 1} / ${pages.length}` : `${pages.length} stranica`}</span>
      </div>

      {mode === 'scroll' ? (
        <div
          className="mx-auto space-y-2"
          style={{ maxWidth: `${width}%` }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {pages.map((p) => (
            <img key={p.page_no} src={p.file_path} alt={`Strana ${p.page_no}`} loading="lazy"
                 onClick={handleTap} style={style}
                 className="w-full cursor-zoom-in rounded-lg border border-line bg-black/20" />
          ))}
        </div>
      ) : (
        <div
          className="mx-auto"
          style={{ maxWidth: `${width}%` }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <img src={pages[idx].file_path} alt={`Strana ${pages[idx].page_no}`}
               onClick={handleTap} style={style}
               className="w-full cursor-zoom-in rounded-lg border border-line bg-black/20" />
          <div className="mt-3 flex items-center justify-between">
            <button className="btn btn-ghost" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>← Prethodna</button>
            <span className="text-sm muted">{idx + 1} / {pages.length}</span>
            <button className="btn btn-ghost" onClick={() => setIdx(Math.min(pages.length - 1, idx + 1))} disabled={idx === pages.length - 1}>Sledeća →</button>
          </div>
        </div>
      )}
    </div>
  );
}
