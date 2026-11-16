'use client';
import { useState } from 'react';

export default function EpubImportForm() {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem('file') as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) { setMsg('Izaberite EPUB fajl.'); return; }
    setBusy(true); setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/author/import-epub', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(`Greška: ${j.error || r.status}`); }
      else {
        const w = Array.isArray(j.warnings) && j.warnings.length ? ` · upozorenja: ${j.warnings.length}` : '';
        setMsg(`Uvezeno: „${j.work?.title}“ — glava: ${j.chapters}${w}. Nacrt je u katalogu radova.`);
        form.reset();
      }
    } catch { setMsg('Greška pri slanju.'); }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="mt-6 rounded border border-white/15 p-4">
      <h2 className="mb-2 text-sm font-semibold">Uvoz knjige iz EPUB</h2>
      <p className="mb-3 text-xs muted">EPUB 3: naslov i glave se čitaju iz container/OPF. Knjiga se dodaje kao nacrt.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="file" name="file" aria-label="EPUB fajl" accept=".epub,application/epub+zip" className="text-xs" />
        <button disabled={busy} className="rounded bg-brand px-3 py-2 text-xs font-semibold">Uvezi</button>
      </div>
      {msg ? <p className="mt-2 text-xs muted">{msg}</p> : null}
    </form>
  );
}
