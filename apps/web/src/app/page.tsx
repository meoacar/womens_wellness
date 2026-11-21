import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { HomeClient } from '@/components/HomeClient';
import { publicApi, type Locale, type PublicArticle, type PaywallConfig, type SiteSummary } from '@/lib/api';
import { getRouteMeta } from '@/lib/i18n';
import { buildSeoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale: Locale = cookieStore.get('web_locale')?.value === 'en' ? 'en' : 'tr';
  const meta = getRouteMeta('/', locale);
  return buildSeoMetadata({
    title: meta.title,
    description: meta.description,
    canonical: meta.canonical,
    locale,
  });
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('web_locale')?.value;
  const locale: Locale = cookieLocale === 'en' ? 'en' : 'tr';

  const [summaryRes, articlesRes, paywallRes] = await Promise.allSettled([
    publicApi.getSiteSummary(),
    publicApi.getArticles({ locale, limit: 3, page: 1 }),
    publicApi.getPaywallConfig(),
  ]);

  const summary: SiteSummary | null =
    summaryRes.status === 'fulfilled' ? summaryRes.value : null;
  const articles: PublicArticle[] =
    articlesRes.status === 'fulfilled' ? articlesRes.value.articles : [];
  const paywall: PaywallConfig | null =
    paywallRes.status === 'fulfilled' ? paywallRes.value : null;

  return <HomeClient summary={summary} articles={articles} paywall={paywall} />;
}
