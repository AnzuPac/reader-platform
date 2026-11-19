'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Publisher = {
  id: number; name: string; slug: string; contact_email: string;
  commission_pct: number; works_count: number; owner_email: string | null;
};
type Work = { id: number; slug: string; title: string; type: string; publisher_id: number | null; price_cents: number | null };
type Lead = {
  id: number; name: string; company: string; email: string; phone: string;
  message: string; status: string; created_at: string;
};

const LEAD_LABEL: Record<string, string> = {
  new: 'новая', contacted: 'обработана', won: 'клиент', lost: 'отказ',
};

export default function AdminPublishersPage() {
  const [token, setToken] = useState('');
  const rawLang = String(useParams<{ lang?: string }>()?.lang || 'sr');
  const lang = rawLang === 'ru' || rawLang === 'en' ? rawLang : 'sr';
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [msg, setMsg] = useState('');

  const [name, setName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [commission, setCommission] = useState(25);

  const [workId, setWorkId] = useState('');
  const [publisherId, setPublisherId] = useState('');
  const [priceEur, setPriceEur] = useState('');

  useEffect(() => {
    // Сессия — в HttpOnly-cookie, выданной /api/admin/session.
    fetch('/api/admin/session')
      .then((r) => r.json())
      .then((j) => { if (j?.admin) loadAll(''); })
      .catch(() => {});
  }, []);

  function headers(tk = token): Record<string, string> {
    return { 'x-admin-token': tk, 'Content-Type': 'application/json' };
  }

  async function loadAll(tk = token) {
    const [p, l] = await Promise.all([
      fetch('/api/admin/publishers', { headers: headers(tk) }).then((r) => r.json()).catch(() => ({})),
      fetch('/api/admin/publisher-leads', { headers: headers(tk) }).then((r) => r.json()).catch(() => ({})),
    ]);
    if (p.error) { setMsg('Токен не принят'); return; }
    setPublishers(p.publishers || []);
    setWorks(p.works || []);
    setLeads(l.leads || []);
    setMsg('');
  }

  async function saveToken() {
    const r = await fetch('/api/admin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.message || j.error || 'Токен не принят'); return; }
    setToken('');
    await loadAll('');
  }

  async function createPublisher(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/admin/publishers', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ name, contactEmail, ownerEmail, commissionPct: commission }),
    }).then((x) => x.json()).catch(() => ({}));
    if (r.ok) {
      setMsg(`Издательство создано (#${r.publisherId})${r.memberUserId ? ', владелец привязан' : ''}`);
      setName(''); setContactEmail(''); setOwnerEmail(''); setCommission(25);
      await loadAll();
    } else setMsg(`Greška: ${r.error || 'не удалось'}`);
  }

  async function attachWork(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {
      workId: Number(workId) || undefined,
      publisherId: publisherId ? Number(publisherId) : null,
    };
    if (priceEur !== '') body.priceCents = Math.round(Number(priceEur) * 100);
    const r = await fetch('/api/admin/publisher-work', {
      method: 'POST', headers: headers(), body: JSON.stringify(body),
    }).then((x) => x.json()).catch(() => ({}));
    if (r.ok) {
      setMsg(`Произведение привязано${r.priceCents != null ? `, цена ${Math.round(r.priceCents / 100)} RSD` : ''}`);
      await loadAll();
    } else setMsg(`Greška: ${r.error || 'не удалось'}`);
  }

  async function markLead(id: number, status: string) {
    await fetch('/api/admin/publisher-leads', {
      method: 'POST', headers: headers(), body: JSON.stringify({ leadId: id, status }),
    });
    await loadAll();
  }

  return (
    <main id="main" className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="mb-2 text-2xl font-bold">Издательства</h1>
      <p className="mb-6 text-sm muted">
        Комиссия площадки, привязка владельца и произведений, заявки с лендинга.
      </p>

      <div className="card mb-6 flex flex-wrap items-center gap-2 p-4">
        <input className="input max-w-sm" type="password" placeholder="ADMIN_TOKEN"
          value={token} onChange={(e) => setToken(e.target.value)} />
        <button className="btn btn-primary" onClick={saveToken}>Prijava</button>
        <span className="text-sm muted">{msg}</span>
      </div>

      <section className="mb-8">
        <h2 className="section-title">Издательства ({publishers.length})</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase muted">
              <tr>
                <th className="px-4 py-3">Naslov</th>
                <th className="px-4 py-3">Комиссия</th>
                <th className="px-4 py-3">Книг</th>
                <th className="px-4 py-3">Владелец</th>
                <th className="px-4 py-3">Кабинет</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {publishers.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs muted">{p.contact_email || p.slug}</div>
                  </td>
                  <td className="px-4 py-3">{p.commission_pct}%</td>
                  <td className="px-4 py-3">{p.works_count}</td>
                  <td className="px-4 py-3 muted">{p.owner_email || '—'}</td>
                  <td className="px-4 py-3">
                    <a className="text-brand hover:underline" href={`/${lang}/publisher`} target="_blank" rel="noreferrer">
                      открыть
                    </a>
                  </td>
                </tr>
              ))}
              {publishers.length === 0 ? (
                <tr><td className="px-4 py-4 muted" colSpan={5}>Пока нет издательств</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mb-8 grid gap-6 md:grid-cols-2">
        <form onSubmit={createPublisher} className="card space-y-3 p-4">
          <h2 className="font-semibold">Новое издательство</h2>
          <input className="input" placeholder="Naslov" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="input" type="email" placeholder="Контактный email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          <input className="input" type="email" placeholder="Email владельца (привязать)" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
          <label className="block text-sm muted">
            Комиссия площадки, %
            <input className="input mt-1" type="number" min={0} max={100} value={commission} onChange={(e) => setCommission(Number(e.target.value))} />
          </label>
          <button className="btn btn-primary">Создать</button>
        </form>

        <form onSubmit={attachWork} className="card space-y-3 p-4">
          <h2 className="font-semibold">Произведение → издательство</h2>
          <select className="input" value={workId} onChange={(e) => setWorkId(e.target.value)} required>
            <option value="">— произведение —</option>
            {works.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title} ({w.type}){w.price_cents != null ? ` · ${(w.price_cents / 100).toFixed(2)} €` : ''}
              </option>
            ))}
          </select>
          <select className="input" value={publisherId} onChange={(e) => setPublisherId(e.target.value)}>
            <option value="">— без издательства —</option>
            {publishers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input className="input" type="number" min={0} step="0.01" placeholder="Цена книги, RSD (пусто — не менять)"
            value={priceEur} onChange={(e) => setPriceEur(e.target.value)} />
          <button className="btn btn-primary">Привязать</button>
        </form>
      </div>

      <section>
        <h2 className="section-title">Заявки издательств ({leads.length})</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase muted">
              <tr>
                <th className="px-4 py-3">Имя</th>
                <th className="px-4 py-3">Издательство</th>
                <th className="px-4 py-3">Контакты</th>
                <th className="px-4 py-3">Сообщение</th>
                <th className="px-4 py-3">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {leads.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3">{l.name}</td>
                  <td className="px-4 py-3">{l.company || '—'}</td>
                  <td className="px-4 py-3 muted">
                    <div>{l.email}</div>
                    <div>{l.phone || '—'}</div>
                  </td>
                  <td className="max-w-[320px] px-4 py-3 muted">{l.message || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="mb-2 text-xs">{LEAD_LABEL[l.status] || l.status}</div>
                    {l.status === 'new' ? (
                      <button className="btn btn-ghost" onClick={() => markLead(l.id, 'contacted')}>обработано</button>
                    ) : (
                      <button className="text-xs muted hover:text-brand" onClick={() => markLead(l.id, 'new')}>вернуть в новые</button>
                    )}
                  </td>
                </tr>
              ))}
              {leads.length === 0 ? (
                <tr><td className="px-4 py-4 muted" colSpan={5}>Заявок нет</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
