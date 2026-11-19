'use client';
import { useEffect } from 'react';

/** Регистрация service worker: без него офлайн-главы открыть нечем. */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    // Только в production и не в dev-режиме Next: иначе SW кеширует HMR-чанки.
    if (process.env.NODE_ENV !== 'production') return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* приватный режим или запрет — офлайн просто не включится */
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
