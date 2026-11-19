'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Status = 'want' | 'reading' | 'done' | 'favorite' | 'postponed' | 'dropped';

const LABELS: Record<Status | 'remove', Record<'sr' | 'ru' | 'en', string>> = {
  reading: { sr: 'Čitam', ru: 'Читаю', en: 'Reading' },
  want: { sr: 'U planu', ru: 'В планах', en: 'Want to read' },
  done: { sr: 'Pročitano', ru: 'Прочитано', en: 'Finished' },
  favorite: { sr: 'Omiljeno', ru: 'Любимое', en: 'Favourite' },
  postponed: { sr: 'Odloženo', ru: 'Отложено', en: 'Postponed' },
  dropped: { sr: 'Napušteno', ru: 'Брошено', en: 'Dropped' },
  remove: { sr: 'Ukloni', ru: 'Убрать', en: 'Remove' },
};

const ORDER: Status[] = ['reading', 'want', 'done', 'favorite', 'postponed', 'dropped'];

/** Смена статуса книги на «Моей полке» — с сохранением на сервере. */
export default function LibraryStatusPicker({
  workId, initial, lang,
}: { workId: number; initial: Status | null; lang: 'sr' | 'ru' | 'en' }) {
  const [value, setValue] = useState<Status | 'remove' | ''>(initial || '');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function change(next: string) {
    if (!next) return;
    setBusy(true);
    const res = await fetch('/api/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workId, status: next }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return;
    setValue(next as Status | 'remove');
    router.refresh();
  }

  return (
    <select
      className="input w-auto py-1 text-xs"
      value={value}
      disabled={busy}
      onChange={(e) => { void change(e.target.value); }}
      aria-label={LABELS.reading[lang]}
    >
      {!value ? <option value="">—</option> : null}
      {ORDER.map((s) => (
        <option key={s} value={s}>{LABELS[s][lang]}</option>
      ))}
      <option value="remove">{LABELS.remove[lang]}</option>
    </select>
  );
}
