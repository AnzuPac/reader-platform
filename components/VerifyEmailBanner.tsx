'use client';

import { useState } from 'react';

const TXT = {
  sr: {
    title: 'Potvrdite e-poštu', text: 'Nalog radi, ali e-pošta još nije potvrđena.',
    resend: 'Pošalji ponovo', busy: 'Šaljem…', sent: 'Pismo je poslano — proverite sanduče.',
    nomail: 'Slanje pisama još nije podešeno na serveru.', error: 'Nije uspelo, pokušajte kasnije.',
  },
  ru: {
    title: 'Подтвердите почту', text: 'Аккаунт работает, но почта ещё не подтверждена.',
    resend: 'Отправить ещё раз', busy: 'Отправляю…', sent: 'Письмо отправлено — проверьте ящик.',
    nomail: 'Отправка писем на сервере ещё не настроена.', error: 'Не получилось, попробуйте позже.',
  },
  en: {
    title: 'Confirm your email', text: 'Your account works, but the email is not verified yet.',
    resend: 'Send again', busy: 'Sending…', sent: 'Email sent — check your inbox.',
    nomail: 'Email delivery is not configured on the server yet.', error: 'Failed, try again later.',
  },
} as const;

export default function VerifyEmailBanner({ lang }: { lang: 'sr' | 'ru' | 'en' }) {
  const t = TXT[lang];
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'nomail' | 'error'>('idle');

  async function resend() {
    setState('busy');
    const res = await fetch('/api/auth/verify/resend', { method: 'POST' }).catch(() => null);
    if (!res) { setState('error'); return; }
    const json = await res.json().catch(() => ({}));
    if (res.ok) { setState('sent'); return; }
    setState(json.error === 'mail_not_configured' ? 'nomail' : 'error');
  }

  const message = state === 'sent' ? t.sent : state === 'nomail' ? t.nomail : state === 'error' ? t.error : '';

  return (
    <div className="card mb-6 p-4" role="status">
      <strong>{t.title}</strong>
      <p className="muted" style={{ margin: '4px 0 10px', fontSize: 13 }}>{t.text}</p>
      {message ? <p style={{ margin: '0 0 8px', fontSize: 13 }}>{message}</p> : null}
      <button type="button" className="btn" disabled={state === 'busy' || state === 'sent'} onClick={resend}>
        {state === 'busy' ? t.busy : t.resend}
      </button>
    </div>
  );
}
