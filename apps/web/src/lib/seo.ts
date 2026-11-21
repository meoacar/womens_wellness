import type { Metadata } from 'next';
import type { Locale } from './api';
import { SITE_URL } from './i18n';

const DEFAULT_OG_IMAGE = `${SITE_URL}/images/mascots/2.png`;

export interface BuildSeoOptions {
  title: string;
  description: string;
  canonical: string;
  locale: Locale;
  type?: 'website' | 'article';
  image?: string;
  publishedTime?: string;
}

/**
 * Builds Next.js Metadata with canonical, OpenGraph, and Twitter cards.
 */
export function buildSeoMetadata(opts: BuildSeoOptions): Metadata {
  const ogImage = opts.image
    ? opts.image.startsWith('http')
      ? opts.image
      : `${SITE_URL}${opts.image.startsWith('/') ? '' : '/'}${opts.image}`
    : DEFAULT_OG_IMAGE;

  return {
    title: opts.title,
    description: opts.description,
    alternates: {
      canonical: opts.canonical,
    },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url: opts.canonical,
      siteName: 'Kadın Atlası',
      locale: opts.locale === 'en' ? 'en_US' : 'tr_TR',
      type: opts.type ?? 'website',
      ...(opts.publishedTime ? { publishedTime: opts.publishedTime } : {}),
      images: [
        {
          url: ogImage,
          width: 512,
          height: 512,
          alt: opts.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: opts.title,
      description: opts.description,
      images: [ogImage],
    },
  };
}

/**
 * Global Schema.org JSON-LD graph for Organization, WebSite, and MobileApplication.
 */
export function buildSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'Kadın Atlası',
        url: SITE_URL,
        logo: {
          '@type': 'ImageObject',
          url: DEFAULT_OG_IMAGE,
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: 'Kadın Atlası',
        url: SITE_URL,
        inLanguage: ['tr', 'en'],
        publisher: {
          '@id': `${SITE_URL}/#organization`,
        },
      },
      {
        '@type': 'MobileApplication',
        '@id': `${SITE_URL}/#app`,
        name: 'Kadın Atlası',
        operatingSystem: 'ANDROID, IOS',
        applicationCategory: 'HealthApplication',
        downloadUrl: `${SITE_URL}/kadinatlasi.apk`,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'TRY',
        },
      },
    ],
  };
}

/**
 * Schema.org Article JSON-LD for /kesfet/[id] pages.
 */
export function buildArticleJsonLd(opts: {
  title: string;
  description: string;
  url: string;
  publishedAt?: string;
  image?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.title,
    description: opts.description,
    mainEntityOfPage: opts.url,
    ...(opts.publishedAt ? { datePublished: opts.publishedAt } : {}),
    image: opts.image || DEFAULT_OG_IMAGE,
    author: {
      '@type': 'Organization',
      name: 'Kadın Atlası',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Kadın Atlası',
      logo: {
        '@type': 'ImageObject',
        url: DEFAULT_OG_IMAGE,
      },
    },
  };
}
