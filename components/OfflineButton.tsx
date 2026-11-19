'use client';
import { useEffect, useState } from 'react';
import { loadChapter, removeChapter, saveChapter } from '@/lib/offline';

type Lang = 'sr' | 'en' | 'ru';

const TXT: Record<Lang, { save: string; saved: string; remove: string; tooLarge: string; quota: string; offline: string }> = {
  sr: { save: 'Sačuvaj za offline', saved: 'Sačuvano za offline', remove: 'Ukloni', tooLarge: 'Glava je prevelika za čuvanje', quota: 'Nema mesta u lokalnom skladištu', offline: 'Sačuvano · čita se bez interneta' },
  ru: { save: 'Скачать для офлайна', saved: 'Сохранено для офлайна', remove: 'Удалить', tooLarge: 'Глава слишком большая для сохранения', quota: 'Нет места в локальном хранилище', offline: 'Сохранено · читается без интернета' },
  en: { save: 'Save for offline', saved: 'Saved for offline', remove: 'Remove', tooLarge: 'Chapter is too large to save', quota: 'No space in local storage', offline: 'Saved · readable without network' },
};

/**
 * Офлайн-копия главы: берём отрендеренный HTML (то, что читатель видит),
 * кладём в localStorage. Страница /offline читает эти копии без сети.
 */
export default function OfflineButton({
  chapterId, workId, workTitle, workSlug, number, title, lang,
}: {
  chapterId: number; workId: number; workTitle: string; workSlug: string;
  number: number; title: string; lang: Lang;
}) {
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState('');
  const t = TXT[lang];

  useEffect(() => {
    try { setSaved(Boolean(loadChapter(window.localStorage, chapterId))); } catch { /* приватный режим */ }
  }, [chapterId]);

  function save() {
    const surface = document.querySelector('.reader-surface') || document.querySelector('.prose-reader');
    const html = surface?.innerHTML || '';
    if (!html) { setMsg(t.tooLarge); return; }
    const res = saveChapter(window.localStorage, {
      chapterId, workId, workTitle, workSlug, number, title, html,
    });
    if (res.ok) { setSaved(true); setMsg(t.offline); }
    else setMsg(res.reason === 'too_large' ? t.tooLarge : t.quota);
  }

  function remove() {
    try { removeChapter(window.localStorage, chapterId); } catch { /* приватный режим */ }
    setSaved(false);
    setMsg('');
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-sm">
      {saved ? (
        <>
          <span className="text-xs muted">✓ {t.saved}</span>
          <button type="button" className="btn btn-ghost" onClick={remove}>{t.remove}</button>
        </>
      ) : (
        <button type="button" className="btn btn-ghost" onClick={save}>⤓ {t.save}</button>
      )}
      {msg ? <span className="text-xs muted">{msg}</span> : null}
    </span>
  );
}
