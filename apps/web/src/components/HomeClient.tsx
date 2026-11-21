'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Calculator,
  ArrowRight,
  CheckCircle2,
  BookOpen,
  ShieldCheck,
  Crown,
  ChevronDown,
} from 'lucide-react';
import { useAppContext } from './AppContext';
import { AppleIcon, AndroidIcon } from './StoreIcons';
import { CATEGORY_LABELS, formatCurrencySymbol, localizePaywall } from '@/lib/i18n';
import type { PublicArticle, PaywallConfig, SiteSummary } from '@/lib/api';

interface HomeClientProps {
  summary: SiteSummary | null;
  articles: PublicArticle[];
  paywall: PaywallConfig | null;
}

export function HomeClient({ summary, articles, paywall }: HomeClientProps) {
  const { locale, t, openDownloadModal } = useAppContext();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const localizedPaywall = localizePaywall(paywall, locale);

  const faqItems =
    localizedPaywall?.faq && localizedPaywall.faq.length > 0
      ? localizedPaywall.faq
      : locale === 'tr'
        ? [
            {
              question: 'Kadın Atlası ücretsiz mi?',
              answer:
                'Evet! Regl takibi, hamilelik modu, su/adım/uyku/nefes kayıtları, hesaplayıcılar ve topluluk özellikleri tamamen ücretsizdir (aylık 100 NOVA AI mesajı dahil). Aylık 1.000 mesaj NOVA AI Pro sohbeti ve gelişmiş raporlar için Premium planlarını inceleyebilirsiniz.',
            },
            {
              question: 'Sağlık verilerim güvende mi?',
              answer:
                'Tüm sağlık ve döngü kayıtlarınız şifrelenmiş olarak saklanır, KVKK uyumludur ve uygulama içinden dilediğiniz zaman verilerinizi indirebilir veya hesabınızı silebilirsiniz.',
            },
            {
              question: 'Web sitesindeki hesaplayıcılar kayıt gerektiriyor mu?',
              answer:
                'Hayır. Web sitemizdeki regl, ovulasyon, hamilelik haftası, su ve BMI hesaplayıcılarını üyelik oluşturmadan anında kullanabilirsiniz.',
            },
          ]
        : [
            {
              question: 'Is Kadın Atlası free to use?',
              answer:
                'Yes! Cycle tracking, pregnancy tools, water/steps/sleep/breathing logs, calculators, and community Q&A are free (including 100 NOVA AI messages/month). Premium unlocks 1,000 monthly NOVA AI Pro messages and advanced insights.',
            },
            {
              question: 'Is my health data private?',
              answer:
                'All cycle and health records are encrypted and privacy-first. You can export or delete your data anytime directly inside the app.',
            },
            {
              question: 'Do web calculators require signing up?',
              answer:
                'No. All calculators on this website work instantly with zero registration.',
            },
          ];

  const monthlyPlan = localizedPaywall?.plans?.MONTHLY;
  const yearlyPlan = localizedPaywall?.plans?.YEARLY;

  return (
    <div>
      {/* HERO */}
      <section className="gradient-hero relative overflow-hidden border-b border-[var(--border-soft)]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 md:py-20">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FFD4E7] bg-[#FFF0F5] px-3.5 py-1.5 text-xs font-bold text-[#E91E63] dark:border-[#3b254a] dark:bg-[#241630] dark:text-[#FF69B4]">
              <Sparkles className="h-3.5 w-3.5" />
              {t.hero.badge}
            </span>

            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-[var(--text-main)] sm:text-5xl">
              {t.hero.titleStart}{' '}
              <span className="bg-gradient-to-r from-[#FF69B4] to-[#7C3AED] bg-clip-text text-transparent">
                {t.hero.titleHighlight}
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--text-muted)] sm:text-lg">
              {t.hero.subtitle}
            </p>

            <div className="mt-8 flex flex-wrap gap-3.5">
              <button
                type="button"
                onClick={openDownloadModal}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF69B4] to-[#D946EF] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-pink-500/25 transition hover:opacity-95"
              >
                <span className="inline-flex items-center gap-1">
                  <AppleIcon className="h-4 w-4 shrink-0" />
                  <AndroidIcon className="h-4 w-4 shrink-0" />
                </span>
                {t.hero.ctaDownload}
              </button>

              <Link
                href="/hesaplayicilar"
                className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] px-6 py-3.5 text-sm font-bold text-[var(--text-main)] transition hover:border-[#FF69B4]"
              >
                <Calculator className="h-4 w-4 text-[#7C3AED]" />
                {t.hero.ctaCalculators}
              </Link>
            </div>

            <div className="mt-10 grid gap-3 border-t border-[var(--border-soft)] pt-6 sm:grid-cols-3">
              <Link
                href="/hesaplayicilar"
                className="group rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)]/80 p-3.5 transition hover:border-[#FF69B4]"
              >
                <div className="flex items-center gap-1.5 text-sm font-extrabold text-[#E91E63] dark:text-[#FF69B4]">
                  <Calculator className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{t.hero.benefitCalcTitle}</span>
                </div>
                <div className="mt-1 text-xs font-medium text-[var(--text-muted)] group-hover:text-[var(--text-main)]">
                  {t.hero.benefitCalcDesc}
                </div>
              </Link>

              <button
                type="button"
                onClick={openDownloadModal}
                className="group rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)]/80 p-3.5 text-left transition hover:border-[#7C3AED]"
              >
                <div className="flex items-center gap-1.5 text-sm font-extrabold text-[#7C3AED]">
                  <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{t.hero.benefitTrackTitle}</span>
                </div>
                <div className="mt-1 text-xs font-medium text-[var(--text-muted)] group-hover:text-[var(--text-main)]">
                  {t.hero.benefitTrackDesc}
                </div>
              </button>

              <Link
                href="/sayfa/gizlilik-politikasi"
                className="group rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)]/80 p-3.5 transition hover:border-emerald-500"
              >
                <div className="flex items-center gap-1.5 text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{t.hero.benefitPrivacyTitle}</span>
                </div>
                <div className="mt-1 text-xs font-medium text-[var(--text-muted)] group-hover:text-[var(--text-main)]">
                  {t.hero.benefitPrivacyDesc}
                </div>
              </Link>
            </div>
          </div>

          {/* Right Hero Mascot Collage */}
          <div className="relative mx-auto flex w-full max-w-md items-center justify-center">
            <div className="relative w-full rounded-[32px] border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 shadow-xl shadow-pink-500/10">
              <div className="flex items-start justify-between gap-2 sm:items-center">
                <div className="min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#FF69B4]">
                    NOVA AI & Wellness
                  </span>
                  <h3 className="mt-1 text-base font-extrabold leading-snug text-[var(--text-main)] sm:text-lg">
                    {locale === 'tr' ? (
                      <>
                        Bugün Senin{' '}
                        <span className="whitespace-nowrap">Günün ✨</span>
                      </>
                    ) : (
                      <>
                        Today Is Your{' '}
                        <span className="whitespace-nowrap">Day ✨</span>
                      </>
                    )}
                  </h3>
                </div>
                <span className="shrink-0 whitespace-nowrap rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {t.hero.syncBadge}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
                {t.hero.syncDesc}
              </p>

              <div className="my-4 flex items-center justify-center rounded-3xl bg-[#FFF0F5] p-6 dark:bg-[#231833]">
                <img
                  src="/images/mascots/Morning.png"
                  alt="Kadın Atlası Maskot"
                  className="h-56 w-56 object-contain drop-shadow-md"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/hesaplayicilar?tab=cycle"
                  className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-page)] p-3 transition hover:border-[#FF69B4]"
                >
                  <div className="text-xs font-semibold text-[var(--text-muted)]">
                    {locale === 'tr' ? 'Hızlı Araç' : 'Quick Tool'}
                  </div>
                  <div className="mt-1 text-sm font-bold text-[var(--text-main)]">
                    🌸 {t.calculators.tabs.cycle}
                  </div>
                </Link>
                <Link
                  href="/hesaplayicilar?tab=pregnancy"
                  className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-page)] p-3 transition hover:border-[#7C3AED]"
                >
                  <div className="text-xs font-semibold text-[var(--text-muted)]">
                    {locale === 'tr' ? 'Hızlı Araç' : 'Quick Tool'}
                  </div>
                  <div className="mt-1 text-sm font-bold text-[var(--text-main)]">
                    🤰 {t.calculators.tabs.pregnancy}
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-[var(--text-main)] sm:text-4xl">
            {t.features.title}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[var(--text-muted)]">{t.features.subtitle}</p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {t.features.items.map((item) => (
            <div
              key={item.title}
              className="group rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 shadow-sm transition hover:-translate-y-1 hover:border-[#FF69B4] hover:shadow-lg hover:shadow-pink-500/10"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF0F5] p-2 dark:bg-[#241630]">
                <img src={item.mascot} alt={item.title} className="h-12 w-12 object-contain" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-main)]">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* INTERACTIVE CALCULATORS CTA BAND */}
      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="rounded-3xl bg-gradient-to-r from-[#FF69B4] via-[#D946EF] to-[#7C3AED] p-8 text-white shadow-xl sm:p-10">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-xl">
              <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
                {t.calculators.badge}
              </span>
              <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">{t.calculators.title}</h2>
              <p className="mt-2 text-sm text-white/90 sm:text-base">{t.calculators.subtitle}</p>
            </div>
            <Link
              href="/hesaplayicilar"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-extrabold text-[#E91E63] shadow-md transition hover:bg-pink-50"
            >
              <span>{t.hero.ctaCalculators}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* DISCOVER / ARTICLES */}
      {articles.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#FF69B4]">
                {t.discover.badge}
              </span>
              <h2 className="mt-1 text-3xl font-extrabold text-[var(--text-main)]">
                {t.discover.title}
              </h2>
            </div>
            <Link
              href="/kesfet"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#E91E63] hover:underline dark:text-[#FF69B4]"
            >
              <span>{t.discover.backToList}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {articles.slice(0, 3).map((article) => {
              const title =
                locale === 'en' && article.titleEn ? article.titleEn : article.titleTr || article.title;
              const catLabel =
                CATEGORY_LABELS[locale][article.category] || article.category;
              return (
                <Link
                  key={article.id}
                  href={`/kesfet/${article.id}`}
                  className="flex flex-col justify-between rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 transition hover:-translate-y-1 hover:border-[#FF69B4]"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="rounded-full bg-[#FFF0F5] px-2.5 py-1 font-bold text-[#E91E63] dark:bg-[#2a1936] dark:text-[#FF69B4]">
                        {catLabel}
                      </span>
                      <span className="text-[var(--text-muted)]">
                        {article.readTimeMin} {t.discover.readTime}
                      </span>
                    </div>
                    <h3 className="mt-4 line-clamp-2 text-lg font-bold text-[var(--text-main)]">
                      {title}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm text-[var(--text-muted)]">
                      {article.excerpt}
                    </p>
                  </div>
                  <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-[#7C3AED]">
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>{t.discover.readMore}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* LIVE PREMIUM PREVIEW */}
      {localizedPaywall && (
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-8 sm:p-10">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/15 px-3 py-1 text-xs font-bold text-[#7C3AED]">
                  <Crown className="h-3.5 w-3.5" />
                  {localizedPaywall.heroBadge || t.premium.badge}
                </span>
                <h2 className="mt-3 text-2xl font-extrabold text-[var(--text-main)] sm:text-3xl">
                  {localizedPaywall.heroTitle}
                </h2>
                <p className="mt-2 max-w-xl text-sm text-[var(--text-muted)]">
                  {localizedPaywall.heroSubtitle}
                </p>
              </div>
              <Link
                href="/premium"
                className="inline-flex items-center gap-2 rounded-2xl bg-[#7C3AED] px-6 py-3.5 text-sm font-bold text-white transition hover:opacity-95"
              >
                <span>{t.nav.premium}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              {[monthlyPlan, yearlyPlan].filter(Boolean).map((plan) => (
                <div
                  key={plan!.tier}
                  className={`rounded-2xl border p-6 ${
                    plan!.tier === 'YEARLY'
                      ? 'border-[#FF69B4] bg-[#FFF0F5]/50 dark:bg-[#261734]'
                      : 'border-[var(--border-soft)] bg-[var(--bg-page)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-extrabold text-[var(--text-main)]">{plan!.title}</h3>
                    {(plan!.badge || plan!.badgeText) && (
                      <span className="rounded-full bg-[#FF69B4] px-2.5 py-0.5 text-xs font-bold text-white">
                        {plan!.badge || plan!.badgeText}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-[var(--text-main)]">
                      {plan!.price} {formatCurrencySymbol(plan!.currency, plan!.currencySymbol)}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      / {plan!.tier === 'YEARLY' ? (locale === 'tr' ? 'yıl' : 'year') : (locale === 'tr' ? 'ay' : 'month')}
                    </span>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {(plan!.features || []).slice(0, 4).map((feat) => (
                      <li key={feat} className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
        <h2 className="text-center text-2xl font-extrabold text-[var(--text-main)] sm:text-3xl">
          {locale === 'tr' ? 'Sık Sorulan Sorular' : 'Frequently Asked Questions'}
        </h2>
        <div className="mt-8 space-y-3">
          {faqItems.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={item.question}
                className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)]"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-bold text-[var(--text-main)] sm:text-base"
                >
                  <span>{item.question}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-[#FF69B4] transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-[var(--border-soft)] px-5 py-4 text-sm leading-relaxed text-[var(--text-muted)]">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
