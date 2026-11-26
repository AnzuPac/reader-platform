import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const LANGS = ['sr', 'ru', 'en'];

/** Прокидывает локаль в серверные компоненты: <html lang> и метаданные. */
export function middleware(req: NextRequest) {
  const seg = req.nextUrl.pathname.split('/')[1] || '';
  const locale = LANGS.includes(seg) ? seg : 'sr';
  const headers = new Headers(req.headers);
  headers.set('x-locale', locale);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ['/((?!_next|favicon.ico|icon.svg|.*\\..*).*)'] };
