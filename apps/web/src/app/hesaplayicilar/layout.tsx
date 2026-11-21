import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import type { Locale } from '@/lib/api';
import { getRouteMeta } from '@/lib/i18n';
import { buildSeoMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale: Locale = cookieStore.get('web_locale')?.value === 'en' ? 'en' : 'tr';
  const meta = getRouteMeta('/hesaplayicilar', locale);
  return buildSeoMetadata({
    title: meta.title,
    description: meta.description,
    canonical: meta.canonical,
    locale,
  });
}

export default function CalculatorsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
