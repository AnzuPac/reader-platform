import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { rateLimit, clientKey } from '@/lib/ratelimit';
import { applyItems, applyProgress, applySettings, logSync, touchDevice, type SyncAnnotation, type SyncBookmark, type SyncProgress, type SyncSettings } from '@/lib/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, private, max-age=0' };
const arr = (value: unknown) => (Array.isArray(value) ? value.slice(0, 500) : []);

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });

  const rl = await rateLimit(clientKey(req, 'sync-push'), 240, 60 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'too_many_requests', retryAfter: rl.retryAfter }, { status: 429, headers: NO_STORE });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'bad_payload' }, { status: 400, headers: NO_STORE });

  const deviceId = String(body.deviceId || '').slice(0, 100);
  if (deviceId) await touchDevice(session.uid, deviceId, String(body.platform || '').slice(0, 40));

  const progress = arr(body.progress) as SyncProgress[];
  const bookmarks = arr(body.bookmarks) as SyncBookmark[];
  const annotations = arr(body.annotations) as SyncAnnotation[];
  const settings = body.settings && typeof body.settings === 'object' ? body.settings as SyncSettings : null;

  const progressConflicts = await applyProgress(session.uid, progress);
  const savedSettings = await applySettings(session.uid, settings);
  const bookmarkConflicts = await applyItems('sync_bookmarks', session.uid, bookmarks);
  const annotationConflicts = await applyItems('reading_annotations', session.uid, annotations);

  await Promise.all([
    progress.length ? logSync(session.uid, deviceId, 'progress', progress.length) : null,
    bookmarks.length ? logSync(session.uid, deviceId, 'bookmarks', bookmarks.length) : null,
    annotations.length ? logSync(session.uid, deviceId, 'annotations', annotations.length) : null,
  ]);

  return NextResponse.json({
    ok: true,
    settings: savedSettings,
    conflicts: { progress: progressConflicts, bookmarks: bookmarkConflicts, annotations: annotationConflicts },
    applied: { progress: progress.length, bookmarks: bookmarks.length, annotations: annotations.length },
    serverTime: new Date().toISOString(),
  }, { headers: NO_STORE });
}
