import type { MetadataRoute } from 'next';
import { query, initSchema } from '@/lib/db';

const BASE = process.env.SITE_URL || 'http://localhost:3020';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const langs = ['sr', 'en', 'ru'];
  const base: MetadataRoute.Sitemap = langs.flatMap((l) => [
    { url: `${BASE}/${l}`, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/${l}/catalog`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/${l}/subscribe`, changeFrequency: 'monthly', priority: 0.5 },
  ]);
  try {
    await initSchema();
    const works = await query<{ slug: string; updated_at: string }>(
      "SELECT slug, updated_at FROM works WHERE status = 'published'"
    );
    for (const w of works) {
      for (const l of langs) {
        base.push({ url: `${BASE}/${l}/work/${w.slug}`, lastModified: new Date(w.updated_at), changeFrequency: 'weekly', priority: 0.8 });
      }
    }
  } catch {}
  return base;
}
