'use client';
import { useEffect, useState } from 'react';

export default function AccountForm({ initialName, email, role }: { initialName: string; email: string; role: string }) {
  const [name, setName] = useState(initialName);
  const [msgName, setMsgName] = useState('');
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [msgPw, setMsgPw] = useState('');
  const [gender, setGender] = useState('');
  const [birth, setBirth] = useState('');
  const [region, setRegion] = useState('');

  useEffect(() => {
    fetch('/api/account').then((r) => r.json()).then((j) => {
      if (!j?.user) return;
      setGender(j.user.gender || '');
      setBirth((j.user.birth_date || '').slice(0, 10));
      setRegion(j.user.region || '');
    }).catch(() => {});
  }, []);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, gender, birthDate: birth, region }) });
    const j = await r.json().catch(() => ({}));
    setMsgName(r.ok ? 'Сохранено' : 'Greška: ' + (j.error || r.status));
  }

  async function savePw(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/account/password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current: cur, next }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setMsgPw('Пароль изменён'); setCur(''); setNext(''); }
    else setMsgPw(j.error === 'wrong_password' ? 'Текущий пароль неверный' : 'Greška: ' + (j.error || r.status));
  }

  return (
    <div className="space-y-5">
      <div className="card p-5 text-sm muted">
        <div>Почта: <span className="text-ink">{email}</span></div>
        <div>Роль: <span className="text-ink">{role}</span></div>
      </div>

      <form onSubmit={saveName} className="card space-y-3 p-5">
        <div className="font-semibold">Имя или ник</div>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="muted">Пол</span>
            <select className="input mt-1" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">не указан</option>
              <option value="m">мужской</option>
              <option value="f">женский</option>
              <option value="other">другой</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="muted">Дата рождения</span>
            <input className="input mt-1" type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="muted">Регион</span>
            <input className="input mt-1" placeholder="RS / Beograd" value={region} onChange={(e) => setRegion(e.target.value)} />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-primary">Sačuvaj</button>
          {msgName ? <span className="text-sm text-hot">{msgName}</span> : null}
        </div>
      </form>

      <form onSubmit={savePw} className="card space-y-3 p-5">
        <div className="font-semibold">Смена пароля</div>
        <input className="input" type="password" placeholder="Текущий пароль" value={cur} onChange={(e) => setCur(e.target.value)} />
        <input className="input" type="password" placeholder="Новый пароль (мин. 8)" value={next} onChange={(e) => setNext(e.target.value)} />
        <div className="flex items-center gap-3">
          <button className="btn btn-primary">Изменить пароль</button>
          {msgPw ? <span className="text-sm text-hot">{msgPw}</span> : null}
        </div>
      </form>
    </div>
  );
}
