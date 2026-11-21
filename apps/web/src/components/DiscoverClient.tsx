'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, BookOpen, Clock, Sparkles } from 'lucide-react';
import { publicApi, type PublicArticle } from '@/lib/api';
import { useAppContext } from './AppContext';
import { CATEGORY_LABELS } from '@/lib/i18n';

export function DiscoverClient({ initialArticles }: { initialArticles: PublicArticle[] }) {
  const { locale, t } = useAppContext();
  const [articles, setArticles] = useState<PublicArticle[]>(initialArticles);
  const [allArticles, setAllArticles] = useState<PublicArticle[]>(initialArticles);
  const [category, setCategory] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = { ALL: allArticles.length };
    for (const art of allArticles) {
      counts[art.category] = (counts[art.category] || 0) + 1;
    }
    return counts;
  }, [allArticles]);

  const categories = React.useMemo(
    () =>
      Object.keys(CATEGORY_LABELS[locale]).filter(
        (key) => key === 'ALL' || (categoryCounts[key] || 0) > 0,
      ),
    [locale, categoryCounts],
  );

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await publicApi.getArticles({
          locale,
          category: category === 'ALL' ? undefined : category,
          search: search.trim() || undefined,
          limit: 50,
        });
        if (active) {
          const list = res.articles || [];
          setArticles(list);
          if (category === 'ALL' && !search.trim()) {
            setAllArticles(list);
          }
        }
      } catch {
        // Keep existing list on transient error
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [locale, category, search]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF0F5] px-3.5 py-1 text-xs font-bold text-[#E91E63] dark:bg-[#2a1936] dark:text-[#FF69B4]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {t.discover.badge}
        </span>
        <h1 className="mt-3 text-3xl font-extrabold text-[var(--text-main)] sm:text-4xl">
          {t.discover.title}
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-[var(--text-muted)] sm:text-base">
          {t.discover.subtitle}
        </p>
      </div>

      {/* Search & Categories */}
      <div className="mt-8 space-y-4">
        <div className="relative mx-auto max-w-xl">
          <label htmlFor="discover-search" className="sr-only">
            {t.discover.searchPlaceholder}
          </label>
          <Search
            className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <input
            id="discover-search"
            name="search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.discover.searchPlaceholder}
            aria-label={t.discover.searchPlaceholder}
            className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] py-3 pl-11 pr-4 text-sm text-[var(--text-main)] outline-none focus:border-[#FF69B4]"
          />
        </div>

        <div
          role="group"
          aria-label={locale === 'tr' ? 'Makale kategorileri' : 'Article categories'}
          className="flex flex-wrap justify-center gap-2"
        >
          {categories.map((catKey) => {
            const active = category === catKey;
            return (
              <button
                key={catKey}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(catKey)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  active
                    ? 'bg-gradient-to-r from-[#FF69B4] to-[#D946EF] text-white'
                    : 'border border-[var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-[#FF69B4]'
                }`}
              >
                {CATEGORY_LABELS[locale][catKey]} ({categoryCounts[catKey] || 0})
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {loading && articles.length === 0 ? (
        <div className="py-16 text-center text-sm text-[var(--text-muted)]">
          {locale === 'tr' ? 'Makaleler yükleniyor...' : 'Loading articles...'}
        </div>
      ) : articles.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-12 text-center">
          <img
            src="/images/mascots/2.png"
            alt="Kadın Atlası"
            className="mx-auto h-24 w-24 object-contain"
          />
          <p className="mt-4 text-sm font-semibold text-[var(--text-muted)]">{t.discover.empty}</p>
        </div>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => {
            const title =
              locale === 'en' && article.titleEn ? article.titleEn : article.titleTr || article.title;
            const catLabel =
              CATEGORY_LABELS[locale][article.category] || article.category;
            return (
              <Link
                key={article.id}
                href={`/kesfet/${article.id}`}
                className="flex flex-col justify-between rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 transition hover:-translate-y-1 hover:border-[#FF69B4] hover:shadow-lg hover:shadow-pink-500/10"
              >
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="rounded-full bg-[#FFF0F5] px-2.5 py-1 font-bold text-[#E91E63] dark:bg-[#2a1936] dark:text-[#FF69B4]">
                      {catLabel}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {article.readTimeMin} {t.discover.readTime}
                    </span>
                  </div>
                  <h2 className="mt-4 line-clamp-2 text-lg font-extrabold text-[var(--text-main)]">
                    {title}
                  </h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--text-muted)]">
                    {article.excerpt}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-[var(--border-soft)] pt-4 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-bold text-[#7C3AED]">
                    <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                    {t.discover.readMore}
                  </span>
                  <span className="text-[var(--text-muted)]">
                    {new Date(article.publishedAt).toLocaleDateString(
                      locale === 'tr' ? 'tr-TR' : 'en-US',
                    )}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
