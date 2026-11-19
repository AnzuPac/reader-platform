import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>, one: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T>, initSchema: any, runRenewalReminders: any;

beforeAll(async () => {
  process.env.SQLITE_DIR = mkdtempSync(path.join(tmpdir(), 'reader-renew-'));
  delete process.env.RESEND_API_KEY;
  const db = await import('../lib/db');
  query = db.query; one = db.one as typeof one; initSchema = db.initSchema;
  const rn = await import('../lib/renewals');
  runRenewalReminders = rn.runRenewalReminders;
  await initSchema();
});

describe('напоминания о продлении (ТЗ 4.9)', () => {
  it('без ключа письмо не отправляется и отметка не ставится', async () => {
    const uid = (await one<{ id: number }>(
      "INSERT INTO users (email, display_name, role) VALUES ('r@example.com','R','reader') RETURNING id"
    ))!.id;
    await query(
      `INSERT INTO subscriptions (user_id, plan_code, status, current_period_end)
       VALUES ($1,'month','active', date(now(), '+2 days'))`, [uid]
    );
    const res = await runRenewalReminders(3);
    expect(res.due).toBe(1);
    expect(res.skipped).toBe(1);
    expect(res.sent).toBe(0);
    const row = await one<any>('SELECT reminder_sent_at FROM subscriptions WHERE user_id = $1', [uid]);
    expect(row.reminder_sent_at).toBeNull();
  });
});
