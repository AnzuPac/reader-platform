import { randomUUID } from 'node:crypto';
import { query } from './db';

export type Annotation = {
  client_id: string; chapter_id: number; position: number; length: number;
  note: string | null; color: string | null; version: number; updated_at: string;
};

const MAX_NOTE = 2000;
const MAX_LENGTH = 5000;

export async function listAnnotations(userId: number, chapterId: number): Promise<Annotation[]> {
  return query<Annotation>(
    `SELECT client_id, chapter_id, position, length, note, color, version, updated_at
       FROM reading_annotations
      WHERE user_id = $1 AND chapter_id = $2 AND deleted = 0
      ORDER BY position ASC`,
    [userId, chapterId],
  );
}

export async function createAnnotation(
  userId: number, chapterId: number,
  input: { position: number; length: number; note?: string | null; color?: string | null },
): Promise<Annotation> {
  const position = Math.max(0, Math.trunc(Number(input.position) || 0));
  const length = Math.min(MAX_LENGTH, Math.max(1, Math.trunc(Number(input.length) || 0)));
  const note = input.note ? String(input.note).slice(0, MAX_NOTE) : null;
  const color = input.color ? String(input.color).slice(0, 20) : null;
  const now = new Date().toISOString();
  const rows = await query<Annotation>(
    `INSERT INTO reading_annotations (client_id, user_id, chapter_id, position, length, note, color, deleted, version, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,0,1,$8)
     RETURNING client_id, chapter_id, position, length, note, color, version, updated_at`,
    [randomUUID(), userId, chapterId, position, length, note, color, now],
  );
  return rows[0];
}

export async function deleteAnnotation(userId: number, clientId: string): Promise<boolean> {
  const rows = await query<{ client_id: string }>(
    `UPDATE reading_annotations SET deleted = 1, version = version + 1, updated_at = $3
      WHERE user_id = $1 AND client_id = $2 RETURNING client_id`,
    [userId, clientId, new Date().toISOString()],
  );
  return rows.length > 0;
}
