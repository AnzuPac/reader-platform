import type { MetadataRoute } from 'next';

const BASE = process.env.SITE_URL || 'http://localhost:3020';

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/sr/author', '/sr/admin'] }], sitemap: `${BASE}/sitemap.xml` };
}
