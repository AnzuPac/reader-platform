'use client';

import { useEffect } from 'react';

/** Виджет Cloudflare Turnstile. Без NEXT_PUBLIC_TURNSTILE_SITE_KEY не рендерится;
 *  сервер в этом случае тоже не требует токен (если защита не включена принудительно). */
export default function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

  useEffect(() => {
    if (!siteKey) return;
    (window as unknown as { onTurnstileSuccess?: (t: string) => void }).onTurnstileSuccess = onToken;
    const id = 'cf-turnstile-script';
    if (!document.getElementById(id)) {
      const script = document.createElement('script');
      script.id = id;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }, [siteKey, onToken]);

  if (!siteKey) return null;
  return (
    <div
      className="cf-turnstile"
      data-sitekey={siteKey}
      data-callback="onTurnstileSuccess"
      data-theme="auto"
    />
  );
}
