import { NextResponse } from 'next/server';
import { initSchema } from '@/lib/db';
import { resolvePublisherScope } from '@/lib/publisher-guard';
import { getPublisher, publisherWorks } from '@/lib/publisher';

export const dynamic = 'force-dynamic';

/** GET /api/publisher/works — книги издательства с ценами и продажами. */
export async function GET(req: Request) {
  const scope = await resolvePublisherScope(req);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  await initSchema();
  const publisher = await getPublisher(scope.publisherId);
  const works = await publisherWorks(scope.publisherId);
  return NextResponse.json({ publisher, works });
}
