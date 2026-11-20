import { one, query } from './db';
import { isCommerciallyEligible } from './monetization-policy';

/**
 * Kabinet izdavača: членство, книги, цены, продажи, роялти, отчёты, выплаты.
 * Все суммы — целые центы; валюта всегда рядом с суммой.
 */

export type Publisher = {
  id: number;
  name: string;
  slug: string;
  contact_email: string;
  commission_pct: number;
  created_at?: string;
};

export type PublisherWorksRow = {
  id: number; slug: string; title: string; status: string; type: string;
  amount_cents: number | null; currency: string | null; active: number | null;
  sales: number; gross_cents: number; royalty_cents: number; commission_cents: number;
  rights_sale?: number; rights_subscription?: number; subscription_window_days?: number;
  regions?: string; tts_allowed?: number; free_excerpt_pct?: number;
  /** Лицензия: если заполнена, режим защиты считается по ней. */
  license_export_policy?: string | null;
  license_ends_at?: string | null;
  license_territory?: string | null;
};

export type ReportLine = {
  currency: string; sales: number; gross_cents: number;
  commission_cents: number; royalty_cents: number;
};

export type PublisherReport = {
  from: string;
  to: string;
  byCurrency: ReportLine[];
  payable: { currency: string; amount_cents: number }[];
  works: PublisherWorksRow[];
};

export async function getPublisherForUser(userId: number): Promise<(Publisher & { member_role: string }) | null> {
  return one<Publisher & { member_role: string }>(
    `SELECT p.id, p.name, p.slug, p.contact_email, p.commission_pct, p.created_at, m.role AS member_role
       FROM publisher_members m JOIN publishers p ON p.id = m.publisher_id
      WHERE m.user_id = $1
      ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, p.id
      LIMIT 1`,
    [userId]
  );
}

export async function isPublisherMember(userId: number, publisherId: number): Promise<boolean> {
  const row = await one(
    'SELECT 1 AS ok FROM publisher_members WHERE user_id = $1 AND publisher_id = $2',
    [userId, publisherId]
  );
  return !!row;
}

export async function listPublishers(): Promise<Publisher[]> {
  return query<Publisher>('SELECT id, name, slug, contact_email, commission_pct FROM publishers ORDER BY name');
}

export async function getPublisher(id: number): Promise<Publisher | null> {
  return one<Publisher>(
    'SELECT id, name, slug, contact_email, commission_pct FROM publishers WHERE id = $1', [id]
  );
}

export async function publisherWorks(publisherId: number): Promise<PublisherWorksRow[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT w.id, w.slug, w.title, w.status, w.type,
            w.rights_sale, w.rights_subscription, w.subscription_window_days, w.regions, w.tts_allowed, w.free_excerpt_pct,
            wl.export_policy AS license_export_policy, wl.ends_at AS license_ends_at, wl.territory AS license_territory,
            bp.amount_cents, bp.currency, bp.active,
            COALESCE(s.sales, 0) AS sales,
            COALESCE(s.gross, 0) AS gross_cents,
            COALESCE(r.royalty, 0) AS royalty_cents,
            COALESCE(r.commission, 0) AS commission_cents
       FROM works w
       LEFT JOIN work_licenses wl ON wl.work_id = w.id AND wl.publisher_id = w.publisher_id
       LEFT JOIN book_prices bp ON bp.work_id = w.id
       LEFT JOIN (SELECT work_id, COUNT(*) AS sales, SUM(amount_cents) AS gross
                    FROM purchases WHERE status = 'paid' GROUP BY work_id) s ON s.work_id = w.id
       LEFT JOIN (SELECT work_id, SUM(amount_cents - commission_cents) AS royalty,
                         SUM(commission_cents) AS commission
                    FROM royalty_ledger GROUP BY work_id) r ON r.work_id = w.id
      WHERE w.publisher_id = $1
      ORDER BY w.created_at DESC, w.id DESC`,
    [publisherId]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    slug: String(r.slug),
    title: String(r.title),
    status: String(r.status),
    type: String(r.type),
    amount_cents: r.amount_cents == null ? null : Number(r.amount_cents),
    currency: r.currency == null ? null : String(r.currency),
    active: r.active == null ? null : Number(r.active),
    sales: Number(r.sales),
    gross_cents: Number(r.gross_cents),
    royalty_cents: Number(r.royalty_cents),
    commission_cents: Number(r.commission_cents),
    license_export_policy: r.license_export_policy == null ? null : String(r.license_export_policy),
    license_ends_at: r.license_ends_at == null ? null : String(r.license_ends_at),
    license_territory: r.license_territory == null ? null : String(r.license_territory),
  }));
}

export async function setWorkPrice(
  publisherId: number,
  workId: number,
  price: { amount_cents: number; currency: string; active?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isInteger(price.amount_cents) || price.amount_cents < 0) {
    return { ok: false, error: 'invalid_amount' };
  }
  const currency = String(price.currency || '').toUpperCase().slice(0, 3);
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: 'invalid_currency' };

  const work = await one<{ id: number; kind: string; is_classic: boolean | number; rights_confirmed: boolean | number }>(
    'SELECT id, kind, is_classic, rights_confirmed FROM works WHERE id = $1 AND publisher_id = $2', [workId, publisherId]
  );
  if (!work) return { ok: false, error: 'not_found' };
  if (price.active !== false && price.amount_cents > 0 && !isCommerciallyEligible(work)) return { ok: false, error: 'non_commercial_work' };

  const active = price.active === false ? 0 : 1;
  await query(
    `INSERT INTO book_prices (work_id, amount_cents, currency, active)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (work_id) DO UPDATE SET amount_cents = EXCLUDED.amount_cents,
       currency = EXCLUDED.currency, active = EXCLUDED.active, updated_at = now()`,
    [workId, price.amount_cents, currency, active]
  );
  return { ok: true };
}

function dateBounds(from?: string | null, to?: string | null): { from: string; toExclusive: string; toLabel: string } {
  const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  let fromTs = '1970-01-01';
  if (from && isDate(from)) fromTs = from;

  let toLabel = '2999-12-31';
  let toExclusive = '3000-01-01';
  if (to && isDate(to)) {
    toLabel = to;
    const d = new Date(`${to}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    toExclusive = d.toISOString().slice(0, 10);
  }
  return { from: fromTs, toExclusive, toLabel };
}

export async function publisherReport(publisherId: number, from?: string | null, to?: string | null): Promise<PublisherReport> {
  const bounds = dateBounds(from, to);

  const lines = await query<Record<string, unknown>>(
    `SELECT p.currency,
            COUNT(*) AS sales,
            COALESCE(SUM(p.amount_cents), 0) AS gross_cents,
            COALESCE(SUM(r.commission_cents), 0) AS commission_cents,
            COALESCE(SUM(r.amount_cents - r.commission_cents), 0) AS royalty_cents
       FROM purchases p
       JOIN works w ON w.id = p.work_id
       LEFT JOIN royalty_ledger r ON r.purchase_id = p.id
      WHERE w.publisher_id = $1 AND p.status = 'paid'
        AND COALESCE(p.paid_at, p.created_at) >= $2
        AND COALESCE(p.paid_at, p.created_at) < $3
      GROUP BY p.currency
      ORDER BY p.currency`,
    [publisherId, bounds.from, bounds.toExclusive]
  );

  const payableRows = await query<Record<string, unknown>>(
    `SELECT p.currency, COALESCE(SUM(r.amount_cents - r.commission_cents), 0) AS amount_cents
       FROM royalty_ledger r
       JOIN purchases p ON p.id = r.purchase_id
      WHERE r.publisher_id = $1 AND r.status = 'accrued' AND p.status = 'paid'
      GROUP BY p.currency
      ORDER BY p.currency`,
    [publisherId]
  );

  return {
    from: bounds.from,
    to: bounds.toLabel,
    byCurrency: lines.map((r) => ({
      currency: String(r.currency),
      sales: Number(r.sales),
      gross_cents: Number(r.gross_cents),
      commission_cents: Number(r.commission_cents),
      royalty_cents: Number(r.royalty_cents),
    })),
    payable: payableRows.map((r) => ({
      currency: String(r.currency),
      amount_cents: Number(r.amount_cents),
    })),
    works: await publisherWorks(publisherId),
  };
}

export async function listPayouts(publisherId: number) {
  return query<{ id: number; amount_cents: number; status: string; created_at: string; paid_at: string | null }>(
    'SELECT id, amount_cents, status, created_at, paid_at FROM payouts WHERE publisher_id = $1 ORDER BY id DESC',
    [publisherId]
  );
}

export async function createPayout(publisherId: number, amountCents: number) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return { ok: false as const, error: 'invalid_amount' };
  const rows = await query<{ id: number }>(
    "INSERT INTO payouts (publisher_id, amount_cents, status) VALUES ($1,$2,'pending') RETURNING id",
    [publisherId, amountCents]
  );
  return { ok: true as const, id: rows[0].id };
}

/** Помечает выплату проведённой: роялти периода переходят в статус 'paid'. */
export async function markPayoutPaid(publisherId: number, payoutId: number) {
  const payout = await one<{ id: number; amount_cents: number; status: string }>(
    'SELECT id, amount_cents, status FROM payouts WHERE id = $1 AND publisher_id = $2', [payoutId, publisherId]
  );
  if (!payout) return { ok: false as const, error: 'not_found' };
  if (payout.status === 'paid') return { ok: true as const, already: true };

  await query("UPDATE payouts SET status = 'paid', paid_at = now() WHERE id = $1", [payoutId]);

  // Закрываем ровно начисленные роялти в пределах суммы выплаты (FIFO по id).
  const ledger = await query<{ id: number; share: number }>(
    `SELECT r.id, (r.amount_cents - r.commission_cents) AS share
       FROM royalty_ledger r JOIN purchases p ON p.id = r.purchase_id
      WHERE r.publisher_id = $1 AND r.status = 'accrued' AND p.status = 'paid'
      ORDER BY r.id`,
    [publisherId]
  );
  let budget = payout.amount_cents;
  for (const row of ledger) {
    const share = Number(row.share);
    if (share > budget) break;
    await query("UPDATE royalty_ledger SET status = 'paid' WHERE id = $1", [row.id]);
    budget -= share;
  }
  return { ok: true as const, already: false };
}

/* ------------------------------------------------------------------
   Роли сотрудников, лицензии и территории (мастер-промпт §5).
   ------------------------------------------------------------------ */

export type MemberRole = 'owner' | 'manager' | 'member';
export const MEMBER_ROLES: MemberRole[] = ['owner', 'manager', 'member'];

export function isMemberRole(v: unknown): v is MemberRole {
  return typeof v === 'string' && (MEMBER_ROLES as string[]).includes(v);
}

/** Кто управляет сотрудниками: только владелец издательства. */
export function canManageStaff(role: string | null | undefined): boolean {
  return role === 'owner';
}

/** Кто правит лицензии, цены и права: владелец и менеджер. */
export function canEditLicenses(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'manager';
}

export type PublisherMember = {
  user_id: number;
  display_name: string;
  email: string;
  role: MemberRole;
  created_at: string;
};

export async function listMembers(publisherId: number): Promise<PublisherMember[]> {
  return query<PublisherMember>(
    `SELECT m.user_id, u.display_name, u.email, m.role, m.created_at
       FROM publisher_members m JOIN users u ON u.id = m.user_id
      WHERE m.publisher_id = $1
      ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, m.created_at`,
    [publisherId],
  );
}

export type MemberResult =
  | { ok: true }
  | { ok: false; reason: 'bad_role' | 'user_not_found' | 'last_owner' | 'not_member' };

export async function addMember(publisherId: number, email: string, role: MemberRole): Promise<MemberResult> {
  if (!isMemberRole(role)) return { ok: false, reason: 'bad_role' };
  const user = await one<{ id: number }>('SELECT id FROM users WHERE email = $1', [String(email).trim().toLowerCase()]);
  if (!user) return { ok: false, reason: 'user_not_found' };

  await query(
    `INSERT INTO publisher_members (publisher_id, user_id, role) VALUES ($1,$2,$3)
     ON CONFLICT (publisher_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [publisherId, user.id, role],
  );
  return { ok: true };
}

async function ownerCount(publisherId: number): Promise<number> {
  const row = await one<{ n: number | string }>(
    "SELECT COUNT(*) AS n FROM publisher_members WHERE publisher_id = $1 AND role = 'owner'", [publisherId],
  );
  return Number(row?.n ?? 0);
}

export async function setMemberRole(publisherId: number, userId: number, role: MemberRole): Promise<MemberResult> {
  if (!isMemberRole(role)) return { ok: false, reason: 'bad_role' };
  const current = await one<{ role: string }>(
    'SELECT role FROM publisher_members WHERE publisher_id = $1 AND user_id = $2', [publisherId, userId],
  );
  if (!current) return { ok: false, reason: 'not_member' };
  // Нельзя оставить издательство без владельца.
  if (current.role === 'owner' && role !== 'owner' && (await ownerCount(publisherId)) <= 1) {
    return { ok: false, reason: 'last_owner' };
  }
  await query('UPDATE publisher_members SET role = $3 WHERE publisher_id = $1 AND user_id = $2',
    [publisherId, userId, role]);
  return { ok: true };
}

export async function removeMember(publisherId: number, userId: number): Promise<MemberResult> {
  const current = await one<{ role: string }>(
    'SELECT role FROM publisher_members WHERE publisher_id = $1 AND user_id = $2', [publisherId, userId],
  );
  if (!current) return { ok: false, reason: 'not_member' };
  if (current.role === 'owner' && (await ownerCount(publisherId)) <= 1) {
    return { ok: false, reason: 'last_owner' };
  }
  await query('DELETE FROM publisher_members WHERE publisher_id = $1 AND user_id = $2', [publisherId, userId]);
  return { ok: true };
}

export type WorkLicense = {
  work_id: number;
  publisher_id: number;
  territory: string;
  starts_at: string | null;
  ends_at: string | null;
  rights_sale: number | boolean;
  rights_subscription: number | boolean;
  rights_library: number | boolean;
  tts_allowed: number | boolean;
  translit_allowed: number | boolean;
  export_policy: 'disallowed' | 'watermark' | 'original' | string;
  updated_at: string;
};

export const EXPORT_POLICIES = ['disallowed', 'watermark', 'original'] as const;

function flag(v: unknown): boolean {
  return v === true || v === 1 || v === '1';
}

export type LicenseRight = 'sale' | 'subscription' | 'library' | 'tts' | 'translit' | 'export';

/**
 * Действует ли лицензия сейчас и в этой территории.
 * Территория: 'WW' или '*' — весь мир; иначе список кодов через запятую.
 */
export function licenseAllows(
  license: Pick<WorkLicense, 'territory' | 'starts_at' | 'ends_at' | 'rights_sale' | 'rights_subscription'
    | 'rights_library' | 'tts_allowed' | 'translit_allowed' | 'export_policy'> | null,
  opts: { territory: string; now?: Date; right: LicenseRight },
): boolean {
  if (!license) return false;
  const now = opts.now ?? new Date();
  const nowMs = now.getTime();

  if (license.starts_at) {
    const start = new Date(String(license.starts_at)).getTime();
    if (Number.isFinite(start) && nowMs < start) return false;
  }
  if (license.ends_at) {
    const end = new Date(String(license.ends_at)).getTime();
    if (Number.isFinite(end) && nowMs > end) return false;
  }

  const terr = String(license.territory || '').trim().toUpperCase();
  const want = String(opts.territory || '').trim().toUpperCase();
  const global = terr === '' || terr === 'WW' || terr === '*';
  const allowed = global || terr.split(',').map((t) => t.trim()).includes(want);
  if (!allowed) return false;

  switch (opts.right) {
    case 'sale': return flag(license.rights_sale);
    case 'subscription': return flag(license.rights_subscription);
    case 'library': return flag(license.rights_library);
    case 'tts': return flag(license.tts_allowed);
    case 'translit': return flag(license.translit_allowed);
    case 'export': return license.export_policy !== 'disallowed';
    default: return false;
  }
}

export async function getLicense(workId: number, publisherId: number): Promise<WorkLicense | null> {
  return one<WorkLicense>(
    'SELECT * FROM work_licenses WHERE work_id = $1 AND publisher_id = $2', [workId, publisherId],
  );
}

export type LicensePatch = Partial<Pick<WorkLicense,
  'territory' | 'starts_at' | 'ends_at' | 'rights_sale' | 'rights_subscription'
  | 'rights_library' | 'tts_allowed' | 'translit_allowed' | 'export_policy'>>;

export async function upsertLicense(workId: number, publisherId: number, patch: LicensePatch): Promise<boolean> {
  const work = await one<{ id: number }>('SELECT id FROM works WHERE id = $1 AND publisher_id = $2', [workId, publisherId]);
  if (!work) return false;

  const territory = String(patch.territory || 'RS').trim().toUpperCase().slice(0, 60);
  const exportPolicy = EXPORT_POLICIES.includes((patch.export_policy || 'disallowed') as 'disallowed')
    ? String(patch.export_policy)
    : 'disallowed';

  await query(
    `INSERT INTO work_licenses
       (work_id, publisher_id, territory, starts_at, ends_at, rights_sale, rights_subscription,
        rights_library, tts_allowed, translit_allowed, export_policy, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (work_id, publisher_id) DO UPDATE SET
       territory = EXCLUDED.territory, starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at,
       rights_sale = EXCLUDED.rights_sale, rights_subscription = EXCLUDED.rights_subscription,
       rights_library = EXCLUDED.rights_library, tts_allowed = EXCLUDED.tts_allowed,
       translit_allowed = EXCLUDED.translit_allowed, export_policy = EXCLUDED.export_policy,
       updated_at = EXCLUDED.updated_at`,
    [
      workId, publisherId, territory,
      patch.starts_at || null, patch.ends_at || null,
      flag(patch.rights_sale),
      flag(patch.rights_subscription),
      flag(patch.rights_library),
      flag(patch.tts_allowed),
      flag(patch.translit_allowed),
      exportPolicy, new Date().toISOString(),
    ],
  );
  return true;
}

/** Роль пользователя внутри конкретного издательства (или null). */
export async function memberRoleFor(userId: number, publisherId: number): Promise<MemberRole | null> {
  const row = await one<{ role: string }>(
    'SELECT role FROM publisher_members WHERE user_id = $1 AND publisher_id = $2', [userId, publisherId],
  );
  return isMemberRole(row?.role) ? row!.role : null;
}
