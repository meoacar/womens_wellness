export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://api.kadinatlasi.com'
    : 'http://localhost:4000');

function getRequestBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.INTERNAL_API_BASE_URL || API_BASE_URL;
  }
  return API_BASE_URL;
}

export type Locale = 'tr' | 'en';

export interface SiteSummary {
  brand: string;
  activeArticlesCount: number;
  totalBadgesCount: number;
  pages: Array<{
    slug: string;
    titleTr: string;
    titleEn?: string | null;
    sortOrder: number;
  }>;
  storeLinks: {
    ios: string;
    android: string;
  };
}

export interface PublicArticle {
  id: string;
  title: string;
  titleTr: string;
  titleEn?: string;
  excerpt: string;
  category: string;
  tags: string[];
  imageUrl?: string;
  thumbnailUrl?: string;
  readTimeMin: number;
  publishedAt: string;
  updatedAt?: string;
  content?: string;
  contentTr?: string;
  contentEn?: string;
  author?: string;
  relatedArticles?: PublicArticle[];
}

export interface PaginatedPublicArticles {
  articles: PublicArticle[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface PaywallPlan {
  tier: 'MONTHLY' | 'YEARLY';
  title: string;
  subtitle?: string;
  badge?: string;
  badgeText?: string;
  savingsText?: string;
  price: number;
  currency: string;
  currencySymbol?: string;
  trialDays: number;
  iosProductId: string;
  androidProductId: string;
  isActive: boolean;
  features: string[];
}

export interface PaywallConfig {
  heroBadge?: string;
  heroTitle: string;
  heroSubtitle: string;
  trialEnabled: boolean;
  premiumAiMessageLimit?: number;
  freeAiMessageLimit?: number;
  features?: Array<{
    icon: string;
    title: string;
    description: string;
    freeLabel?: string;
    premiumLabel?: string;
  }>;
  comparisonRows?: Array<{
    id: string;
    icon?: string;
    color?: string;
    title: string;
    freeValue: string | boolean;
    premiumValue: string | boolean;
    isActive?: boolean;
  }>;
  plans: {
    MONTHLY: PaywallPlan;
    YEARLY: PaywallPlan;
  };
  faq?: Array<{
    question: string;
    answer: string;
  }>;
}

export interface CmsPage {
  id: string;
  slug: string;
  titleTr: string;
  titleEn?: string | null;
  contentTr: string;
  contentEn?: string | null;
  isActive: boolean;
  updatedAt: string;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getRequestBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
    cache: init?.cache ?? 'no-store',
  });

  if (!res.ok) {
    let msg = `API error (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody?.message) {
        msg = Array.isArray(errBody.message) ? errBody.message.join(', ') : errBody.message;
      }
    } catch {
      // Ignore parse error
    }
    throw new Error(msg);
  }

  return res.json() as Promise<T>;
}

export const publicApi = {
  getSiteSummary: () => fetchJson<SiteSummary>('/public/site-summary'),

  getArticles: (params: {
    locale?: Locale;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params.locale) query.set('locale', params.locale);
    if (params.category) query.set('category', params.category);
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    return fetchJson<PaginatedPublicArticles>(`/discover/public/articles?${query.toString()}`);
  },

  getArticleById: (id: string, locale: Locale = 'tr') =>
    fetchJson<PublicArticle>(`/discover/public/articles/${id}?locale=${locale}`),

  getPaywallConfig: () => fetchJson<PaywallConfig>('/subscription/public/paywall-config'),

  getPages: () => fetchJson<CmsPage[]>('/pages?isActive=true'),

  getPageBySlug: (slug: string) => fetchJson<CmsPage>(`/pages/slug/${encodeURIComponent(slug)}`),

  calculateCycle: (body: { lastPeriodDate: string; cycleLength: number; periodLength: number }) =>
    fetchJson<any>('/metrics/public/cycle', { method: 'POST', body: JSON.stringify(body) }),

  calculatePregnancy: (body: { lmpDate?: string; dueDate?: string }) =>
    fetchJson<any>('/metrics/public/pregnancy', { method: 'POST', body: JSON.stringify(body) }),

  calculateWater: (body: {
    weightKg: number;
    activity: 'sedentary' | 'moderate' | 'active';
    climate: 'cool' | 'temperate' | 'hot';
  }) => fetchJson<any>('/metrics/public/water', { method: 'POST', body: JSON.stringify(body) }),

  calculateBMI: (body: { weightKg: number; heightCm: number }) =>
    fetchJson<any>('/metrics/public/bmi', { method: 'POST', body: JSON.stringify(body) }),

  calculateBMR: (body: {
    weightKg: number;
    heightCm: number;
    ageYears: number;
    sex: 'female' | 'male';
    activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  }) => fetchJson<any>('/metrics/public/bmr', { method: 'POST', body: JSON.stringify(body) }),

  submitContact: (body: {
    name: string;
    email: string;
    category: string;
    subject: string;
    message: string;
  }) => fetchJson<{ success: boolean; id: string }>('/support/public/contact', {
    method: 'POST',
    body: JSON.stringify(body),
  }),
};
