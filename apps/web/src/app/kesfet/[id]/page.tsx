import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { ArticleDetailClient } from '@/components/ArticleDetailClient';
import { publicApi, type Locale } from '@/lib/api';
import { SITE_URL } from '@/lib/i18n';
import { buildArticleJsonLd, buildSeoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const cookieStore = await cookies();
  const locale: Locale = cookieStore.get('web_locale')?.value === 'en' ? 'en' : 'tr';
  const canonical = `${SITE_URL}/kesfet/${encodeURIComponent(id)}`;
  try {
    const article = await publicApi.getArticleById(id, locale);
    const title =
      locale === 'en' && article.titleEn
        ? article.titleEn
        : article.titleTr || article.title;
    return buildSeoMetadata({
      title: `${title} — Kadın Atlası`,
      description: article.excerpt || title,
      canonical,
      locale,
      type: 'article',
      publishedTime: article.publishedAt || undefined,
    });
  } catch {
    return buildSeoMetadata({
      title: locale === 'en' ? 'Article — Kadın Atlası' : 'Makale — Kadın Atlası',
      description: 'Kadın Atlası Keşfet içerikleri.',
      canonical,
      locale,
    });
  }
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('web_locale')?.value;
  const locale: Locale = cookieLocale === 'en' ? 'en' : 'tr';

  try {
    const article = await publicApi.getArticleById(id, locale);
    const title =
      locale === 'en' && article.titleEn
        ? article.titleEn
        : article.titleTr || article.title;
    const jsonLd = buildArticleJsonLd({
      title,
      description: article.excerpt || title,
      url: `${SITE_URL}/kesfet/${encodeURIComponent(id)}`,
      publishedAt: article.publishedAt || undefined,
    });
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ArticleDetailClient article={article} />
      </>
    );
  } catch {
    notFound();
  }
}
