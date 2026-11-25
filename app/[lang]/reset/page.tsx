import { Suspense } from 'react';
import { isLang, type Lang } from '@/lib/i18n';
import ResetPasswordForm from '@/components/ResetPasswordForm';

export default async function ResetPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const titles: Record<Lang, string> = {
    sr: 'Nova lozinka', ru: 'Новый пароль', en: 'New password',
  };
  return (
    <main id="main" className="tl-screen mx-auto max-w-md px-5 py-16">
      <h1 className="mb-6 text-3xl font-bold">{titles[l]}</h1>
      <Suspense fallback={<div className="card p-6 muted">…</div>}>
        <ResetPasswordForm lang={l} />
      </Suspense>
    </main>
  );
}
