'use client';
import { useEffect, useState } from 'react';

type Work = { id: number; slug: string; title: string; status: string; words_total: number; author?: string };
type Payment = { id: number; amount_cents: number; currency: string; status: string; user: string; email: string; meta: string };
type Comment = { id: number; body: string; status: string; author: string; work: string; created_at: string };

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [works, setWorks] = useState<Work[]>([]);
  const [review, setReview] = useState<Work[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState<'review' | 'payments' | 'comments' | 'content'>('review');

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [age, setAge] = useState(0);
  const [slug, setSlug] = useState('');
  const [number, setNumber] = useState(1);
  const [chTitle, setChTitle] = useState('');
  const [content, setContent] = useState('');
  const [access, setAccess] = useState('free');
  const [coverSlug, setCoverSlug] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('admin_token') || '';
    setToken(saved);
    if (saved) loadAll(saved);
  }, []);

  function headers(tk = token): Record<string, string> {
    return { 'x-admin-token': tk, 'Content-Type': 'application/json' };
  }

  async function loadAll(tk = token) {
    const [w, rv, pay, cm] = await Promise.all([
      fetch('/api/admin/work', { headers: headers(tk) }).then((r) => r.json()).catch(() => ({})),
      fetch('/api/admin/works?status=review', { headers: headers(tk) }).then((r) => r.json()).catch(() => ({})),
      fetch('/api/admin/payments?status=pending', { headers: headers(tk) }).then((r) => r.json()).catch(() => ({})),
      fetch('/api/admin/comment', { headers: headers(tk) }).then((r) => r.json()).catch(() => ({})),
    ]);
    setWorks(w.works || []);
    setReview(rv.works || []);
    setPayments(pay.payments || []);
    setComments(cm.comments || []);
  }

  async function saveToken() {
    localStorage.setItem('admin_token', token);
    await loadAll(token);
    setMsg('Токен сохранён');
  }

  async function workAction(slg: string, action: string) {
    const r = await fetch('/api/admin/work-status', { method: 'POST', headers: headers(), body: JSON.stringify({ slug: slg, action }) });
    setMsg(r.ok ? `Произведение: ${action}` : 'Ошибка');
    await loadAll();
  }

  async function confirmPayment(id: number) {
    const r = await fetch('/api/admin/payment', { method: 'POST', headers: headers(), body: JSON.stringify({ paymentId: id }) });
    setMsg(r.ok ? 'Оплата подтверждена, подписка выдана' : 'Ошибка подтверждения');
    await loadAll();
  }

  async function commentAction(id: number, action: string) {
    const r = await fetch('/api/admin/comment', { method: 'POST', headers: headers(), body: JSON.stringify({ id, action }) });
    setMsg(r.ok ? `Комментарий: ${action}` : 'Ошибка');
    await loadAll();
  }

  async function createWork(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/admin/work', { method: 'POST', headers: headers(), body: JSON.stringify({ title, description: desc, ageRating: age }) });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? 'Произведение создано: ' + j.work.slug : 'Ошибка: ' + (j.error || r.status));
    setTitle(''); setDesc(''); await loadAll();
  }

  async function createChapter(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/admin/chapter', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ workSlug: slug, number, title: chTitle, content, access }),
    });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? `Глава ${j.chapter.number} добавлена` : 'Ошибка: ' + (j.error || r.status));
    setChTitle(''); setContent('');
  }

  async function uploadCover(e: React.FormEvent) {
    e.preventDefault();
    if (!coverSlug || !coverFile) { setMsg('Выбери произведение и файл'); return; }
    const fd = new FormData();
    fd.append('workSlug', coverSlug);
    fd.append('file', coverFile);
    const r = await fetch('/api/admin/cover', { method: 'POST', headers: { 'x-admin-token': token }, body: fd });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? 'Обложка загружена: ' + j.cover : 'Ошибка: ' + (j.error || r.status));
  }

  const Tab = ({ id, label, count }: { id: typeof tab; label: string; count?: number }) => (
    <button onClick={() => setTab(id)}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === id ? 'bg-brand text-white' : 'border border-line text-mist'}`}>
      {label}{count ? ` (${count})` : ''}
    </button>
  );

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <h1 className="mb-5 text-2xl font-bold">Админка</h1>

      <div className="card mb-5 flex flex-wrap items-center gap-2 p-4">
        <input className="input max-w-xs" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Токен доступа" />
        <button className="btn btn-ghost" onClick={saveToken}>Сохранить токен</button>
        {msg ? <span className="text-sm text-hot">{msg}</span> : null}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <Tab id="review" label="На проверке" count={review.length} />
        <Tab id="payments" label="Оплаты" count={payments.length} />
        <Tab id="comments" label="Комментарии" count={comments.length} />
        <Tab id="content" label="Контент" />
      </div>

      {tab === 'review' ? (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-line">
            {review.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex-1 font-medium">{w.title}</span>
                <span className="text-xs muted">{w.author}</span>
                <button className="btn btn-primary" onClick={() => workAction(w.slug, 'publish')}>Опубликовать</button>
                <button className="btn btn-ghost" onClick={() => workAction(w.slug, 'hide')}>Скрыть</button>
              </li>
            ))}
            {review.length === 0 ? <li className="px-4 py-4 text-sm muted">Нет произведений на проверке</li> : null}
          </ul>
        </div>
      ) : null}

      {tab === 'payments' ? (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-line">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex-1">#{p.id} · {p.user} ({p.email})</span>
                <span className="text-sm">{(p.amount_cents / 100).toFixed(2)} {p.currency}</span>
                <button className="btn btn-primary" onClick={() => confirmPayment(p.id)}>Подтвердить</button>
              </li>
            ))}
            {payments.length === 0 ? <li className="px-4 py-4 text-sm muted">Нет ожидающих оплат</li> : null}
          </ul>
        </div>
      ) : null}

      {tab === 'comments' ? (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-line">
            {comments.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <div className="mb-1 text-xs muted">{c.author} · {c.work} · {c.status}</div>
                <div className="mb-2 text-sm" dangerouslySetInnerHTML={{ __html: c.body }} />
                <div className="flex gap-2 text-xs">
                  <button className="text-mist hover:text-brand" onClick={() => commentAction(c.id, 'show')}>показать</button>
                  <button className="text-mist hover:text-brand" onClick={() => commentAction(c.id, 'hide')}>скрыть</button>
                  <button className="text-mist hover:text-hot" onClick={() => commentAction(c.id, 'delete')}>удалить</button>
                </div>
              </li>
            ))}
            {comments.length === 0 ? <li className="px-4 py-4 text-sm muted">Комментариев нет</li> : null}
          </ul>
        </div>
      ) : null}

      {tab === 'content' ? (
        <div className="space-y-5">
          <form onSubmit={createWork} className="card space-y-3 p-4">
            <h2 className="font-semibold">Новое произведение</h2>
            <input className="input" placeholder="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="input" rows={3} placeholder="Описание" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <div className="flex items-center gap-3 text-sm">
              <span className="muted">Возраст:</span>
              {[0, 16, 18].map((a) => (
                <label key={a} className="flex items-center gap-1">
                  <input type="radio" checked={age === a} onChange={() => setAge(a)} /> {a}
                </label>
              ))}
            </div>
            <button className="btn btn-primary">Создать</button>
          </form>

          <form onSubmit={uploadCover} className="card space-y-3 p-4">
            <h2 className="font-semibold">Обложка произведения</h2>
            <select className="input" value={coverSlug} onChange={(e) => setCoverSlug(e.target.value)}>
              <option value="">— выбери произведение —</option>
              {works.map((w) => <option key={w.id} value={w.slug}>{w.title}</option>)}
            </select>
            <input className="input" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
            <button className="btn btn-primary">Загрузить обложку</button>
          </form>

          <form onSubmit={createChapter} className="card space-y-3 p-4">
            <h2 className="font-semibold">Новая глава</h2>
            <select className="input" value={slug} onChange={(e) => setSlug(e.target.value)}>
              <option value="">— выбери произведение —</option>
              {works.map((w) => <option key={w.id} value={w.slug}>{w.title}</option>)}
            </select>
            <div className="flex gap-2">
              <input className="input max-w-[110px]" type="number" min={1} value={number} onChange={(e) => setNumber(Number(e.target.value))} />
              <input className="input" placeholder="Название главы" value={chTitle} onChange={(e) => setChTitle(e.target.value)} />
            </div>
            <textarea className="input" rows={8} placeholder="Текст главы" value={content} onChange={(e) => setContent(e.target.value)} />
            <select className="input max-w-[200px]" value={access} onChange={(e) => setAccess(e.target.value)}>
              <option value="free">Бесплатно</option>
              <option value="subscribers">Подписчики</option>
              <option value="paid">Платная</option>
            </select>
            <button className="btn btn-primary">Добавить главу</button>
          </form>

          <div className="card p-4">
            <h2 className="mb-2 font-semibold">Произведения ({works.length})</h2>
            <ul className="divide-y divide-line text-sm">
              {works.map((w) => (
                <li key={w.id} className="flex items-center justify-between py-2">
                  <span>{w.title}</span>
                  <span className="text-xs muted">{w.slug} · {w.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </main>
  );
}
