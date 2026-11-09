'use client';
import { useState } from 'react';

export default function LibraryButton({ workId, initial }: { workId: number; initial: boolean }) {
  const [inLib, setInLib] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function toggle() {
    setBusy(true); setMsg('');
    const r = await fetch('/api/library', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workId }),
    });
    setBusy(false);
    if (r.status === 401) { setMsg('Prvo se prijavi.'); return; }
    const j = await r.json().catch(() => ({}));
    if (r.ok) setInLib(!!j.inLibrary);
  }

  return (
    <div>
      <button className={`btn ${inLib ? 'btn-primary' : 'btn-ghost'}`} onClick={toggle} disabled={busy}>
        {inLib ? '✓ U biblioteci' : '+ Dodaj u biblioteku'}
      </button>
      {msg ? <p className="mt-1 text-xs muted">{msg}</p> : null}
    </div>
  );
}
