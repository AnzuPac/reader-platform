'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Otkaži подписки в 2 нажатия и семейные профили (до 5). */
export default function SubscribeControls({
  active,
  planCode,
  activeUntil,
  priceLabel,
}: {
  active: boolean;
  planCode?: string | null;
  activeUntil?: string | null;
  priceLabel?: string | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [members, setMembers] = useState<Array<{ user_id: number; display_name: string; email: string }>>([]);
  const [email, setEmail] = useState('');
  const [maxProfiles, setMaxProfiles] = useState(5);

  async function loadFamily() {
    if (planCode !== 'family') return;
    const r = await fetch('/api/subscribe/family');
    if (!r.ok) return;
    const j = await r.json();
    setMembers(j.members || []);
    setMaxProfiles(j.max_profiles || 5);
  }
  useEffect(() => { loadFamily(); }, [planCode]);

  async function cancel() {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/subscribe/cancel', { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg('Greška: ' + (j.error || r.status)); return; }
      setMsg(`Pretplata je otkazana. Čitanje važi do ${String(j.active_until).slice(0, 10)}.`);
      setConfirming(false);
      router.refresh();
    } finally { setBusy(false); }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/subscribe/family', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(
          j.error === 'limit_reached' ? `Достигнут лимит: ${maxProfiles} профилей, включая владельца.`
            : j.error === 'user_not_found' ? 'Korisnik nije pronađen.'
            : 'Не удалось добавить профиль.'
        );
        return;
      }
      setEmail('');
      await loadFamily();
    } finally { setBusy(false); }
  }

  async function removeMember(userId: number) {
    await fetch(`/api/subscribe/family?userId=${userId}`, { method: 'DELETE' });
    await loadFamily();
  }

  if (!active) return null;

  return (
    <section className="card mt-8 p-5">
      <h2 className="mb-2 font-bold">Tvoja pretplata</h2>
      <p className="mb-3 text-sm muted">
        Tarif: <strong>{planCode}</strong>{priceLabel ? ` · ${priceLabel}` : ''}
        {activeUntil ? ` · aktivno do ${String(activeUntil).slice(0, 10)}` : ''}
      </p>

      {planCode === 'family' ? (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-semibold">Porodični profili ({members.length + 1}/{maxProfiles})</h3>
          <ul className="mb-2 divide-y divide-line text-sm">
            <li className="py-2 muted">Ti (vlasnik)</li>
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center gap-2 py-2">
                <span className="flex-1">{m.display_name} · {m.email}</span>
                <button type="button" className="text-xs text-brand" onClick={() => removeMember(m.user_id)}>Ukloni</button>
              </li>
            ))}
          </ul>
          {members.length + 1 < maxProfiles ? (
            <form onSubmit={addMember} className="flex gap-2">
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="email profila" required />
              <button className="btn btn-ghost" disabled={busy}>Dodaj</button>
            </form>
          ) : null}
        </div>
      ) : null}

      {msg ? <p className="mb-3 text-sm text-brand">{msg}</p> : null}

      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Otkaži pretplatu?</span>
          <button className="btn btn-primary" disabled={busy} onClick={cancel}>Da, otkaži</button>
          <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Ne</button>
        </div>
      ) : (
        <button className="btn btn-ghost" onClick={() => setConfirming(true)}>Otkaži pretplatu</button>
      )}
      <p className="mt-2 text-xs muted">
        Podsećanje na produženje stiže 3 dana pre datuma naplate. Nakon otkazivanja pristup ostaje do kraja perioda.
      </p>
    </section>
  );
}
