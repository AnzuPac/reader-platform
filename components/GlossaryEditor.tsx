'use client';
import { useEffect, useState } from 'react';

type Term = { id: number; lang: string; term: string; translation: string };

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
];

export default function GlossaryEditor({ workSlug }: { workSlug: string }) {
  const [terms, setTerms] = useState<Term[]>([]);
  const [lang, setLang] = useState('ru');
  const [term, setTerm] = useState('');
  const [translation, setTranslation] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    const r = await fetch(`/api/author/glossary?work=${encodeURIComponent(workSlug)}`);
    if (!r.ok) return;
    const j = await r.json();
    setTerms(j.terms || []);
  }
  useEffect(() => { load(); }, [workSlug]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!term.trim() || !translation.trim()) { setMsg('Заполни термин и перевод'); return; }
    const r = await fetch('/api/author/glossary', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workSlug, lang, term, translation }),
    });
    if (!r.ok) { setMsg('Ошибка сохранения'); return; }
    setTerm(''); setTranslation(''); setMsg('Термин сохранён');
    await load();
  }

  async function remove(id: number) {
    await fetch(`/api/author/glossary?id=${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="card mt-6 p-5">
      <div className="mb-1 font-semibold">Глоссарий перевода</div>
      <p className="mb-4 text-sm muted">
        Имена и термины, которые ИИ-перевод обязан передавать одинаково во всех главах.
      </p>

      <form onSubmit={add} className="mb-4 flex flex-wrap items-end gap-2">
        <select className="input max-w-[90px]" value={lang} onChange={(e) => setLang(e.target.value)}>
          {LANGS.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}
        </select>
        <input className="input max-w-[190px]" placeholder="Термин в оригинале" value={term} onChange={(e) => setTerm(e.target.value)} />
        <input className="input max-w-[190px]" placeholder="Перевод" value={translation} onChange={(e) => setTranslation(e.target.value)} />
        <button className="btn btn-primary">Добавить</button>
      </form>

      {msg ? <p className="mb-3 text-sm text-hot">{msg}</p> : null}

      <ul className="divide-y divide-line text-sm">
        {terms.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2">
            <span className="w-8 text-xs uppercase muted">{t.lang}</span>
            <span className="flex-1">{t.term} → <span className="text-ink">{t.translation}</span></span>
            <button className="text-xs muted hover:text-hot" onClick={() => remove(t.id)}>удалить</button>
          </li>
        ))}
        {terms.length === 0 ? <li className="py-2 muted">Пока пусто</li> : null}
      </ul>
    </div>
  );
}
