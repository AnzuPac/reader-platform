'use client';
import { useEffect, useRef, useState } from 'react';

export default function ReaderClient({ chapterId, workId }: { chapterId: number; workId: number }) {
  const [saved, setSaved] = useState(true);
  const last = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const pct = Math.min(100, Math.round(((h.scrollTop + h.clientHeight) / h.scrollHeight) * 100));
      const pos = Math.round(h.scrollTop);
      const now = Date.now();
      if (now - last.current < 15000) return;
      last.current = now;
      setSaved(false);
      fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workId, chapterId, position: pos, percent: pct }),
      }).then(() => setSaved(true)).catch(() => setSaved(false));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [chapterId, workId]);

  return (
    <div className="fixed bottom-4 right-4 rounded-full px-3 py-1 text-xs muted" style={{ background: '#16122299' }}>
      {saved ? '✓ sačuvano' : '… čuvam'}
    </div>
  );
}
