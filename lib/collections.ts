import { initSchema, one, query } from './db';

/**
 * Коллекции: системные (подборки платформы), редакционные и пользовательские.
 *
 * Права: править коллекцию может владелец; админ и модератор — любую.
 * Приватная коллекция не видна никому, кроме владельца и админов.
 */

export type CollectionKind = 'system' | 'editorial' | 'user';

export type Collection = {
  id: number;
  slug: string;
  title: string;
  description: string;
  kind: CollectionKind;
  owner_id: number | null;
  is_public: number | boolean;
  position: number;
  created_at: string;
  updated_at: string;
  items_count?: number | string;
};

export type CollectionWork = {
  id: number; slug: string; title: string; author_name: string;
  cover_path: string | null; rating_avg: string; position: number;
};

export type Viewer = { uid: number; role: string } | null;

const SLUG_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'dj', е: 'e', ж: 'z', з: 'z', и: 'i',
  ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm', н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', ћ: 'c', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'c', џ: 'dz', ш: 's',
  č: 'c', ć: 'c', ž: 'z', š: 's', đ: 'dj',
};

export function slugify(title: string): string {
  const latin = title.toLowerCase().split('').map((ch) => SLUG_MAP[ch] ?? ch).join('');
  const cleaned = latin.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return cleaned || 'kolekcija';
}

export function canEditCollection(c: Pick<Collection, 'owner_id'>, viewer: Viewer): boolean {
  if (!viewer) return false;
  if (viewer.role === 'admin' || viewer.role === 'moderator') return true;
  return c.owner_id === viewer.uid;
}

export function isPublicCollection(c: Pick<Collection, 'is_public'>): boolean {
  return c.is_public === true || c.is_public === 1;
}

function isAdmin(viewer: Viewer): boolean {
  return viewer?.role === 'admin';
}

async function ensure() {
  await initSchema();
}

/** Публичные коллекции + собственные приватные (если смотреть от лица пользователя). */
export async function listCollections(viewer: Viewer, kind?: CollectionKind): Promise<Collection[]> {
  await ensure();
  const params: unknown[] = [];
  const where: string[] = [];

  if (kind) { params.push(kind); where.push(`c.kind = $${params.length}`); }

  if (viewer) {
    params.push(viewer.uid);
    const own = `c.owner_id = $${params.length}`;
    if (isAdmin(viewer) || viewer.role === 'moderator') {
      where.push('(c.is_public = TRUE OR TRUE)');
    } else {
      where.push(`((c.is_public = TRUE) OR ${own})`);
    }
  } else {
    where.push('(c.is_public = TRUE)');
  }

  const sql = `SELECT c.*, (SELECT COUNT(*) FROM collection_items ci WHERE ci.collection_id = c.id) AS items_count
                 FROM collections c
                ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                ORDER BY CASE c.kind WHEN 'system' THEN 0 WHEN 'editorial' THEN 1 ELSE 2 END, c.position, c.id DESC`;
  return query<Collection>(sql, params);
}

export async function getCollectionBySlug(slug: string, viewer: Viewer): Promise<{ collection: Collection; items: CollectionWork[]; canEdit: boolean } | null> {
  await ensure();
  const c = await one<Collection>('SELECT * FROM collections WHERE slug = $1', [slug]);
  if (!c) return null;
  const visible = isPublicCollection(c) || canEditCollection(c, viewer);
  if (!visible) return null;

  const items = await query<CollectionWork>(
    `SELECT w.id, w.slug, w.title, u.display_name AS author_name, w.cover_path, w.rating_avg, ci.position
       FROM collection_items ci
       JOIN works w ON w.id = ci.work_id AND w.status = 'published'
       JOIN users u ON u.id = w.author_id
      WHERE ci.collection_id = $1
      ORDER BY ci.position, ci.added_at`,
    [c.id],
  );
  return { collection: c, items, canEdit: canEditCollection(c, viewer) };
}

export type CreateInput = { title: string; description?: string; isPublic?: boolean; kind?: CollectionKind };

export async function createCollection(ownerId: number, input: CreateInput): Promise<Collection> {
  await ensure();
  const title = String(input.title || '').trim().slice(0, 120);
  if (!title) throw new Error('title_required');

  const base = slugify(title);
  let slug = base;
  for (let i = 1; i <= 20; i += 1) {
    const clash = await one<{ id: number }>('SELECT id FROM collections WHERE slug = $1', [slug]);
    if (!clash) break;
    slug = `${base}-${i}`;
  }

  const rows = await query<Collection>(
    `INSERT INTO collections (slug, title, description, kind, owner_id, is_public, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [slug, title, String(input.description || '').slice(0, 500), input.kind || 'user', ownerId,
      input.isPublic !== false, new Date().toISOString()],
  );
  return rows[0];
}

export async function updateCollection(
  viewer: Viewer, id: number, patch: { title?: string; description?: string; isPublic?: boolean },
): Promise<boolean> {
  await ensure();
  const c = await one<Collection>('SELECT * FROM collections WHERE id = $1', [id]);
  if (!c || !canEditCollection(c, viewer)) return false;

  const sets: string[] = [];
  const params: unknown[] = [];
  if (typeof patch.title === 'string' && patch.title.trim()) {
    params.push(patch.title.trim().slice(0, 120));
    sets.push(`title = $${params.length}`);
  }
  if (typeof patch.description === 'string') {
    params.push(patch.description.slice(0, 500));
    sets.push(`description = $${params.length}`);
  }
  if (typeof patch.isPublic === 'boolean') {
    params.push(patch.isPublic);
    sets.push(`is_public = $${params.length}`);
  }
  if (!sets.length) return true;

  params.push(new Date().toISOString());
  sets.push(`updated_at = $${params.length}`);
  params.push(id);
  await query(`UPDATE collections SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  return true;
}

export async function deleteCollection(viewer: Viewer, id: number): Promise<boolean> {
  await ensure();
  const c = await one<Collection>('SELECT * FROM collections WHERE id = $1', [id]);
  if (!c || !canEditCollection(c, viewer)) return false;
  // Системные подборки удаляет только админ — их не должно сносить автором.
  if (c.kind === 'system' && !isAdmin(viewer)) return false;
  await query('DELETE FROM collections WHERE id = $1', [id]);
  return true;
}

export async function addWorkToCollection(viewer: Viewer, collectionId: number, workId: number): Promise<boolean> {
  await ensure();
  const c = await one<Collection>('SELECT * FROM collections WHERE id = $1', [collectionId]);
  if (!c || !canEditCollection(c, viewer)) return false;

  const exists = await one<{ id: number }>(
    'SELECT id FROM works WHERE id = $1 AND status = $2', [workId, 'published'],
  );
  if (!exists) return false;

  const next = await one<{ n: number | string }>(
    'SELECT COALESCE(MAX(position), 0) + 1 AS n FROM collection_items WHERE collection_id = $1', [collectionId],
  );
  await query(
    `INSERT INTO collection_items (collection_id, work_id, position) VALUES ($1,$2,$3)
     ON CONFLICT (collection_id, work_id) DO NOTHING`,
    [collectionId, workId, Number(next?.n ?? 1)],
  );
  await query('UPDATE collections SET updated_at = $1 WHERE id = $2', [new Date().toISOString(), collectionId]);
  return true;
}

export async function removeWorkFromCollection(viewer: Viewer, collectionId: number, workId: number): Promise<boolean> {
  await ensure();
  const c = await one<Collection>('SELECT * FROM collections WHERE id = $1', [collectionId]);
  if (!c || !canEditCollection(c, viewer)) return false;
  await query('DELETE FROM collection_items WHERE collection_id = $1 AND work_id = $2', [collectionId, workId]);
  return true;
}

/** Порядок работ задаётся массивом id; чужие id игнорируются. */
export async function reorderCollection(viewer: Viewer, collectionId: number, workIds: number[]): Promise<boolean> {
  await ensure();
  const c = await one<Collection>('SELECT * FROM collections WHERE id = $1', [collectionId]);
  if (!c || !canEditCollection(c, viewer)) return false;

  const existing = await query<{ work_id: number }>(
    'SELECT work_id FROM collection_items WHERE collection_id = $1', [collectionId],
  );
  const allowed = new Set(existing.map((r) => Number(r.work_id)));

  let position = 1;
  for (const id of workIds) {
    if (!allowed.has(id)) continue;
    await query('UPDATE collection_items SET position = $1 WHERE collection_id = $2 AND work_id = $3',
      [position, collectionId, id]);
    position += 1;
  }
  return true;
}

/** Системные подборки: создаются один раз при первом обращении. */
export async function ensureSystemCollections(): Promise<void> {
  await ensure();
  const existing = await one<{ n: number | string }>(
    "SELECT COUNT(*) AS n FROM collections WHERE kind = 'system'",
  );
  if (Number(existing?.n ?? 0) > 0) return;

  const seeds: { title: string; description: string }[] = [
    { title: 'Novo na platformi', description: 'Sveže objavljena dela — prvo poglavlje obično besplatno.' },
    { title: 'Najčitanije', description: 'Ono što čitaoci najviše otvaraju.' },
    { title: 'Klasici', description: 'Javno dobro: srpska i svetska klasika.' },
  ];
  let position = 1;
  for (const seed of seeds) {
    const slug = slugify(seed.title);
    const clash = await one<{ id: number }>('SELECT id FROM collections WHERE slug = $1', [slug]);
    if (clash) continue;
    await query(
      `INSERT INTO collections (slug, title, description, kind, owner_id, is_public, position, updated_at)
       VALUES ($1,$2,$3,'system',NULL,TRUE,$4,$5)`,
      [slug, seed.title, seed.description, position, new Date().toISOString()],
    );
    position += 1;
  }
}
