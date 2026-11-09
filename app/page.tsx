import { redirect } from 'next/navigation';
import { DEFAULT_LANG } from '@/lib/i18n';

export default function Home() {
  redirect(`/${DEFAULT_LANG}`);
}
