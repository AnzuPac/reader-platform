import { redirect } from 'next/navigation';
import { isLang } from '@/lib/i18n';

export default async function LangHome({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  redirect(`/${isLang(lang) ? lang : 'sr'}/catalog`);
}
