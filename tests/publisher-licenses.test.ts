import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

type One = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T>;

let pub: typeof import('../lib/publisher');
let one: One;
let owner = 0;
let manager = 0;
let outsider = 0;
let publisherId = 0;
let workId = 0;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-licenses-'));
  const db = await import('../lib/db');
  one = db.one as One;
  pub = await import('../lib/publisher');
  await db.initSchema();

  owner = (await one<{ id: number }>(
    "INSERT INTO users (email, display_name, role) VALUES ('lic-owner@test','Owner','reader') RETURNING id",
  )).id;
  manager = (await one<{ id: number }>(
    "INSERT INTO users (email, display_name, role) VALUES ('lic-manager@test','Manager','reader') RETURNING id",
  )).id;
  outsider = (await one<{ id: number }>(
    "INSERT INTO users (email, display_name, role) VALUES ('lic-out@test','Out','reader') RETURNING id",
  )).id;

  publisherId = (await one<{ id: number }>(
    `INSERT INTO publishers (name, slug, contact_email) VALUES ('Izdavac','izdavac','p@test') RETURNING id`,
  )).id;

  await one(
    'INSERT INTO publisher_members (publisher_id, user_id, role) VALUES ($1,$2,$3)',
    [publisherId, owner, 'owner'],
  );

  workId = (await one<{ id: number }>(
    `INSERT INTO works (slug, author_id, original_language, status, title, description, publisher_id)
     VALUES ('lic-work', $1, 'sr', 'published', 'Knjiga', '', $2) RETURNING id`,
    [owner, publisherId],
  )).id;
});

describe('права сотрудников издательства', () => {
  it('сотрудников ведёт только владелец', () => {
    expect(pub.canManageStaff('owner')).toBe(true);
    expect(pub.canManageStaff('manager')).toBe(false);
    expect(pub.canManageStaff('member')).toBe(false);
    expect(pub.canManageStaff(null)).toBe(false);
  });

  it('лицензии правят владелец и менеджер', () => {
    expect(pub.canEditLicenses('owner')).toBe(true);
    expect(pub.canEditLicenses('manager')).toBe(true);
    expect(pub.canEditLicenses('member')).toBe(false);
  });

  it('добавляет сотрудника по email', async () => {
    const res = await pub.addMember(publisherId, 'lic-manager@test', 'manager');
    expect(res).toEqual({ ok: true });
    expect(await pub.memberRoleFor(manager, publisherId)).toBe('manager');
  });

  it('несуществующий email не добавляется', async () => {
    expect(await pub.addMember(publisherId, 'nobody@test', 'member')).toEqual({ ok: false, reason: 'user_not_found' });
  });

  it('нельзя оставить издательство без владельца', async () => {
    expect(await pub.setMemberRole(publisherId, owner, 'member')).toEqual({ ok: false, reason: 'last_owner' });
    expect(await pub.removeMember(publisherId, owner)).toEqual({ ok: false, reason: 'last_owner' });
  });

  it('смена роли и удаление менеджера работают', async () => {
    expect(await pub.setMemberRole(publisherId, manager, 'member')).toEqual({ ok: true });
    expect(await pub.removeMember(publisherId, manager)).toEqual({ ok: true });
    expect(await pub.memberRoleFor(manager, publisherId)).toBeNull();
  });
});

describe('лицензия: территория и срок', () => {
  const base = {
    territory: 'RS', starts_at: null, ends_at: null,
    rights_sale: 1, rights_subscription: 0, rights_library: 0,
    tts_allowed: 0, translit_allowed: 0, export_policy: 'disallowed',
  };

  it('без лицензии ничего не разрешено', () => {
    expect(pub.licenseAllows(null, { territory: 'RS', right: 'sale' })).toBe(false);
  });

  it('продажа разрешена только там, где включена', () => {
    expect(pub.licenseAllows(base, { territory: 'RS', right: 'sale' })).toBe(true);
    expect(pub.licenseAllows(base, { territory: 'RS', right: 'subscription' })).toBe(false);
  });

  it('чужая территория закрывает доступ', () => {
    expect(pub.licenseAllows(base, { territory: 'ME', right: 'sale' })).toBe(false);
    expect(pub.licenseAllows({ ...base, territory: 'RS,ME' }, { territory: 'ME', right: 'sale' })).toBe(true);
  });

  it('WW означает весь мир', () => {
    expect(pub.licenseAllows({ ...base, territory: 'WW' }, { territory: 'DE', right: 'sale' })).toBe(true);
  });

  it('срок действия соблюдается', () => {
    const now = new Date('2026-11-19T12:00:00Z');
    const future = { ...base, starts_at: '2026-12-01T00:00:00Z' };
    const past = { ...base, ends_at: '2026-10-01T00:00:00Z' };
    expect(pub.licenseAllows(future, { territory: 'RS', right: 'sale', now })).toBe(false);
    expect(pub.licenseAllows(past, { territory: 'RS', right: 'sale', now })).toBe(false);
    expect(pub.licenseAllows({ ...base, ends_at: '2027-01-01T00:00:00Z' }, { territory: 'RS', right: 'sale', now })).toBe(true);
  });

  it('экспорт зависит от политики', () => {
    expect(pub.licenseAllows(base, { territory: 'RS', right: 'export' })).toBe(false);
    expect(pub.licenseAllows({ ...base, export_policy: 'watermark' }, { territory: 'RS', right: 'export' })).toBe(true);
  });
});

describe('лицензия: сохранение', () => {
  it('сохраняет и читает лицензию привязанного произведения', async () => {
    const ok = await pub.upsertLicense(workId, publisherId, {
      territory: 'RS,ME', rights_sale: true, tts_allowed: true, export_policy: 'watermark',
    });
    expect(ok).toBe(true);

    const lic = await pub.getLicense(workId, publisherId);
    expect(lic?.territory).toBe('RS,ME');
    expect(Number(lic?.tts_allowed)).toBe(1);
    expect(lic?.export_policy).toBe('watermark');
  });

  it('нельзя сохранить лицензию на чужое произведение', async () => {
    const other = (await one<{ id: number }>(
      `INSERT INTO works (slug, author_id, original_language, status, title, description)
       VALUES ('lic-other', $1, 'sr', 'published', 'Druga', '') RETURNING id`,
      [outsider],
    )).id;
    expect(await pub.upsertLicense(other, publisherId, { territory: 'RS' })).toBe(false);
  });

  it('неизвестная политика экспорта сбрасывается в disallowed', async () => {
    await pub.upsertLicense(workId, publisherId, { territory: 'RS', export_policy: 'hacked' });
    const lic = await pub.getLicense(workId, publisherId);
    expect(lic?.export_policy).toBe('disallowed');
  });
});
