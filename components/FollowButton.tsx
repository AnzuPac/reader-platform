'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Lang = 'sr' | 'ru' | 'en';

const TXT: Record<Lang, { follow: string; following: string; unfollow: string }> = {
  sr: { follow: 'Zaprati', following: 'Pratiš', unfollow: 'Otprati' },
  ru: { follow: 'Подписаться', following: 'Вы подписаны', unfollow: 'Отписаться' },
  en: { follow: 'Follow', following: 'Following', unfollow: 'Unfollow' },
};

/** Подписка на автора: новые главы попадают в уведомления. */
export default function FollowButton({
  authorId, initialFollowing, initialFollowers = 0, lang,
}: { authorId: number; initialFollowing: boolean; initialFollowers?: number; lang: Lang }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [followers, setFollowers] = useState(initialFollowers);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const router = useRouter();
  const t = TXT[lang];

  async function toggle() {
    setBusy(true); setMsg('');
    const res = await fetch(following ? `/api/follow?authorId=${authorId}` : '/api/follow', {
      method: following ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: following ? undefined : JSON.stringify({ authorId }),
    }).catch(() => null);

    setBusy(false);
    if (res?.status === 401) { setMsg('✕'); return; }
    const data = await res?.json().catch(() => null);
    if (!res?.ok) { setMsg('✕'); return; }
    setFollowing(Boolean(data?.following));
    if (typeof data?.followers === 'number') setFollowers(data.followers);
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className={`btn ${following ? 'btn-ghost' : 'btn-primary'} text-sm`}
        onClick={toggle}
        disabled={busy}
      >
        {following ? `✓ ${t.following}` : `+ ${t.follow}`}
      </button>
      <span className="text-xs muted">{followers}</span>
      {msg ? <span className="text-xs muted">{msg}</span> : null}
    </span>
  );
}
