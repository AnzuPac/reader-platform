'use client';
import { useEffect } from 'react';

/**
 * Держит сессию живой: access-токен живёт час, refresh — 30 дней.
 * Если пользователь активен, раз в 30 минут продлеваем сессию через
 * /api/auth/refresh (с ротацией refresh-токена). Раньше пользователя
 * разлогинивало через час, хотя cookie была на 30 дней (аудит, п.14).
 */
export default function SessionKeeper() {
  useEffect(() => {
    let cancelled = false;

    async function refreshIfNeeded() {
      try {
        const me = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!me.ok) return;
        const data = await me.json().catch(() => null);
        if (data?.user) return; // сессия ещё жива
        await fetch('/api/auth/refresh', { method: 'POST' });
      } catch {
        /* сеть недоступна — попробуем в следующий раз */
      }
    }

    void refreshIfNeeded();
    const id = setInterval(() => { if (!cancelled && document.visibilityState === 'visible') void refreshIfNeeded(); }, 30 * 60 * 1000);

    const onVisible = () => { if (document.visibilityState === 'visible') void refreshIfNeeded(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
