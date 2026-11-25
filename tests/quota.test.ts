import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let db: any, files: any;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-quota-'));
  db = await import('../lib/db');
  await db.initSchema();
  files = await import('../lib/user-files');

  await db.query(`INSERT INTO plans (code, name, price_cents, storage_bytes, active) VALUES ('pro','Pro',1000,5000,1)`);
  await db.query(`INSERT INTO plans (code, name, price_cents, storage_bytes, active) VALUES ('small','Small',0,100,1)`);
  const u1 = (await db.query(`INSERT INTO users (email,password_hash,display_name) VALUES ('q1@test','x','Q1') RETURNING id`))[0].id;
  const u2 = (await db.query(`INSERT INTO users (email,password_hash,display_name) VALUES ('q2@test','x','Q2') RETURNING id`))[0].id;
  const u3 = (await db.query(`INSERT INTO users (email,password_hash,display_name) VALUES ('q3@test','x','Q3') RETURNING id`))[0].id;
  const future = new Date(Date.now() + 86400000).toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();
  await db.query(`INSERT INTO subscriptions (user_id, plan_code, status, current_period_end) VALUES ($1,'pro','active',$2)`, [u1, future]);
  await db.query(`INSERT INTO subscriptions (user_id, plan_code, status, current_period_end) VALUES ($1,'small','active',$2)`, [u2, past]);
  process.env.Q1 = String(u1); process.env.Q2 = String(u2); process.env.Q3 = String(u3);
});

describe('квоты личной библиотеки по тарифу', () => {
  it('активная подписка задаёт квоту из плана', async () => {
    expect(await files.quotaFor(Number(process.env.Q1))).toBe(5000);
  });
  it('истёкшая подписка не действует — общая квота', async () => {
    expect(await files.quotaFor(Number(process.env.Q2))).toBe(files.DEFAULT_QUOTA_BYTES);
  });
  it('без подписки — общая квота', async () => {
    expect(await files.quotaFor(Number(process.env.Q3))).toBe(files.DEFAULT_QUOTA_BYTES);
  });
});
