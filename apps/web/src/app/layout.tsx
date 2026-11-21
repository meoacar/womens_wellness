import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { AppProvider } from '@/components/AppContext';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { DownloadModal } from '@/components/DownloadModal';
import { publicApi, type Locale, type SiteSummary } from '@/lib/api';
import { SITE_URL, getRouteMeta } from '@/lib/i18n';
import { buildSeoMetadata, buildSiteJsonLd } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale: Locale = cookieStore.get('web_locale')?.value === 'en' ? 'en' : 'tr';
  const meta = getRouteMeta('/', locale);
  return {
    metadataBase: new URL(SITE_URL),
    ...buildSeoMetadata({
      title: meta.title,
      description: meta.description,
      canonical: meta.canonical,
      locale,
    }),
    icons: {
      icon: '/images/mascots/2.png',
      apple: '/images/mascots/2.png',
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('web_locale')?.value;
  const initialLocale: Locale = cookieLocale === 'en' ? 'en' : 'tr';

  let summary: SiteSummary | null = null;
  try {
    summary = await publicApi.getSiteSummary();
  } catch {
    // Graceful fallback during offline/build
  }

  return (
    <html lang={initialLocale} suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildSiteJsonLd()) }}
        />
        <AppProvider
          initialLocale={initialLocale}
          storeLinks={summary?.storeLinks}
        >
          <Navbar />
          <main>{children}</main>
          <Footer pages={summary?.pages || []} />
          <DownloadModal />
        </AppProvider>
      </body>
    </html>
  );
}
