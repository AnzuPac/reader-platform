'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Coll = { id: number; slug: string; title: string; owner_id: number | null; kind: string };

/** «Добавить в подборку» на странице произведения — только свои коллекции. */
export default function CollectionAddButton({ workId, lang }: { workId: number; lang: 'sr' | 'ru' | 'en' }) {
  const [items, setItems] = useState<Coll[]>([]);
  const [selected, setSelected] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const txt = {
    sr: { add: 'U kolekciju', none: 'Nemaš svojih kolekcija', create: 'Napravi kolekciju', added: 'Dodato', pick: 'Izaberi' },
    ru: { add: 'В подборку', none: 'У тебя нет своих подборок', create: 'Создать подборку', added: 'Добавлено', pick: 'Выбери' },
    en: { add: 'To collection', none: 'You have no collections yet', create: 'Create a collection', added: 'Added', pick: 'Pick one' },
  }[lang];

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [meRes, collRes] = await Promise.all([
          fetch('/api/auth/me', { cache: 'no-store' }),
          fetch('/api/collections', { cache: 'no-store' }),
        ]);
        const me = await meRes.json().catch(() => null);
        const colls = await collRes.json().catch(() => null);
        if (!alive || !me?.user) return;
        const own = (colls?.items || []).filter((c: Coll) => c.owner_id === me.user.id && c.kind === 'user');
        setItems(own);
        if (own.length) setSelected(String(own[0].id));
      } catch { /* гость или сеть — просто не показываем */ }
    })();
    return () => { alive = false; };
  }, []);

  async function add() {
    if (!selected) return;
    setBusy(true); setMsg('');
    const res = await fetch(`/api/collections/${selected}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workId }),
    }).catch(() => null);
    setBusy(false);
    setMsg(res?.ok ? txt.added : '✕');
    if (res?.ok) router.refresh();
  }

  if (items.length === 0) {
    return (
      <a href={`/${lang}/collections`} className="btn btn-ghost text-xs">
        {txt.create}
      </a>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <select className="input w-auto py-1 text-xs" value={selected} onChange={(e) => setSelected(e.target.value)}>
        {items.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
      <button type="button" className="btn btn-ghost text-xs" onClick={add} disabled={busy}>+ {txt.add}</button>
      {msg ? <span className="text-xs muted">{msg}</span> : null}
    </span>
  );
}
