'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Annotation = { client_id: string; position: number; length: number; note: string | null; color: string | null };

function textNodes(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null = walker.nextNode();
  while (node) { nodes.push(node as Text); node = walker.nextNode(); }
  return nodes;
}

function offsetsOf(root: Node, range: Range): { start: number; end: number } | null {
  const nodes = textNodes(root);
  let acc = 0;
  let start = -1;
  let end = -1;
  for (const node of nodes) {
    const len = node.nodeValue?.length || 0;
    if (node === range.startContainer) start = acc + range.startOffset;
    if (node === range.endContainer) end = acc + range.endOffset;
    acc += len;
  }
  if (start < 0 || end < 0 || end <= start) return null;
  return { start, end: Math.min(end, acc) };
}

function rangeFromOffsets(root: Node, position: number, length: number): Range | null {
  const nodes = textNodes(root);
  let acc = 0;
  let startNode: Text | null = null;
  let endNode: Text | null = null;
  let startOffset = 0;
  let endOffset = 0;
  for (const node of nodes) {
    const len = node.nodeValue?.length || 0;
    if (!startNode && position >= acc && position <= acc + len) {
      startNode = node;
      startOffset = position - acc;
    }
    if (!endNode && position + length >= acc && position + length <= acc + len) {
      endNode = node;
      endOffset = position + length - acc;
    }
    acc += len;
  }
  if (!startNode || !endNode) return null;
  const range = document.createRange();
  range.setStart(startNode, Math.max(0, startOffset));
  range.setEnd(endNode, Math.max(0, endOffset));
  return range;
}

export default function ChapterAnnotations({ chapterId }: { chapterId: number }) {
  const [items, setItems] = useState<Annotation[]>([]);
  const [toolbar, setToolbar] = useState<null | { left: number; top: number; start: number; end: number }>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/annotations?chapter=${chapterId}`).catch(() => null);
    if (!res || !res.ok) return;
    const json = await res.json().catch(() => ({}));
    setItems(Array.isArray(json.annotations) ? json.annotations : []);
  }, [chapterId]);

  const paint = useCallback((list: Annotation[]) => {
    const root = document.querySelector('[data-chapter-body]');
    if (!root) return;
    const anyWindow = window as unknown as { Highlight?: new (...ranges: Range[]) => unknown };
    const cssAny = CSS as unknown as { highlights?: Map<string, unknown> };
    if (!anyWindow.Highlight || !cssAny.highlights) return;
    const ranges = list
      .map((a) => rangeFromOffsets(root, a.position, a.length))
      .filter((r): r is Range => Boolean(r));
    cssAny.highlights.set('tl-notes', new anyWindow.Highlight(...ranges));
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { paint(items); }, [items, paint]);

  useEffect(() => {
    const onSelect = () => {
      const root = document.querySelector('[data-chapter-body]');
      const selection = window.getSelection();
      if (!root || !selection || !selection.rangeCount || selection.isCollapsed) {
        setToolbar(null);
        return;
      }
      const range = selection.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) { setToolbar(null); return; }
      const offsets = offsetsOf(root, range);
      if (!offsets) { setToolbar(null); return; }
      const rect = range.getBoundingClientRect();
      setToolbar({
        left: Math.min(window.innerWidth - 220, Math.max(8, rect.left)),
        top: Math.max(8, rect.top - 48),
        start: offsets.start,
        end: offsets.end,
      });
    };
    document.addEventListener('mouseup', onSelect);
    document.addEventListener('touchend', onSelect);
    return () => {
      document.removeEventListener('mouseup', onSelect);
      document.removeEventListener('touchend', onSelect);
    };
  }, []);

  async function save(note: string | null) {
    if (!toolbar) return;
    setBusy(true); setError('');
    const res = await fetch('/api/annotations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterId, position: toolbar.start, length: toolbar.end - toolbar.start, note, color: note ? 'blue' : 'yellow' }),
    }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) { setError('Не удалось сохранить заметку.'); return; }
    setToolbar(null); setNoteOpen(false); setNoteText('');
    window.getSelection()?.removeAllRanges();
    await load();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/annotations?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null);
    if (res?.ok) await load();
  }

  return (
    <>
      {toolbar ? (
        <div className="tl-annot-toolbar card" style={{ left: toolbar.left, top: toolbar.top }}>
          {noteOpen ? (
            <div className="flex items-center gap-2">
              <input
                className="input"
                autoFocus
                placeholder="Заметка…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && noteText.trim()) void save(noteText.trim()); }}
              />
              <button className="btn btn-primary" disabled={busy || !noteText.trim()} onClick={() => void save(noteText.trim())}>OK</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button className="btn btn-ghost" disabled={busy} onClick={() => void save(null)}>Выделить</button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => setNoteOpen(true)}>Заметка</button>
              <button className="btn btn-ghost" onClick={() => setToolbar(null)}>✕</button>
            </div>
          )}
        </div>
      ) : null}

      <div className="card mt-6 p-4">
        <div className="mb-2 flex items-center justify-between">
          <strong>Мои заметки ({items.length})</strong>
          {error ? <span className="text-xs" style={{ color: '#b3261e' }}>{error}</span> : null}
        </div>
        {items.length === 0 ? (
          <p className="text-sm muted">Выделите текст в главе, чтобы добавить заметку.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((a) => (
              <li key={a.client_id} className="flex items-start gap-3 text-sm">
                <span aria-hidden="true" style={{ color: '#d4a017' }}>▍</span>
                <span className="flex-1">{a.note || 'Выделение'}</span>
                <span className="text-xs muted">симв. {a.position}–{a.position + a.length}</span>
                <button className="btn btn-ghost" onClick={() => void remove(a.client_id)}>Удалить</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
