import { NextResponse } from 'next/server';
import { initSchema, query } from '@/lib/db';

export async function GET() {
  await initSchema();
  const plans = await query(
    `SELECT code, name, price_cents, currency, period, storage_bytes, no_ads, early_access
       FROM plans WHERE active = 1 ORDER BY price_cents`
  );
  return NextResponse.json({ plans });
}
