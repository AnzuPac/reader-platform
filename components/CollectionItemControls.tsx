'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Управление элементом коллекции: порядок и удаление (для владельца). */
export default function CollectionItemControls({
  collectionId, workId, lang,
}: { collectionId: number; workId: number; lang: 'sr' | 'ru' | 'en' }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const txt = {
    sr: { remove: 'Ukloni', up: '↑', down: '↓' },
    ru: { remove: 'Убрать', up: '↑', down: '↓' },
    en: { remove: 'Remove', up: '↑', down: '↓' },
  }[lang];

  async function call(method: 'DELETE' | 'PUT', body: unknown) {
    setBusy(true);
    await fetch(`/api/collections/${collectionId}/items`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mt-2 flex items-center gap-1">
      <button
        type="button"
        className="btn btn-ghost px-2 py-0.5 text-xs"
        disabled={busy}
        onClick={() => call('DELETE', { workId })}
      >
        {txt.remove}
      </button>
    </div>
  );
}
