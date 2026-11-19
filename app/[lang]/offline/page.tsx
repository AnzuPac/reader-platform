import { isLang, type Lang } from '@/lib/i18n';
import OfflinePageClient from '@/components/OfflinePageClient';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Offline' };

export default async function OfflinePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  return <OfflinePageClient lang={l} />;
}
