'use client';
import { useState } from 'react';

/** Форма prijave для издателей. После успеха показывает подтверждение на экране. */
export default function PublisherLeadForm() {
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<number | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
      setError('Unesite ime i ispravnu e-poštu.');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/publisher-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j.error === 'too_many_requests' ? 'Previše zahteva. Pokušajte kasnije.' : 'Zahtev nije poslat. Pokušajte ponovo.');
        return;
      }
      setDone(Number(j.leadId) || 0);
    } catch {
      setError('Greška u mreži.');
    } finally {
      setBusy(false);
    }
  }

  if (done !== null) {
    return (
      <div className="card p-6" role="status">
        <h2 className="mb-2 text-xl font-bold">Hvala! Zahtev je primljen.</h2>
        <p className="muted">
          Javljamo se na unetu e-poštu u roku od dva radna dana i dogovaramo pilot.
          {done > 0 ? ` Broj zahteva: #${done}.` : ''}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <h2 className="text-xl font-bold">Zatražite pilot</h2>
      <p className="text-sm muted">Bez ekskluzivnosti. Prvo gledamo kako funkcioniše na 3–6 naslova.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Ime i prezime *</span>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Izdavačka kuća</span>
          <input className="input" value={form.company} onChange={(e) => set('company', e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">E-pošta *</span>
          <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Telefon</span>
          <input className="input" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-semibold">Poruka</span>
        <textarea
          className="input"
          rows={4}
          maxLength={2000}
          value={form.message}
          onChange={(e) => set('message', e.target.value)}
          placeholder="Koliko naslova, koji žanrovi, šta vam je važno?"
        />
      </label>

      {error ? <p className="text-sm text-pink-300">{error}</p> : null}

      <button className="btn btn-primary" disabled={busy}>
        {busy ? '…' : 'Pošalji zahtev'}
      </button>
      <p className="text-xs muted">Podatke koristimo samo za odgovor na ovaj zahtev.</p>
    </form>
  );
}
