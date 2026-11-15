'use client';
import { useCallback, useEffect, useState } from 'react';

type C = { id: number; paragraph_index: number; body: string; author: string; created_at: string };

export default function ParagraphComments({ chapterId }: { chapterId: number }) {
  const [comments, setComments] = useState<C[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/chapters/${chapterId}/paragraph-comments`, { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      setEnabled(j.enabled !== false);
      setComments(Array.isArray(j.comments) ? j.comments : []);
    } catch { /* тихо */ }
  }, [chapterId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!enabled) return;
    const art = document.querySelector('article.prose-reader');
    if (!art) return;
    const nodes = Array.from(art.children) as HTMLElement[];
    nodes.forEach((el, i) => {
      if (el.dataset.pcBound) return;
      el.dataset.pcBound = '1';
      el.style.position = 'relative';
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = '💬';
      b.setAttribute('aria-label', `Komentar na pasus ${i + 1}`);
      b.style.cssText = 'position:absolute;right:-1.9rem;top:0;opacity:.35;font-size:13px;line-height:1';
      b.onclick = () => { setOpen(i); setText(''); setErr(''); };
      b.onmouseenter = () => { b.style.opacity = '1'; };
      b.onmouseleave = () => { b.style.opacity = '.35'; };
      el.appendChild(b);
    });
  }, [enabled]);

  async function submit() {
    setErr('');
    const r = await fetch(`/api/chapters/${chapterId}/paragraph-comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paragraph_index: open, body: text }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error === 'auth_required' ? 'Prijavite se da komentarišete.' : 'Greška. Pokušajte ponovo.'); return; }
    setText(''); await load();
  }

  if (!enabled) return null;

  const list = open === null ? [] : comments.filter((c) => c.paragraph_index === open);

  return (
    <>
      {open !== null ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#14121c] p-4">
          <div className="mx-auto max-w-2xl">
            <div className="mb-2 flex items-center justify-between text-sm">
              <strong>Komentari — pasus {open + 1}</strong>
              <button onClick={() => setOpen(null)} className="muted">Zatvori ✕</button>
            </div>
            <div className="mb-3 max-h-40 space-y-2 overflow-auto text-sm">
              {list.length === 0 ? <p className="muted">Još nema komentara.</p> : list.map((c) => (
                <div key={c.id} className="rounded border border-white/10 p-2">
                  <span className="muted">{c.author}: </span>{c.body}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000}
                     placeholder="Napišite komentar…" className="flex-1 rounded border border-white/20 bg-transparent px-3 py-2 text-sm" />
              <button onClick={submit} disabled={!text.trim()} className="rounded bg-brand px-3 py-2 text-sm">Pošalji</button>
            </div>
            {err ? <p className="mt-2 text-xs text-red-400">{err}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
