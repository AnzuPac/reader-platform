'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const TXT = {
  sr: {
    need: 'Popuni sva polja', exists: 'Nalog sa ovom e-poštom već postoji',
    birth: 'Datum rođenja', birthHint: 'Ne prikazuje se javno. Koristi se za uzrasna ograničenja i statistiku.',
    birthRequired: 'Unesi datum rođenja', birthInvalid: 'Datum rođenja nije ispravan',
    tooYoung: 'Registracija je moguća od 13 godina', weak: 'Lozinka je prekratka (min. 8)',
    fail: 'Greška pri registraciji',
  },
  ru: {
    need: 'Заполни все поля', exists: 'Аккаунт с такой почтой уже есть',
    birth: 'Дата рождения', birthHint: 'Публично не показывается. Нужна для возрастных ограничений и статистики.',
    birthRequired: 'Укажи дату рождения', birthInvalid: 'Дата рождения указана неверно',
    tooYoung: 'Регистрация доступна с 13 лет', weak: 'Пароль слишком короткий (мин. 8)',
    fail: 'Ошибка регистрации',
  },
  en: {
    need: 'Fill in all fields', exists: 'An account with this email already exists',
    birth: 'Date of birth', birthHint: 'Not shown publicly. Used for age limits and statistics.',
    birthRequired: 'Enter your date of birth', birthInvalid: 'Date of birth is invalid',
    tooYoung: 'Registration is available from age 13', weak: 'Password is too short (min. 8)',
    fail: 'Registration failed',
  },
} as const;

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const rawLang = String(useParams<{ lang?: string }>()?.lang || 'sr');
  const lang = rawLang === 'ru' || rawLang === 'en' ? rawLang : 'sr';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !password || !birthDate) { setError(TXT[lang].need); return; }
    setBusy(true); setError('');
    const res = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, birthDate }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      const map: Record<string, string> = {
        err_exists: TXT[lang].exists,
        birthdate_required: TXT[lang].birthRequired,
        birthdate_invalid: TXT[lang].birthInvalid,
        too_young: TXT[lang].tooYoung,
        weak_password: TXT[lang].weak,
      };
      setError(map[String(j.error)] || TXT[lang].fail);
      return;
    }
    router.push(`/${lang}`);
    router.refresh();
  }

  return (
    <main id="main" className="mx-auto max-w-md px-5 py-16">
      <h1 className="mb-6 text-3xl font-bold">Registracija</h1>
      <form onSubmit={submit} className="card space-y-4 p-6">
        <div>
          <label className="mb-1 block text-sm muted">Ime ili nadimak</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm muted">E-pošta</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm muted">Lozinka (min. 8)</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm muted">{TXT[lang].birth}</label>
          <input
            className="input"
            type="date"
            value={birthDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setBirthDate(e.target.value)}
          />
          <p className="mt-1 text-xs muted">{TXT[lang].birthHint}</p>
        </div>
        {error ? <p className="text-sm text-sakura">{error}</p> : null}
        <button className="btn btn-primary w-full justify-center" disabled={busy}>Napravi nalog</button>
      </form>
    </main>
  );
}
