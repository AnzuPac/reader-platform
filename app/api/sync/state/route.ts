import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { touchDevice } from '@/lib/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, private, max-age=0' };

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });

  const url = new URL(req.url);
  const deviceId = url.searchParams.get('deviceId') || '';
  if (deviceId) await touchDevice(session.uid, deviceId, url.searchParams.get('platform') || undefined);

  const [progress, settings, bookmarks, annotations, devices] = await Promise.all([
    query('SELECT work_id, chapter_id, position, percent, updated_at FROM reading_progress WHERE user_id = $1', [session.uid]),
    query('SELECT font_size, line_height, theme, font_family, content_width, version, updated_at FROM reading_settings WHERE user_id = $1', [session.uid]),
    query('SELECT client_id, chapter_id, position, note, deleted, version, updated_at FROM sync_bookmarks WHERE user_id = $1', [session.uid]),
    query('SELECT client_id, chapter_id, position, length, note, color, deleted, version, updated_at FROM reading_annotations WHERE user_id = $1', [session.uid]),
    query('SELECT id, platform, last_seen_at FROM user_devices WHERE user_id = $1 ORDER BY last_seen_at DESC', [session.uid]),
  ]);

  return NextResponse.json({
    progress, settings: settings[0] || null, bookmarks, annotations, devices,
    serverTime: new Date().toISOString(),
  }, { headers: NO_STORE });
}
