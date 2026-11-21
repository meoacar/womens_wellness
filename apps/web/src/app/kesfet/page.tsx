import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { DiscoverClient } from '@/components/DiscoverClient';
import { publicApi, type Locale, type PublicArticle } from '@/lib/api';
import { getRouteMeta } from '@/lib/i18n';
import { buildSeoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale: Locale = cookieStore.get('web_locale')?.value === 'en' ? 'en' : 'tr';
  const meta = getRouteMeta('/kesfet', locale);
  return buildSeoMetadata({
    title: meta.title,
    description: meta.description,
    canonical: meta.canonical,
    locale,
  });
}

export default async function DiscoverPage() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('web_locale')?.value;
  const locale: Locale = cookieLocale === 'en' ? 'en' : 'tr';

  let articles: PublicArticle[] = [];
  try {
    const res = await publicApi.getArticles({ locale, limit: 50, page: 1 });
    articles = res.articles || [];
  } catch {
    articles = [];
  }

  return <DiscoverClient initialArticles={articles} />;
}
