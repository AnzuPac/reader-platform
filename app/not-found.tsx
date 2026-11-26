'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NotFound() {
  const pathname = usePathname() || '/sr';
  const seg = pathname.split('/')[1];
  const lang = seg === 'ru' || seg === 'en' ? seg : 'sr';
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-5 text-center">
      <div className="mb-3 text-6xl">🌙</div>
      <h1 className="mb-2 text-3xl font-bold">Stranica nije pronađena</h1>
      <p className="mb-6 muted">Izgleda da je ova priča odlutala u drugi svet.</p>
      <div className="flex gap-3">
        <Link href={`/${lang}`} className="btn btn-primary">Početna</Link>
        <Link href={`/${lang}/catalog`} className="btn btn-ghost">Katalog</Link>
      </div>
    </main>
  );
}
