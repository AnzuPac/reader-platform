import { NextResponse } from 'next/server';
import { initSchema, one, getMigrationFailures } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Проверка живости: база отвечает, схема на месте, миграции не падали. */
export async function GET() {
  const started = Date.now();
  try {
    await initSchema();
    const row = await one<{ n: number }>('SELECT CAST(COUNT(*) AS INTEGER) AS n FROM works');
    const failures = getMigrationFailures();
    return NextResponse.json({
      ok: failures.length === 0,
      db: 'up',
      works: row?.n ?? 0,
      // Сломанная миграция — это не «всё хорошо»: отдаём наружу, чтобы деплой это видел.
      migrations: { failed: failures.length, items: failures.slice(0, 5) },
      ms: Date.now() - started,
      version: process.env.npm_package_version || 'dev',
    }, { status: failures.length === 0 ? 200 : 503 });
  } catch (e) {
    return NextResponse.json({ ok: false, db: 'down', error: String(e).slice(0, 120) }, { status: 503 });
  }
}
