'use client';
import { useState } from 'react';

type Lang = 'sr' | 'ru' | 'en';
type Target = 'work' | 'comment' | 'review' | 'user';

const TXT: Record<Lang, {
  report: string; reason: string; reasons: Record<string, string>; send: string; sent: string; comment: string;
}> = {
  sr: {
    report: 'Prijavi', reason: 'Razlog', comment: 'Komentar (opciono)', send: 'Pošalji', sent: 'Prijava poslata',
    reasons: { copyright: 'Kršenje autorskih prava', spam: 'Spam', abuse: 'Uvreda ili pretnja', other: 'Drugo' },
  },
  ru: {
    report: 'Жалоба', reason: 'Причина', comment: 'Комментарий (необязательно)', send: 'Отправить', sent: 'Жалоба отправлена',
    reasons: { copyright: 'Нарушение авторских прав', spam: 'Спам', abuse: 'Оскорбление или угроза', other: 'Другое' },
  },
  en: {
    report: 'Report', reason: 'Reason', comment: 'Comment (optional)', send: 'Send', sent: 'Report sent',
    reasons: { copyright: 'Copyright violation', spam: 'Spam', abuse: 'Abuse or threat', other: 'Other' },
  },
};

/** Жалоба на произведение, комментарий или отзыв: уходит в очередь модерации. */
export default function ReportButton({
  targetType, targetId, lang,
}: { targetType: Target; targetId: number; lang: Lang }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('other');
  const [comment, setComment] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const t = TXT[lang];

  async function send() {
    setBusy(true); setMsg('');
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType, targetId, reason, comment }),
    }).catch(() => null);
    setBusy(false);
    if (res?.status === 401) { setMsg('✕ auth'); return; }
    setMsg(res?.ok ? t.sent : '✕');
    if (res?.ok) { setOpen(false); setComment(''); }
  }

  if (!open) {
    return (
      <button type="button" className="text-xs muted hover:text-brand" onClick={() => setOpen(true)}>
        ⚑ {t.report}
      </button>
    );
  }

  return (
    <div className="card mt-2 space-y-2 p-3 text-xs">
      <label className="flex items-center gap-2">
        {t.reason}
        <select className="input w-auto py-1 text-xs" value={reason} onChange={(e) => setReason(e.target.value)}>
          {Object.entries(t.reasons).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </label>
      <input className="input py-1 text-xs" placeholder={t.comment} value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-ghost px-2 py-0.5 text-xs" onClick={send} disabled={busy}>{t.send}</button>
        <button type="button" className="text-xs muted" onClick={() => setOpen(false)}>✕</button>
        {msg ? <span className="muted">{msg}</span> : null}
      </div>
    </div>
  );
}
