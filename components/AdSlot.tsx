'use client';
import { useEffect, useState } from 'react';

export default function AdSlot({ slot, label = 'Reklama' }: { slot: string; label?: string }) {
  const [html, setHtml] = useState('');
  useEffect(() => {
    fetch(`/api/ads?slot=${encodeURIComponent(slot)}`)
      .then((r) => r.json())
      .then((j) => setHtml(j.html || ''))
      .catch(() => setHtml(''));
  }, [slot]);
  if (!html) return null;
  return (
    <div className="card my-8 p-3">
      <div className="mb-2 text-xs uppercase tracking-wide muted">{label}</div>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
