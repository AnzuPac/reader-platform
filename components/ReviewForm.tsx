'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Lang = 'sr' | 'ru' | 'en';

const TXT: Record<Lang, { title: string; body: string; rating: string; submit: string; need: string; ok: string; short: string; noEligible: string }> = {
  sr: { title: 'Tvoj utisak', body: 'Napiši utisak (min. 10 znakova)', rating: 'Ocena', submit: 'Objavi', need: 'Napiši bar 10 znakova', ok: 'Sačuvano', short: 'Prekratko', noEligible: 'Utisak mogu da ostave čitaoci koji su pročitali bar 10%.' },
  ru: { title: 'Твой отзыв', body: 'Напиши отзыв (мин. 10 символов)', rating: 'Оценка', submit: 'Опубликовать', need: 'Напиши хотя бы 10 символов', ok: 'Сохранено', short: 'Слишком коротко', noEligible: 'Отзыв могут оставить читатели, прочитавшие не меньше 10%.' },
  en: { title: 'Your review', body: 'Write a review (min. 10 characters)', rating: 'Rating', submit: 'Publish', need: 'Write at least 10 characters', ok: 'Saved', short: 'Too short', noEligible: 'Only readers with at least 10% progress can leave a review.' },
};

export default function ReviewForm({
  workId, lang, initialBody = '', initialRating = 0, eligible = false, percent = 0,
}: { workId: number; lang: Lang; initialBody?: string; initialRating?: number; eligible?: boolean; percent?: number }) {
  const [body, setBody] = useState(initialBody);
  const [rating, setRating] = useState(initialRating || 0);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const t = TXT[lang];

  if (!eligible) {
    return (
      <div className="card p-4 text-sm muted">
        {t.noEligible} <span className="whitespace-nowrap">({percent}%)</span>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim().length < 10) { setMsg(t.need); return; }
    setBusy(true); setMsg('');
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workId, body, rating: rating || undefined }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const j = await res?.json().catch(() => null);
      setMsg(j?.error === 'not_eligible' ? t.noEligible : '✕');
      return;
    }
    setMsg(t.ok);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <div className="flex items-center gap-3">
        <strong className="text-sm">{t.title}</strong>
        <label className="flex items-center gap-2 text-xs muted">
          {t.rating}
          <select className="input w-auto py-1" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
            <option value={0}>—</option>
            {[5, 4, 3, 2, 1].map((v) => <option key={v} value={v}>{v} ★</option>)}
          </select>
        </label>
      </div>
      <textarea
        className="input min-h-[90px]"
        value={body}
        placeholder={t.body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={busy}>{t.submit}</button>
        {msg ? <span className="text-xs muted">{msg}</span> : null}
      </div>
    </form>
  );
}
