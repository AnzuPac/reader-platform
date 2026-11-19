'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

type State = 'idle' | 'saving' | 'saved' | 'error';

export default function ReaderClient({ chapterId, workId }: { chapterId: number; workId: number }) {
  const [state, setState] = useState<State>('idle');
  const lastSent = useRef(0);
  const inFlight = useRef(false);

  const readPosition = useCallback(() => {
    const h = document.documentElement;
    const total = Math.max(1, h.scrollHeight - h.clientHeight);
    const percent = Math.min(100, Math.max(0, Math.round((h.scrollTop / total) * 100)));
    return { position: Math.round(h.scrollTop), percent };
  }, []);

  // Сохраняем прогресс: проверяем HTTP-статус (раньше 401/500 показывались как «сохранено»),
  // не дублируем параллельные запросы и сохраняем при уходе со страницы.
  const save = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastSent.current < 5000) return;
    if (inFlight.current) return;
    const { position, percent } = readPosition();
    if (percent === 0 && position === 0 && !force) return;

    inFlight.current = true;
    lastSent.current = now;
    setState('saving');
    try {
      const res = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workId, chapterId, position, percent }),
        keepalive: true,
      });
      setState(res.ok ? 'saved' : 'error');
    } catch {
      setState('error');
    } finally {
      inFlight.current = false;
    }
  }, [chapterId, workId, readPosition]);

  useEffect(() => {
    const onScroll = () => { void save(); };
    const onHidden = () => { if (document.visibilityState === 'hidden') void save(true); };
    const onLeave = () => { void save(true); };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', onLeave);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onLeave);
      // Уход на другую главу/страницу — сохраняем позицию сразу.
      void save(true);
    };
  }, [save]);

  const label = state === 'error' ? '⚠ nije sačuvano' : state === 'saved' ? '✓ sačuvano' : '… čuvam';
  return (
    <div className="fixed bottom-4 right-4 rounded-full px-3 py-1 text-xs muted" style={{ background: '#16122299' }}>
      {label}
    </div>
  );
}
