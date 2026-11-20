'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type Report = {
  id: number; reporter: string | null; target_type: string; target_id: number;
  reason: string; comment: string | null; status: string; created_at: string;
};

const ACTIONS: { key: string; label: string }[] = [
  { key: 'dismiss', label: 'Отклонить' },
  { key: 'hide_comment', label: 'Скрыть комментарий' },
  { key: 'hide_review', label: 'Скрыть отзыв' },
  { key: 'hide_work', label: 'Скрыть произведение' },
];

/** Очередь жалоб для админки. Доступ проверяется на сервере (HttpOnly cookie). */
export default function AdminReportsPage() {
  const [items, setItems] = useState<Report[]>([]);
  const [status, setStatus] = useState('open');
  const [counts, setCounts] = useState<{ open: number; resolved: number; dismissed: number } | null>(null);
  const [msg, setMsg] = useState('');
  const rawLang = String(useParams<{ lang?: string }>()?.lang || 'sr');
  const lang = rawLang === 'ru' || rawLang === 'en' ? rawLang : 'sr';

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/reports?status=${status}`, { cache: 'no-store' });
    if (res.status === 403) { setMsg('Нет админ-доступа: войди через /admin.'); return; }
    const data = await res.json().catch(() => null);
    if (data?.items) setItems(data.items);
    if (data?.counts) setCounts(data.counts);
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  async function resolve(id: number, action: string) {
    const res = await fetch('/api/admin/reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    }).catch(() => null);
    setMsg(res?.ok ? '✓' : '✕');
    if (res?.ok) void load();
  }

  return (
    <main className="tl-screen tl-screen--admin-reports tlp-stage9-admin mx-auto max-w-6xl px-5 py-10">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Жалобы</h1>
        <Link href={`/${lang}/admin`} className="text-sm text-brand hover:underline">← Админка</Link>
        {counts ? (
          <span className="text-xs muted">
            открытых: {counts.open} · решено: {counts.resolved} · отклонено: {counts.dismissed}
          </span>
        ) : null}
      </div>

      <div className="mb-4 flex gap-2">
        {['open', 'resolved', 'dismissed'].map((s) => (
          <button
            key={s}
            className={`btn ${status === s ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setStatus(s)}
          >
            {s}
          </button>
        ))}
        {msg ? <span className="text-xs muted">{msg}</span> : null}
      </div>

      {items.length === 0 ? (
        <div className="card p-8 text-center muted">Пусто.</div>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="mb-1 text-xs muted">
                #{r.id} · {r.reporter || '—'} · {r.target_type} #{r.target_id} · {r.reason} · {String(r.created_at).slice(0, 16)}
              </div>
              {r.comment ? <p className="mb-2 text-sm">{r.comment}</p> : null}
              {r.status === 'open' ? (
                <div className="flex flex-wrap gap-2">
                  {ACTIONS.map((a) => (
                    <button key={a.key} className="btn btn-ghost px-2 py-0.5 text-xs" onClick={() => resolve(r.id, a.key)}>
                      {a.label}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-xs muted">{r.status}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
