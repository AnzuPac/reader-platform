import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { getWork } from '@/lib/repo';
import { initSchema, query } from '@/lib/db';
import { buildExportHtml, escapeHtml, exportPolicy, renderPdf } from '@/lib/export';
import { clientKey, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_CHAPTERS = 200;

/**
 * GET /api/export/pdf?slug=... — PDF произведения.
 *
 * Права проверяются до генерации: владелец, админ/модератор или public domain.
 * Платное и подписное не экспортируется (антипиратская спека §1), файл не
 * кэшируется и не получает публичной ссылки.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = String(url.searchParams.get('slug') || '').trim();
  if (!slug) return NextResponse.json({ error: 'slug_required' }, { status: 400 });

  const rl = await rateLimit(clientKey(req, 'export-pdf'), 5, 10 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: 'too_many_requests', retryAfter: rl.retryAfter }, { status: 429 });
  }

  await initSchema();
  const work = await getWork(slug).catch(() => null);
  if (!work) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const session = await readSession();
  const viewer = session ? { uid: session.uid, role: session.role } : null;

  const decision = exportPolicy(
    {
      id: work.id,
      slug: work.slug,
      title: work.title,
      author_id: work.author_id,
      author_name: work.author_name,
      is_classic: work.is_classic,
    },
    viewer,
  );

  if (!decision.allowed) {
    const status = decision.reason === 'auth_required' ? 401 : 403;
    return NextResponse.json({ error: decision.reason }, { status });
  }

  const chapters = await query<{ number: number; title: string; content: string }>(
    `SELECT number, title, content FROM chapters
      WHERE work_id = $1 AND status = 'published'
      ORDER BY number LIMIT $2`,
    [work.id, MAX_CHAPTERS],
  );
  if (chapters.length === 0) return NextResponse.json({ error: 'no_chapters' }, { status: 409 });

  const html = buildExportHtml(
    chapters.map((c) => ({
      number: Number(c.number),
      title: c.title || '',
      // Текст глав хранится как HTML-подмножество; выводим как есть,
      // но заголовки экранируем внутри buildExportHtml.
      html: String(c.content || ''),
    })),
    {
      title: work.title,
      author: work.author_name,
      watermark: decision.reason === 'admin' ? `staff:${escapeHtml(session?.name || 'staff')}` : null,
    },
  );

  const pdf = await renderPdf(html);
  if (pdf.ok && session) {
    await query('INSERT INTO watermark_records (user_id, chapter_id, work_id, kind) VALUES ($1,NULL,$2,$3)',
      [session.uid, work.id, 'export']).catch(() => {});
  }
  if (!pdf.ok) {
    const status = pdf.error === 'engine_missing' ? 501 : 500;
    return NextResponse.json({ error: pdf.error }, { status });
  }

  return new Response(new Uint8Array(pdf.pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${work.slug}.pdf"`,
      'Cache-Control': 'no-store, private, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
