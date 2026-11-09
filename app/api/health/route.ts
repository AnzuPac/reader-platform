import { NextResponse } from 'next/server';
import { initSchema, one } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Проверка живости: база отвечает, схема на месте. */
export async function GET() {
  const started = Date.now();
  try {
    await initSchema();
    const row = await one<{ n: number }>('SELECT CAST(COUNT(*) AS INTEGER) AS n FROM works');
    return NextResponse.json({
      ok: true,
      db: 'up',
      works: row?.n ?? 0,
      ms: Date.now() - started,
      version: process.env.npm_package_version || 'dev',
    });
  } catch (e) {
    return NextResponse.json({ ok: false, db: 'down', error: String(e).slice(0, 120) }, { status: 503 });
  }
}
