'use client';

import React from 'react';
import { Crown, CheckCircle2, Smartphone, ShieldCheck } from 'lucide-react';
import type { PaywallConfig } from '@/lib/api';
import { useAppContext } from './AppContext';
import { formatCurrencySymbol, localizePaywall } from '@/lib/i18n';

export function PremiumClient({ paywall }: { paywall: PaywallConfig | null }) {
  const { locale, t, openDownloadModal } = useAppContext();
  const localizedPaywall = localizePaywall(paywall, locale);

  const plans = localizedPaywall
    ? [localizedPaywall.plans.MONTHLY, localizedPaywall.plans.YEARLY].filter(
        (p) => p?.isActive !== false,
      )
    : [];

  const aiLimit = localizedPaywall?.premiumAiMessageLimit || 1000;
  const formattedLimit = aiLimit.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US');

  const features =
    localizedPaywall?.features && localizedPaywall.features.length > 0
      ? localizedPaywall.features
      : (localizedPaywall?.comparisonRows || [])
          .filter((r) => r.isActive !== false)
          .map((r) => ({
            title: r.title,
            description: '',
            freeLabel:
              typeof r.freeValue === 'boolean'
                ? r.freeValue
                  ? '✓'
                  : '—'
                : r.freeValue || '—',
            premiumLabel:
              typeof r.premiumValue === 'boolean'
                ? r.premiumValue
                  ? '✓'
                  : '—'
                : r.premiumValue || '✓',
          }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/15 px-3.5 py-1 text-xs font-bold text-[#7C3AED]">
          <Crown className="h-3.5 w-3.5" />
          {localizedPaywall?.heroBadge || t.premium.badge}
        </span>
        <h1 className="mt-3 text-3xl font-extrabold text-[var(--text-main)] sm:text-4xl">
          {localizedPaywall?.heroTitle ||
            (locale === 'tr' ? 'Kadın Atlası Premium’a Geç' : 'Upgrade to Kadın Atlası Premium')}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-[var(--text-muted)] sm:text-base">
          {localizedPaywall?.heroSubtitle ||
            (locale === 'tr'
              ? `Aylık ${formattedLimit} mesajlık NOVA AI Pro sohbeti, gelişmiş döngü & sağlık raporları ve reklamsız deneyim.`
              : `${formattedLimit} monthly NOVA AI Pro messages, advanced cycle & health reports, and an ad-free experience.`)}
        </p>
      </div>

      {/* Plans */}
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {plans.map((plan) => {
          const isYearly = plan.tier === 'YEARLY';
          const badgeLabel = plan.badge || plan.badgeText;
          const currencyText = formatCurrencySymbol(plan.currency, plan.currencySymbol);
          return (
            <div
              key={plan.tier}
              className={`relative flex flex-col justify-between rounded-3xl border p-7 ${
                isYearly
                  ? 'border-[#FF69B4] bg-gradient-to-b from-[#FFF0F5] to-white shadow-xl shadow-pink-500/10 dark:from-[#261734] dark:to-[#171320]'
                  : 'border-[var(--border-soft)] bg-[var(--bg-card)]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xl font-extrabold text-[var(--text-main)]">{plan.title}</h2>
                  {badgeLabel && (
                    <span className="rounded-full bg-gradient-to-r from-[#FF69B4] to-[#D946EF] px-3 py-1 text-xs font-bold text-white">
                      {badgeLabel}
                    </span>
                  )}
                </div>
                {plan.subtitle && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{plan.subtitle}</p>
                )}

                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="text-4xl font-extrabold text-[var(--text-main)]">
                    {plan.price} {currencyText}
                  </span>
                  <span className="text-sm text-[var(--text-muted)]">
                    / {isYearly ? (locale === 'tr' ? 'yıl' : 'year') : locale === 'tr' ? 'ay' : 'month'}
                  </span>
                </div>

                {localizedPaywall?.trialEnabled && plan.trialDays > 0 && (
                  <div className="mt-2 inline-block rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {plan.trialDays} {t.premium.trialBadge}
                  </div>
                )}

                <ul className="mt-6 space-y-2.5">
                  {(plan.features || []).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-[var(--text-main)]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={openDownloadModal}
                className={`mt-8 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition ${
                  isYearly
                    ? 'bg-gradient-to-r from-[#FF69B4] to-[#D946EF] text-white shadow-md shadow-pink-500/20 hover:opacity-95'
                    : 'border border-[var(--border-soft)] bg-[var(--bg-page)] text-[var(--text-main)] hover:border-[#FF69B4]'
                }`}
              >
                <Smartphone className="h-4 w-4" />
                <span>{t.premium.ctaApp}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Feature Comparison */}
      {features.length > 0 && (
        <div className="mt-12 overflow-hidden rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)]">
          <div className="border-b border-[var(--border-soft)] px-5 py-4 sm:px-6">
            <h2 className="text-lg font-extrabold text-[var(--text-main)]">
              {t.premium.comparisonTitle}
            </h2>
          </div>

          {/* Mobile: feature-based cards */}
          <div className="space-y-3 p-4 md:hidden">
            {features.map((feat) => (
              <div
                key={feat.title}
                className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-page)] p-4"
              >
                <div className="text-sm font-bold text-[var(--text-main)]">{feat.title}</div>
                {feat.description && (
                  <div className="mt-0.5 text-xs text-[var(--text-muted)]">{feat.description}</div>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 py-2">
                    <div className="text-[11px] font-semibold text-[var(--text-muted)]">
                      {t.premium.freeCol}
                    </div>
                    <div className="mt-0.5 font-bold text-[var(--text-main)]">
                      {feat.freeLabel || '—'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#FF69B4]/40 bg-[#FFF0F5]/60 px-3 py-2 dark:bg-[#2a1936]">
                    <div className="text-[11px] font-semibold text-[#E91E63] dark:text-[#FF69B4]">
                      {t.premium.premiumCol}
                    </div>
                    <div className="mt-0.5 font-bold text-emerald-600 dark:text-emerald-400">
                      {feat.premiumLabel || '✓'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: comparison table */}
          <div className="hidden divide-y divide-[var(--border-soft)] md:block">
            <div className="grid grid-cols-12 bg-[var(--bg-page)] px-6 py-3 text-xs font-bold text-[var(--text-muted)]">
              <div className="col-span-6">{locale === 'tr' ? 'Özellik' : 'Feature'}</div>
              <div className="col-span-3 text-center">{t.premium.freeCol}</div>
              <div className="col-span-3 text-center text-[#E91E63] dark:text-[#FF69B4]">
                {t.premium.premiumCol}
              </div>
            </div>
            {features.map((feat) => (
              <div key={feat.title} className="grid grid-cols-12 items-center px-6 py-4 text-sm">
                <div className="col-span-6 pr-3">
                  <div className="font-bold text-[var(--text-main)]">{feat.title}</div>
                  {feat.description && (
                    <div className="text-xs text-[var(--text-muted)]">{feat.description}</div>
                  )}
                </div>
                <div className="col-span-3 text-center text-xs font-semibold text-[var(--text-muted)]">
                  {feat.freeLabel || '—'}
                </div>
                <div className="col-span-3 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {feat.premiumLabel || '✓'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-[var(--text-muted)]">
        <ShieldCheck className="h-4 w-4 text-emerald-500" />
        <span>{t.premium.storeNote}</span>
      </div>
    </div>
  );
}
