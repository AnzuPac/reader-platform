import { beforeAll, describe, expect, it } from 'vitest';
import { initSchema, query } from '../lib/db';
import { ageBucket, getAuthorStats } from '../lib/author-stats';

describe('статистика автора', () => {
  let authorId = 0;

  beforeAll(async () => {
    await initSchema();
    const a = await query<{ id: number }>(
      "INSERT INTO users (email, display_name, role) VALUES ($1,$2,'author') RETURNING id",
      [`st-author-${Date.now()}@test`, 'Autor Stats']
    );
    authorId = a[0].id;
    const w = await query<{ id: number }>(
      "INSERT INTO works (slug, author_id, original_language, status, title, description) VALUES ($1,$2,'sr','published','Statistika','') RETURNING id",
      [`st-work-${Date.now()}`, authorId]
    );
    const workId = w[0].id;
    const c1 = await query<{ id: number }>("INSERT INTO chapters (work_id, number, title, content, word_count, access, status) VALUES ($1,1,'A','a',1,'free','published') RETURNING id", [workId]);
    const c2 = await query<{ id: number }>("INSERT INTO chapters (work_id, number, title, content, word_count, access, status) VALUES ($1,2,'B','b',1,'free','published') RETURNING id", [workId]);

    const u1 = await query<{ id: number }>(
      "INSERT INTO users (email, display_name, role, gender, birth_date, region) VALUES ($1,'Citalac M','reader','m','1998-05-10','RS') RETURNING id",
      [`st-r1-${Date.now()}@test`]
    );
    const u2 = await query<{ id: number }>(
      "INSERT INTO users (email, display_name, role, gender, birth_date, region) VALUES ($1,'Citalac F','reader','f','2012-03-01','RU') RETURNING id",
      [`st-r2-${Date.now()}@test`]
    );
    const u3 = await query<{ id: number }>(
      "INSERT INTO users (email, display_name, role) VALUES ($1,'Anon','reader') RETURNING id",
      [`st-r3-${Date.now()}@test`]
    );

    await query('INSERT INTO reading_progress (user_id, work_id, chapter_id, percent) VALUES ($1,$2,$3,80)', [u1[0].id, workId, c2[0].id]);
    await query('INSERT INTO reading_progress (user_id, work_id, chapter_id, percent) VALUES ($1,$2,$3,40)', [u2[0].id, workId, c1[0].id]);
    await query('INSERT INTO reading_progress (user_id, work_id, chapter_id, percent) VALUES ($1,$2,$3,10)', [u3[0].id, workId, c1[0].id]);

    await query("INSERT INTO plans (code, name, price_cents, currency, period, storage_bytes, no_ads, early_access, active) VALUES ('st-plan','Test',100,'RSD','month',1,1,0,1) ON CONFLICT (code) DO NOTHING");
    await query("INSERT INTO subscriptions (user_id, plan_code, status, current_period_end) VALUES ($1,'st-plan','active','2099-01-01')", [u1[0].id]);
    await query('INSERT INTO bookmarks (user_id, chapter_id) VALUES ($1,$2)', [u2[0].id, c1[0].id]);
    await query("INSERT INTO purchases (user_id, work_id, chapter_id, amount_cents, status) VALUES ($1,$2,$3,500,'paid')", [u1[0].id, workId, c2[0].id]);
  });

  it('считает возрастные корзины', () => {
    expect(ageBucket('2012-03-01', new Date('2026-11-17'))).toBe('<18');
    expect(ageBucket('1998-05-10', new Date('2026-11-17'))).toBe('25-34');
    expect(ageBucket(null)).toBe('не указан');
    expect(ageBucket('не дата')).toBe('не указан');
  });

  it('сводит читателей, пол, возраст, географию и продажи', async () => {
    const st = await getAuthorStats(authorId, new Date('2026-11-17'));
    expect(st.works.length).toBe(1);
    const w = st.works[0];
    expect(w.readers).toBe(3);
    expect(w.gender).toEqual({ m: 1, f: 1, other: 0, unknown: 1 });
    expect(w.age['25-34']).toBe(1);
    expect(w.age['<18']).toBe(1);
    expect(w.age['не указан']).toBe(1);
    expect(w.region.RS).toBe(1);
    expect(w.region.RU).toBe(1);
    expect(w.furthestChapter).toBe(2);
    expect(w.bookmarks).toBe(1);
    expect(w.subscribers).toBe(1);
    expect(w.purchases).toBe(1);
    expect(w.purchasesSum).toBe(500);
    expect(st.totals.readers).toBe(3);
  });
});
