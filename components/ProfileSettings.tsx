'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Lang = 'sr' | 'ru' | 'en';

const TXT: Record<Lang, { title: string; bio: string; pub: string; save: string; saved: string; err: string }> = {
  sr: { title: 'Profil', bio: 'O sebi', pub: 'Javni profil', save: 'Sačuvaj', saved: 'Sačuvano', err: 'Greška' },
  ru: { title: 'Профиль', bio: 'О себе', pub: 'Публичный профиль', save: 'Сохранить', saved: 'Сохранено', err: 'Ошибка' },
  en: { title: 'Profile', bio: 'About you', pub: 'Public profile', save: 'Save', saved: 'Saved', err: 'Error' },
};

/** Настройки профиля: описание и публичность. Дата рождения наружу не уходит. */
export default function ProfileSettings({
  lang, initialBio = '', initialPublic = true, initialName = '',
}: { lang: Lang; initialBio?: string; initialPublic?: boolean; initialName?: string }) {
  const [bio, setBio] = useState(initialBio);
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const t = TXT[lang];

  async function save() {
    setBusy(true); setMsg('');
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio, isPublic }),
    }).catch(() => null);
    setBusy(false);
    setMsg(res?.ok ? t.saved : t.err);
    if (res?.ok) router.refresh();
  }

  return (
    <section className="card mt-6 space-y-3 p-4">
      <h2 className="text-sm font-semibold">{t.title}</h2>
      {initialName ? <p className="text-xs muted">{initialName}</p> : null}
      <textarea
        className="input min-h-[90px]"
        placeholder={t.bio}
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        maxLength={1000}
      />
      <label className="flex items-center gap-2 text-sm muted">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        {t.pub}
      </label>
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{t.save}</button>
        {msg ? <span className="text-xs muted">{msg}</span> : null}
      </div>
    </section>
  );
}
