'use client';
import { useEffect, useState } from 'react';

type Comment = { id: number; body: string; created_at: string; author: string };

export default function Comments({ workId, chapterId }: { workId: number; chapterId?: number }) {
  const [items, setItems] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    const q = chapterId ? `workId=${workId}&chapter=${chapterId}` : `workId=${workId}`;
    const r = await fetch(`/api/comments?${q}`);
    const j = await r.json().catch(() => ({ comments: [] }));
    setItems(j.comments || []);
  }
  useEffect(() => { load(); }, [workId, chapterId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const r = await fetch('/api/comments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workId, chapterId, body: text }),
    });
    if (r.status === 401) { setMsg('Prvo se prijavi.'); return; }
    if (!r.ok) { setMsg('Greška pri slanju'); return; }
    setText(''); setMsg(''); await load();
  }

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-bold">Komentari ({items.length})</h2>
      <form onSubmit={send} className="mb-4 flex flex-col gap-2">
        <textarea className="input" rows={2} placeholder="Napiši komentar…" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex items-center gap-3">
          <button className="btn btn-primary">Pošalji</button>
          {msg ? <span className="text-sm text-hot">{msg}</span> : null}
        </div>
      </form>
      <ul className="space-y-3">
        {items.map((c) => (
          <li key={c.id} className="card p-3">
            <div className="mb-1 text-xs muted">{c.author} · {String(c.created_at).slice(0, 16)}</div>
            <div className="text-sm" dangerouslySetInnerHTML={{ __html: c.body }} />
          </li>
        ))}
        {items.length === 0 ? <li className="text-sm muted">Još nema komentara.</li> : null}
      </ul>
    </section>
  );
}
