import { readSession } from './auth';
import { getPublisher, getPublisherForUser, isPublisherMember, listPublishers } from './publisher';

export type PublisherScope =
  | { ok: true; publisherId: number; isAdmin: boolean }
  | { ok: false; status: number; error: string };

/**
 * Кто смотрит кабинет: участник своего издательства, админ — любое
 * (`?publisher=<id>`), иначе первое издательство, где он участник.
 */
export async function resolvePublisherScope(req: Request): Promise<PublisherScope> {
  const s = await readSession();
  if (!s) return { ok: false, status: 401, error: 'auth_required' };

  const url = new URL(req.url);
  const wanted = Number(url.searchParams.get('publisher')) || null;

  if (s.role === 'admin') {
    if (wanted) {
      const p = await getPublisher(wanted);
      if (!p) return { ok: false, status: 404, error: 'publisher_not_found' };
      return { ok: true, publisherId: wanted, isAdmin: true };
    }
    const mine = await getPublisherForUser(s.uid);
    if (mine) return { ok: true, publisherId: mine.id, isAdmin: true };
    const all = await listPublishers();
    if (!all.length) return { ok: false, status: 404, error: 'no_publishers' };
    return { ok: true, publisherId: all[0].id, isAdmin: true };
  }

  const mine = await getPublisherForUser(s.uid);
  if (!mine) return { ok: false, status: 403, error: 'not_publisher_member' };
  if (wanted && wanted !== mine.id && !(await isPublisherMember(s.uid, wanted))) {
    return { ok: false, status: 403, error: 'forbidden' };
  }
  return { ok: true, publisherId: wanted ?? mine.id, isAdmin: false };
}
