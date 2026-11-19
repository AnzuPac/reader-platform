import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLang, type Lang } from '@/lib/i18n';
import { readSession } from '@/lib/auth';
import { canViewProfile, getProfile, listPublishedWorks, profileStats } from '@/lib/profiles';
import { followerCount, isFollowing } from '@/lib/follows';
import FollowButton from '@/components/FollowButton';

export const dynamic = 'force-dynamic';

const TXT: Record<Lang, {
  works: string; followers: string; readers: string; empty: string;
  private: string; since: string; me: string;
}> = {
  sr: { works: 'dela', followers: 'pratilaca', readers: 'čitalaca', empty: 'Još nema objavljenih dela.', private: 'Ovaj profil je privatan.', since: 'Na platformi od', me: 'Ovo je tvoj profil' },
  ru: { works: 'произведений', followers: 'подписчиков', readers: 'читателей', empty: 'Опубликованных произведений пока нет.', private: 'Этот профиль приватный.', since: 'На платформе с', me: 'Это твой профиль' },
  en: { works: 'works', followers: 'followers', readers: 'readers', empty: 'No published works yet.', private: 'This profile is private.', since: 'On the platform since', me: 'This is your profile' },
};

export default async function UserProfilePage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const t = TXT[l];

  const userId = Number(id);
  if (!Number.isFinite(userId) || userId <= 0) notFound();

  const session = await readSession();
  const profile = await getProfile(userId);
  if (!profile) notFound();

  const allowed = canViewProfile(profile, session ? { uid: session.uid, role: session.role } : null);
  if (!allowed) {
    return (
      <main id="main" className="tl-screen tl-screen--profile mx-auto max-w-3xl px-5 py-16">
        <div className="card p-8 text-center">
          <h1 className="mb-2 text-2xl font-bold">{profile.name}</h1>
          <p className="muted">{t.private}</p>
        </div>
      </main>
    );
  }

  const [works, stats] = await Promise.all([listPublishedWorks(userId), profileStats(userId)]);
  const isMe = session?.uid === userId;
  const following = session && !isMe ? await isFollowing(session.uid, userId) : false;
  const followers = await followerCount(userId);

  return (
    <main id="main" className="tl-screen tl-screen--profile mx-auto max-w-5xl px-5 py-8">
      <div className="card mb-8 p-6">
        <div className="flex flex-wrap items-center gap-5">
          <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-brand/15 text-2xl font-bold">
            {profile.avatar_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_path} alt={profile.name} className="h-full w-full object-cover" />
            ) : (
              profile.name.slice(0, 1).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{profile.name}</h1>
            {profile.bio ? <p className="mt-1 max-w-xl text-sm muted">{profile.bio}</p> : null}
            <div className="mt-2 flex flex-wrap gap-4 text-xs muted">
              <span>{stats.works} {t.works}</span>
              <span>{followers} {t.followers}</span>
              <span>{stats.readers} {t.readers}</span>
              <span>{t.since} {String(profile.created_at).slice(0, 10)}</span>
            </div>
          </div>
          <div>
            {isMe ? (
              <Link href={`/${l}/account`} className="btn btn-ghost text-sm">{t.me}</Link>
            ) : session ? (
              <FollowButton authorId={userId} initialFollowing={following} initialFollowers={followers} lang={l} />
            ) : null}
          </div>
        </div>
      </div>

      {works.length === 0 ? (
        <div className="card p-8 text-center muted">{t.empty}</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {works.map((w) => (
            <Link key={w.id} href={`/${l}/work/${w.slug}`} className="group">
              <div className="cover cover-sm relative overflow-hidden">
                {w.cover_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.cover_path} alt={w.title} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="relative line-clamp-3">{w.title}</span>
                )}
                {w.ai_usage && w.ai_usage !== 'not_declared' ? <span className={`tl-ai-badge tl-ai-badge--${w.ai_usage}`}>{w.ai_usage === 'no_ai' ? '✓ БЕЗ ИИ' : w.ai_usage === 'assisted' ? '✦ AI-ASSISTED' : '✦ AI CONTENT'}</span> : null}
              </div>
              <div className="mt-2 line-clamp-1 text-sm font-semibold group-hover:text-brand">{w.title}</div>
              <div className="text-xs muted">{w.completion === 'completed' ? '✓' : '…'}</div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
