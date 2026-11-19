import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

type One = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T>;

let pr: typeof import('../lib/profiles');
let fol: typeof import('../lib/follows');
let one: One;
let owner = 0;
let other = 0;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-profiles-'));
  const db = await import('../lib/db');
  one = db.one as One;
  pr = await import('../lib/profiles');
  fol = await import('../lib/follows');
  await db.initSchema();

  owner = (await one<{ id: number }>(
    "INSERT INTO users (email, display_name, role) VALUES ('p-owner@test','Автор','author') RETURNING id",
  )).id;
  other = (await one<{ id: number }>(
    "INSERT INTO users (email, display_name, role) VALUES ('p-other@test','Другой','reader') RETURNING id",
  )).id;

  await one(
    `INSERT INTO works (slug, author_id, original_language, status, title, description, published_at)
     VALUES ('profile-work', $1, 'sr', 'published', 'Knjiga', '', $2)`,
    [owner, new Date().toISOString()],
  );
});

describe('профиль', () => {
  it('читается и содержит поля профиля', async () => {
    const p = await pr.getProfile(owner);
    expect(p?.name).toBe('Автор');
    expect(p).toHaveProperty('bio');
    expect(p).toHaveProperty('avatar_path');
    // Дата рождения наружу не отдаётся.
    expect(p).not.toHaveProperty('birth_date');
  });

  it('публичный профиль виден всем', async () => {
    const p = (await pr.getProfile(owner))!;
    expect(pr.canViewProfile(p, null)).toBe(true);
    expect(pr.canViewProfile(p, { uid: other, role: 'reader' })).toBe(true);
  });

  it('приватный профиль видит только владелец, админ и модератор', async () => {
    await pr.updateProfile(owner, { isPublic: false });
    const p = (await pr.getProfile(owner))!;
    expect(pr.canViewProfile(p, null)).toBe(false);
    expect(pr.canViewProfile(p, { uid: other, role: 'reader' })).toBe(false);
    expect(pr.canViewProfile(p, { uid: owner, role: 'author' })).toBe(true);
    expect(pr.canViewProfile(p, { uid: other, role: 'admin' })).toBe(true);
  });

  it('внешний URL аватара не принимается', async () => {
    expect(await pr.updateProfile(owner, { avatarPath: 'https://evil.example/x.png' })).toBe(false);
  });

  it('собственная загрузка аватара принимается', async () => {
    expect(await pr.updateProfile(owner, { avatarPath: '/uploads/avatars/1.png' })).toBe(true);
    const p = await pr.getProfile(owner);
    expect(p?.avatar_path).toBe('/uploads/avatars/1.png');
  });

  it('био сохраняется с ограничением длины', async () => {
    const long = 'а'.repeat(1200);
    await pr.updateProfile(owner, { bio: long });
    const p = await pr.getProfile(owner);
    expect((p?.bio || '').length).toBe(1000);
  });

  it('статистика профиля считает произведения, подписчиков и читателей', async () => {
    await fol.follow(other, owner);
    const stats = await pr.profileStats(owner);
    expect(stats.works).toBe(1);
    expect(stats.followers).toBe(1);
    expect(stats.readers).toBe(0);
  });

  it('опубликованные произведения отдаются списком', async () => {
    const works = await pr.listPublishedWorks(owner);
    expect(works).toHaveLength(1);
    expect(works[0].slug).toBe('profile-work');
  });
});
