'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Создание пользовательской коллекции. */
export default function NewCollectionForm({ lang }: { lang: 'sr' | 'ru' | 'en' }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const txt = {
    sr: { title: 'Naziv kolekcije', desc: 'Opis (opciono)', pub: 'Javna', create: 'Napravi', need: 'Unesi naziv' },
    ru: { title: 'Название подборки', desc: 'Описание (необязательно)', pub: 'Публичная', create: 'Создать', need: 'Введи название' },
    en: { title: 'Collection title', desc: 'Description (optional)', pub: 'Public', create: 'Create', need: 'Enter a title' },
  }[lang];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setMsg(txt.need); return; }
    setBusy(true); setMsg('');
    const res = await fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, isPublic }),
    });
    setBusy(false);
    if (!res.ok) { setMsg('✕'); return; }
    setTitle(''); setDescription('');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={txt.title} />
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={txt.desc} />
      </div>
      <label className="flex items-center gap-2 text-sm muted">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        {txt.pub}
      </label>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={busy}>{txt.create}</button>
        {msg ? <span className="text-xs muted">{msg}</span> : null}
      </div>
    </form>
  );
}
