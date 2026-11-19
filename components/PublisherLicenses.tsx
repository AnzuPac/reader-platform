'use client';
import { useEffect, useState } from 'react';

type Lang = 'sr' | 'ru' | 'en';
type License = {
  territory: string; starts_at: string | null; ends_at: string | null;
  rights_sale: number | boolean; rights_subscription: number | boolean;
  rights_library: number | boolean; tts_allowed: number | boolean;
  translit_allowed: number | boolean; export_policy: string;
};

const TXT: Record<Lang, {
  title: string; work: string; territory: string; from: string; to: string;
  sale: string; sub: string; lib: string; tts: string; translit: string;
  export: string; save: string; saved: string; err: string; empty: string;
}> = {
  sr: {
    title: 'Licenca i teritorija', work: 'Delo', territory: 'Teritorija (RS, WW, RS,ME)',
    from: 'Od', to: 'Do', sale: 'Prodaja', sub: 'Pretplata', lib: 'Biblioteka',
    tts: 'TTS', translit: 'Transliteracija', export: 'Izvoz', save: 'Sačuvaj',
    saved: 'Sačuvano', err: 'Greška', empty: 'Nema dela.',
  },
  ru: {
    title: 'Лицензия и территория', work: 'Произведение', territory: 'Территория (RS, WW, RS,ME)',
    from: 'С', to: 'По', sale: 'Продажа', sub: 'Подписка', lib: 'Библиотека',
    tts: 'Озвучка', translit: 'Транслитерация', export: 'Экспорт', save: 'Сохранить',
    saved: 'Сохранено', err: 'Ошибка', empty: 'Нет произведений.',
  },
  en: {
    title: 'License and territory', work: 'Work', territory: 'Territory (RS, WW, RS,ME)',
    from: 'From', to: 'To', sale: 'Sale', sub: 'Subscription', lib: 'Library',
    tts: 'TTS', translit: 'Transliteration', export: 'Export', save: 'Save',
    saved: 'Saved', err: 'Error', empty: 'No works.',
  },
};

const flag = (v: unknown) => v === true || v === 1 || v === '1';

/** Лицензия издателя: территория, срок действия и права по произведению. */
export default function PublisherLicenses({
  publisherId, works, lang = 'ru',
}: { publisherId: number; works: { id: number; title: string }[]; lang?: Lang }) {
  const t = TXT[lang];
  const [workId, setWorkId] = useState(works[0]?.id || 0);
  const [form, setForm] = useState({
    territory: 'RS', startsAt: '', endsAt: '',
    sale: true, subscription: false, library: false, tts: false, translit: false,
    exportPolicy: 'disallowed',
  });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!workId) return;
    let alive = true;
    (async () => {
      const res = await fetch(`/api/publisher/licenses?publisher=${publisherId}&workId=${workId}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!alive || !data) return;
      const l: License | null = data.license;
      setForm({
        territory: l?.territory || 'RS',
        startsAt: l?.starts_at ? String(l.starts_at).slice(0, 10) : '',
        endsAt: l?.ends_at ? String(l.ends_at).slice(0, 10) : '',
        sale: l ? flag(l.rights_sale) : true,
        subscription: l ? flag(l.rights_subscription) : false,
        library: l ? flag(l.rights_library) : false,
        tts: l ? flag(l.tts_allowed) : false,
        translit: l ? flag(l.translit_allowed) : false,
        exportPolicy: l?.export_policy || 'disallowed',
      });
    })();
    return () => { alive = false; };
  }, [publisherId, workId]);

  async function save() {
    setBusy(true); setMsg('');
    const res = await fetch(`/api/publisher/licenses?publisher=${publisherId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workId,
        territory: form.territory,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        rightsSale: form.sale,
        rightsSubscription: form.subscription,
        rightsLibrary: form.library,
        tts: form.tts,
        translit: form.translit,
        exportPolicy: form.exportPolicy,
      }),
    }).catch(() => null);
    setBusy(false);
    setMsg(res?.ok ? t.saved : t.err);
  }

  if (works.length === 0) {
    return (
      <section className="card mt-6 p-4">
        <h2 className="mb-2 text-lg font-semibold">{t.title}</h2>
        <p className="text-sm muted">{t.empty}</p>
      </section>
    );
  }

  return (
    <section className="card mt-6 p-4">
      <h2 className="mb-3 text-lg font-semibold">{t.title}</h2>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-xs muted">{t.work}</label>
        <select className="input w-auto py-1 text-sm" value={workId} onChange={(e) => setWorkId(Number(e.target.value))}>
          {works.map((w) => <option key={w.id} value={w.id}>{w.title}</option>)}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs muted">
          {t.territory}
          <input className="input mt-1" value={form.territory}
            onChange={(e) => setForm({ ...form, territory: e.target.value })} />
        </label>
        <label className="text-xs muted">
          {t.from}
          <input className="input mt-1" type="date" value={form.startsAt}
            onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
        </label>
        <label className="text-xs muted">
          {t.to}
          <input className="input mt-1" type="date" value={form.endsAt}
            onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        {([['sale', t.sale], ['subscription', t.sub], ['library', t.lib], ['tts', t.tts], ['translit', t.translit]] as const).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form[key] as boolean}
              onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="text-xs muted">
          {t.export}
          <select className="input ml-2 w-auto py-1 text-sm" value={form.exportPolicy}
            onChange={(e) => setForm({ ...form, exportPolicy: e.target.value })}>
            <option value="disallowed">disallowed</option>
            <option value="watermark">watermark</option>
            <option value="original">original</option>
          </select>
        </label>
        <button className="btn btn-primary text-sm" onClick={save} disabled={busy}>{t.save}</button>
        {msg ? <span className="text-xs muted">{msg}</span> : null}
      </div>
    </section>
  );
}
