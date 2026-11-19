'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Member = { user_id: number; display_name: string; email: string; role: string; created_at: string };

const ROLES = [
  { key: 'owner', label: 'Владелец' },
  { key: 'manager', label: 'Менеджер' },
  { key: 'member', label: 'Сотрудник' },
];

/** Сотрудники издательства: добавлять и менять роли может только владелец. */
export default function PublisherMembers({ publisherId }: { publisherId?: number }) {
  const [items, setItems] = useState<Member[]>([]);
  const [myRole, setMyRole] = useState<string>('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [msg, setMsg] = useState('');
  const router = useRouter();

  const url = (extra = '') => `/api/publisher/members${publisherId ? `?publisher=${publisherId}` : ''}${extra}`;

  const load = useCallback(async () => {
    const res = await fetch(url(), { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (data?.items) setItems(data.items);
    if (data?.my_role) setMyRole(data.my_role);
    if (res.status === 403) setMsg('Нет доступа к издательству');
  }, [publisherId]);

  useEffect(() => { void load(); }, [load]);

  async function add() {
    if (!email.trim()) return;
    setMsg('');
    const res = await fetch(url(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) { setMsg(data?.error || '✕'); return; }
    setEmail('');
    void load();
    router.refresh();
  }

  async function change(userId: number, nextRole: string) {
    const res = await fetch(url(), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: nextRole }),
    }).catch(() => null);
    if (!res?.ok) {
      const data = await res?.json().catch(() => null);
      setMsg(data?.error || '✕');
      return;
    }
    void load();
  }

  async function remove(userId: number) {
    const res = await fetch(url(`&userId=${userId}`), { method: 'DELETE' }).catch(() => null);
    if (!res?.ok) {
      const data = await res?.json().catch(() => null);
      setMsg(data?.error || '✕');
      return;
    }
    void load();
  }

  const canManage = myRole === 'owner';

  return (
    <section className="card mt-6 p-4">
      <h2 className="mb-3 text-lg font-semibold">Сотрудники</h2>

      <ul className="mb-4 space-y-2 text-sm">
        {items.map((m) => (
          <li key={m.user_id} className="flex flex-wrap items-center gap-2">
            <strong>{m.display_name}</strong>
            <span className="text-xs muted">{m.email}</span>
            {canManage ? (
              <select
                className="input w-auto py-1 text-xs"
                value={m.role}
                onChange={(e) => change(m.user_id, e.target.value)}
              >
                {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            ) : (
              <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px]">{m.role}</span>
            )}
            {canManage ? (
              <button className="text-xs muted hover:text-red-600" onClick={() => remove(m.user_id)}>удалить</button>
            ) : null}
          </li>
        ))}
        {items.length === 0 ? <li className="text-sm muted">Пока никого.</li> : null}
      </ul>

      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          <input className="input w-auto" placeholder="email пользователя" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className="input w-auto py-1" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <button className="btn btn-primary text-sm" onClick={add}>Добавить</button>
        </div>
      ) : (
        <p className="text-xs muted">Управление сотрудниками доступно только владельцу издательства.</p>
      )}

      {msg ? <p className="mt-2 text-xs muted">{msg}</p> : null}
    </section>
  );
}
