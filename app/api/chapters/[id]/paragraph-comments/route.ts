import { NextResponse } from 'next/server';
import { initSchema, one } from '@/lib/db';
import { readSession } from '@/lib/auth';
import {
  addParagraphComment, listParagraphComments, paragraphCommentsAllowed, setParagraphCommentHidden,
} from '@/lib/paragraph-comments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, private, max-age=0' };

type Ctx = { params: Promise<{ id: string }> };

async function chapterIdFrom(ctx: Ctx): Promise<number | null> {
  const { id } = await ctx.params;
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** GET /api/chapters/{id}/paragraph-comments — комментарии к абзацам главы. */
export async function GET(_req: Request, ctx: Ctx) {
  const chapterId = await chapterIdFrom(ctx);
  if (!chapterId) return NextResponse.json({ error: 'bad_input' }, { status: 400, headers: NO_STORE });

  await initSchema();
  const enabled = await paragraphCommentsAllowed(chapterId);
  if (!enabled) {
    return NextResponse.json({ enabled: false, comments: [], canModerate: false }, { headers: NO_STORE });
  }

  const session = await readSession();
  let canModerate = false;
  if (session) {
    const w = await one<{ author_id: number }>(
      `SELECT w.author_id FROM chapters c JOIN works w ON w.id = c.work_id WHERE c.id = $1`, [chapterId]
    );
    // author_id — BIGINT: в PostgreSQL драйвер отдаёт строку, сравниваем числа.
    canModerate = session.role === 'admin' || session.role === 'moderator' || Number(w?.author_id) === session.uid;
  }

  // Скрытые комментарии видит только тот, кто может их показать обратно
  // (автор произведения, модератор, админ) — иначе скрытие нечем отменить.
  const comments = await listParagraphComments(chapterId, { includeHidden: canModerate });
  return NextResponse.json({ enabled: true, comments, canModerate }, { headers: NO_STORE });
}

/**
 * POST /api/chapters/{id}/paragraph-comments
 * body: { paragraphIndex: number, text: string }
 */
export async function POST(req: Request, ctx: Ctx) {
  const chapterId = await chapterIdFrom(ctx);
  if (!chapterId) return NextResponse.json({ error: 'bad_input' }, { status: 400, headers: NO_STORE });

  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'auth_required' }, { status: 401, headers: NO_STORE });

  const body = await req.json().catch(() => null);
  const result = await addParagraphComment({
    chapterId,
    paragraphIndex: Number(body?.paragraphIndex),
    userId: session.uid,
    text: String(body?.text ?? ''),
  });

  if (!result.ok) {
    const status = result.error === 'disabled' ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true, id: result.id }, { headers: NO_STORE });
}

/**
 * PATCH /api/chapters/{id}/paragraph-comments
 * body: { commentId: number, hidden: boolean } — автор произведения или модератор.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const chapterId = await chapterIdFrom(ctx);
  if (!chapterId) return NextResponse.json({ error: 'bad_input' }, { status: 400, headers: NO_STORE });

  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'auth_required' }, { status: 401, headers: NO_STORE });

  const body = await req.json().catch(() => null);
  const result = await setParagraphCommentHidden({
    commentId: Number(body?.commentId),
    hidden: Boolean(body?.hidden),
    actorId: session.uid,
    actorRole: session.role,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === 'not_found' ? 404 : 403, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
