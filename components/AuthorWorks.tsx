'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Work = { id: number; slug: string; title: string; status: string; words_total: number; updated_at: string; views_total: number; chapters: number; readers: number; readers7?: number; readers30?: number; likes?: number; bookmarks?: number };

export default function AuthorWorks({ lang }: { lang: string }) {
  const [works, setWorks] = useState<Work[]>([]);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [aiUsage, setAiUsage] = useState('not_declared');
  const [workType, setWorkType] = useState<'novel'|'comic'>('novel');
  const [kind, setKind] = useState<'original'|'fanfic'>('original');
  const [isClassic, setIsClassic] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    const r = await fetch('/api/author/work');
    if (!r.ok) { setMsg('Нет доступа: нужна роль автора'); return; }
    const j = await r.json();
    setWorks(j.works || []);
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/author/work', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description: desc, aiUsage, type: workType, kind, isClassic, rightsConfirmed }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg('Greška: ' + (j.error || r.status)); return; }
    setTitle(''); setDesc(''); setAiUsage('not_declared'); setWorkType('novel'); setKind('original'); setIsClassic(false); setRightsConfirmed(false); setMsg('Черновик создан');
    await load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="card space-y-3 p-5">
        <h2 className="font-semibold">Новое произведение</h2>
        <input className="input" placeholder="Naslov" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="input" rows={3} placeholder="Opis" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Тип<select className="input mt-1 w-full" value={workType} onChange={(e) => setWorkType(e.target.value as 'novel'|'comic')}><option value="novel">Книга / произведение</option><option value="comic">Оригинальный комикс</option></select></label><label className="block text-sm">Права<select className="input mt-1 w-full" value={kind} onChange={(e) => setKind(e.target.value as 'original'|'fanfic')}><option value="original">Оригинальное произведение</option><option value="fanfic">Фанфик</option></select></label></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isClassic} onChange={(e) => setIsClassic(e.target.checked)} /> Произведение в общественном достоянии</label>
        {kind === 'original' && !isClassic ? <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={rightsConfirmed} onChange={(e) => setRightsConfirmed(e.target.checked)} /> Я подтверждаю, что обладаю правами на оригинальное произведение или имею разрешение на коммерческое размещение.</label> : null}
        <p className="text-xs muted">Фанфики и произведения в общественном достоянии нельзя продавать или размещать платные главы. Для них разрешены только добровольные пожертвования.</p>
        <label className="block text-sm muted">Использование ИИ
          <select className="input mt-1 w-full" value={aiUsage} onChange={(e) => setAiUsage(e.target.value)}>
            <option value="not_declared">Не указано</option><option value="no_ai">ИИ не использовался</option><option value="assisted">ИИ использовался частично</option><option value="generated">ИИ-генерация</option>
          </select>
        </label>
        <p className="text-xs muted">Метка показывается читателям. Выбранное значение можно изменить при редактировании произведения.</p>
        <button className="btn btn-primary">Создать черновик</button>
      </form>

      {msg ? <p className="text-sm text-hot">{msg}</p> : null}

      <div className="card overflow-hidden">
        <div className="border-b border-line px-5 py-3 font-semibold">Мои произведения</div>
        <div className="border-b border-line px-5 py-2 text-xs muted">
          Всего по произведениям: читателей {works.reduce((a, w) => a + (w.readers || 0), 0)} ·
          за 7 дней {works.reduce((a, w) => a + (w.readers7 || 0), 0)} ·
          за 30 дней {works.reduce((a, w) => a + (w.readers30 || 0), 0)} ·
          лайков {works.reduce((a, w) => a + (w.likes || 0), 0)} ·
          закладок {works.reduce((a, w) => a + (w.bookmarks || 0), 0)}
        </div>
        <ul className="divide-y divide-line">
          {works.map((w) => (
            <li key={w.id} className="flex items-center gap-3 px-5 py-3">
              <span className="flex-1 font-medium">{w.title}</span>
              <span className="text-xs muted">
                {w.chapters} гл · {w.words_total} слов · 👁 {w.views_total} · 👤 {w.readers}
                <br />7 дн: {w.readers7 ?? 0} · 30 дн: {w.readers30 ?? 0} · ★ {w.likes ?? 0} · 🔖 {w.bookmarks ?? 0}
              </span>
              <span className="text-xs muted">{w.status}</span>
              <Link href={`/${lang}/author/${w.slug}`} className="btn btn-ghost">Редактор</Link>
            </li>
          ))}
          {works.length === 0 ? <li className="px-5 py-4 text-sm muted">Пока нет произведений</li> : null}
        </ul>
      </div>
    </div>
  );
}
