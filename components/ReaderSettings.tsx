'use client';
import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'sepia';

const THEMES: Record<Theme, { bg: string; fg: string; label: string }> = {
  dark: { bg: '#150f21', fg: '#e4ddf2', label: 'Тёмная' },
  light: { bg: '#ffffff', fg: '#1f2329', label: 'Светлая' },
  sepia: { bg: '#f4ecd8', fg: '#3a3226', label: 'Сепия' },
};

type Prefs = { size: number; lh: number; theme: Theme };

export default function ReaderSettings() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({ size: 18, lh: 1.9, theme: 'dark' });

  function apply(p: Prefs) {
    const t = THEMES[p.theme];
    const root = document.documentElement;
    root.style.setProperty('--reader-size', `${p.size}px`);
    root.style.setProperty('--reader-lh', String(p.lh));
    root.style.setProperty('--reader-bg', t.bg);
    root.style.setProperty('--reader-fg', t.fg);
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem('reader_prefs');
      if (raw) {
        const p = JSON.parse(raw) as Prefs;
        setPrefs(p);
        apply(p);
      } else {
        apply({ size: 18, lh: 1.9, theme: 'dark' });
      }
    } catch {}
  }, []);

  function update(part: Partial<Prefs>) {
    const p = { ...prefs, ...part };
    setPrefs(p);
    apply(p);
    try { localStorage.setItem('reader_prefs', JSON.stringify(p)); } catch {}
  }

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open ? (
        <div className="card mb-2 w-64 p-4 shadow-lg">
          <div className="mb-3 text-sm font-semibold">Чтение</div>

          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="muted">Шрифт</span>
            <div className="flex items-center gap-2">
              <button className="btn btn-ghost px-2 py-0.5" onClick={() => update({ size: Math.max(14, prefs.size - 1) })}>A−</button>
              <span className="w-8 text-center">{prefs.size}</span>
              <button className="btn btn-ghost px-2 py-0.5" onClick={() => update({ size: Math.min(26, prefs.size + 1) })}>A+</button>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="muted">Интервал</span>
            <div className="flex items-center gap-2">
              <button className="btn btn-ghost px-2 py-0.5" onClick={() => update({ lh: Math.max(1.4, +(prefs.lh - 0.1).toFixed(1)) })}>−</button>
              <span className="w-8 text-center">{prefs.lh}</span>
              <button className="btn btn-ghost px-2 py-0.5" onClick={() => update({ lh: Math.min(2.4, +(prefs.lh + 0.1).toFixed(1)) })}>+</button>
            </div>
          </div>

          <div className="mb-1 text-sm muted">Тема</div>
          <div className="flex gap-1">
            {(Object.keys(THEMES) as Theme[]).map((k) => (
              <button key={k} onClick={() => update({ theme: k })}
                className={`flex-1 rounded px-2 py-1 text-xs font-semibold ${prefs.theme === k ? 'bg-brand text-white' : 'border border-line text-mist'}`}>
                {THEMES[k].label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <button onClick={() => setOpen(!open)} className="btn btn-primary rounded-full px-4 py-2 shadow-lg" title="Настройки чтения">
        Aa
      </button>
    </div>
  );
}
