import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { PremiumClient } from '@/components/PremiumClient';
import { publicApi, type Locale, type PaywallConfig } from '@/lib/api';
import { getRouteMeta } from '@/lib/i18n';
import { buildSeoMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale: Locale = cookieStore.get('web_locale')?.value === 'en' ? 'en' : 'tr';
  const meta = getRouteMeta('/premium', locale);
  return buildSeoMetadata({
    title: meta.title,
    description: meta.description,
    canonical: meta.canonical,
    locale,
  });
}

export default async function PremiumPage() {
  let paywall: PaywallConfig | null = null;
  try {
    paywall = await publicApi.getPaywallConfig();
  } catch {
    paywall = null;
  }

  return <PremiumClient paywall={paywall} />;
}
