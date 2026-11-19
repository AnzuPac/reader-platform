'use client';
import { useState } from 'react';

type Lang = 'sr' | 'ru' | 'en';

const TXT: Record<Lang, { label: string; busy: string; err: string; denied: string }> = {
  sr: { label: 'Preuzmi PDF', busy: 'Priprema…', err: 'Greška pri izradi PDF-a', denied: 'PDF nije dostupan za ovo delo' },
  ru: { label: 'Скачать PDF', busy: 'Готовим…', err: 'Ошибка при сборке PDF', denied: 'PDF недоступен для этого произведения' },
  en: { label: 'Download PDF', busy: 'Preparing…', err: 'PDF generation failed', denied: 'PDF is not available for this work' },
};

/** Кнопка экспорта: сервер сам решает, можно ли отдавать файл. */
export default function ExportPdfButton({ slug, lang }: { slug: string; lang: Lang }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const t = TXT[lang];

  async function download() {
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/export/pdf?slug=${encodeURIComponent(slug)}`);
      if (!res.ok) {
        setMsg(res.status === 403 || res.status === 401 ? t.denied : t.err);
        setBusy(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setMsg(t.err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className="btn btn-ghost text-sm" onClick={download} disabled={busy}>
        ⤓ {busy ? t.busy : t.label}
      </button>
      {msg ? <span className="text-xs muted">{msg}</span> : null}
    </span>
  );
}
