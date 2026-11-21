import type { MetadataRoute } from 'next';
import { publicApi } from '@/lib/api';
import { SITE_URL } from '@/lib/i18n';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/hesaplayicilar`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/kesfet`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/premium`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/iletisim`, changeFrequency: 'monthly', priority: 0.6 },
  ];

  try {
    const [firstPage, pages] = await Promise.all([
      publicApi.getArticles({ locale: 'tr', limit: 100, page: 1 }),
      publicApi.getPages(),
    ]);

    const allArticles = [...(firstPage.articles || [])];
    const totalPages = Math.min(Math.ceil((firstPage.total || allArticles.length) / 100), 10);
    if (totalPages > 1) {
      const rest = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, idx) =>
          publicApi.getArticles({ locale: 'tr', limit: 100, page: idx + 2 }),
        ),
      );
      for (const r of rest) {
        if (r.articles?.length) allArticles.push(...r.articles);
      }
    }

    const articleRoutes: MetadataRoute.Sitemap = allArticles.map((a) => ({
      url: `${SITE_URL}/kesfet/${a.id}`,
      lastModified: a.publishedAt ? new Date(a.publishedAt) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    }));

    const pageRoutes: MetadataRoute.Sitemap = (pages || []).map((p) => ({
      url: `${SITE_URL}/sayfa/${p.slug}`,
      changeFrequency: 'monthly',
      priority: 0.5,
    }));

    return [...staticRoutes, ...articleRoutes, ...pageRoutes];
  } catch {
    return staticRoutes;
  }
}
