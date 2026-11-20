'use client';
import { useState } from 'react';

export default function AuthorActivation({ role, lang = 'sr' }: { role: string; lang?: string }) {
  const [active, setActive] = useState(role === 'author');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const t = lang === 'ru'
    ? { title: 'Стать автором', desc: 'Откройте Авторскую студию в этом же аккаунте. Ваши библиотека, история и профиль сохранятся.', btn: 'Активировать кабинет автора', done: 'Кабинет автора активирован', go: 'Открыть Авторскую студию', err: 'Не удалось активировать статус автора.' }
    : lang === 'en'
    ? { title: 'Become an author', desc: 'Unlock the Author Studio in this account. Your library, history and profile stay intact.', btn: 'Activate author cabinet', done: 'Author cabinet is active', go: 'Open Author Studio', err: 'Could not activate author status.' }
    : { title: 'Postani autor', desc: 'Aktiviraj Autorski studio u istom nalogu. Biblioteka, istorija čitanja i profil ostaju sačuvani.', btn: 'Aktiviraj autorski kabinet', done: 'Autorski kabinet je aktivan', go: 'Otvori Autorski studio', err: 'Aktivacija nije uspela.' };
  if (active) return <section className="mt-6 rounded-2xl border p-4"><h2 className="font-semibold">{t.done}</h2><a className="btn btn-primary mt-3" href={`/${lang}/author`}>{t.go}</a></section>;
  async function activate() {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/author/register', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t.err);
      setActive(true);
    } catch (e) { setError(e instanceof Error ? e.message : t.err); }
    finally { setBusy(false); }
  }
  return <section className="mt-6 rounded-2xl border p-4"><h2 className="font-semibold">{t.title}</h2><p className="mt-2 text-sm opacity-75">{t.desc}</p><button type="button" disabled={busy} onClick={activate} className="btn btn-primary mt-3 disabled:opacity-50">{busy ? '…' : t.btn}</button>{error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}</section>;
}
