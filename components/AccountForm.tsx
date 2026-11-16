'use client';
import { useState } from 'react';

export default function AccountForm({ initialName, email, role }: { initialName: string; email: string; role: string }) {
  const [name, setName] = useState(initialName);
  const [msgName, setMsgName] = useState('');
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [msgPw, setMsgPw] = useState('');

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const j = await r.json().catch(() => ({}));
    setMsgName(r.ok ? 'Sačuvano' : 'Greška: ' + (j.error || r.status));
  }

  async function savePw(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/account/password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current: cur, next }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setMsgPw('Lozinka promenjena'); setCur(''); setNext(''); }
    else setMsgPw(j.error === 'wrong_password' ? 'Trenutna lozinka nije ispravna' : 'Greška: ' + (j.error || r.status));
  }

  return (
    <div className="space-y-5">
      <div className="card p-5 text-sm muted">
        <div>Pošta: <span className="text-ink">{email}</span></div>
        <div>Роль: <span className="text-ink">{role}</span></div>
      </div>

      <form onSubmit={saveName} className="card space-y-3 p-5">
        <div className="font-semibold">Имя или ник</div>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex items-center gap-3">
          <button className="btn btn-primary">Sačuvaj</button>
          {msgName ? <span className="text-sm text-hot">{msgName}</span> : null}
        </div>
      </form>

      <form onSubmit={savePw} className="card space-y-3 p-5">
        <div className="font-semibold">Смена пароля</div>
        <input className="input" type="password" placeholder="Trenutna lozinka" value={cur} onChange={(e) => setCur(e.target.value)} />
        <input className="input" type="password" placeholder="Новый пароль (мин. 8)" value={next} onChange={(e) => setNext(e.target.value)} />
        <div className="flex items-center gap-3">
          <button className="btn btn-primary">Изменить пароль</button>
          {msgPw ? <span className="text-sm text-hot">{msgPw}</span> : null}
        </div>
      </form>
    </div>
  );
}
