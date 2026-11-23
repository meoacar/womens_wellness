import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Sparkles, Download, CheckCircle2, Tag, ArrowRight } from 'lucide-react';
import type { Locale } from '@/lib/api';
import { getRouteMeta } from '@/lib/i18n';
import { buildSeoMetadata } from '@/lib/seo';
import { CHANGELOG_ENTRIES, LATEST_APP_VERSION } from '@/lib/changelog';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale: Locale = cookieStore.get('web_locale')?.value === 'en' ? 'en' : 'tr';
  const meta = getRouteMeta('/guncellemeler', locale);
  return buildSeoMetadata({
    title: meta.title,
    description: meta.description,
    canonical: meta.canonical,
    locale,
  });
}

export default async function UpdatesPage() {
  const cookieStore = await cookies();
  const locale: Locale = cookieStore.get('web_locale')?.value === 'en' ? 'en' : 'tr';
  const isEn = locale === 'en';

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FF69B4] via-[#DB2777] to-[#7C3AED] p-8 text-white shadow-xl sm:p-10">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-3.5 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              {isEn ? `Latest Release · v${LATEST_APP_VERSION}` : `Güncel Sürüm · v${LATEST_APP_VERSION}`}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {isEn ? 'Product Updates & Changelog' : 'Güncellemeler & Sürüm Notları'}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/90 sm:text-base">
              {isEn
                ? 'Every new feature, performance boost, and improvement shipped to Kadın Atlası across mobile, web, and NOVA AI.'
                : 'Kadın Atlası mobil uygulaması, NOVA AI asistanı ve web platformuna eklenen tüm yeni özellikler ve iyileştirmeler.'}
            </p>
          </div>

          <a
            href="https://kadinatlasi.com/kadinatlasi.apk"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-[#9D174D] shadow-md transition hover:scale-[1.02]"
          >
            <Download className="h-4 w-4" />
            {isEn ? `Download APK v${LATEST_APP_VERSION}` : `APK İndir (v${LATEST_APP_VERSION})`}
          </a>
        </div>
      </div>

      {/* Release Timeline (Grouped by Date) */}
      <div className="mt-10 space-y-8">
        {CHANGELOG_ENTRIES.map((entry) => {
          const sections = isEn ? entry.sectionsEn : entry.sectionsTr;
          return (
            <article
              key={`${entry.date}-${entry.version}`}
              className="relative rounded-3xl border border-[var(--border-soft)] bg-white p-6 shadow-sm transition hover:shadow-md dark:bg-[#191225] sm:p-8"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#EC4899] to-[#7C3AED] px-3.5 py-1 text-xs font-extrabold text-white">
                    <Tag className="h-3 w-3" />
                    v{entry.version}
                  </span>
                  <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-bold text-pink-700 dark:bg-pink-950/50 dark:text-pink-300">
                    {isEn ? entry.badgeEn : entry.badgeTr}
                  </span>
                  {entry.isLatest && (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      {isEn ? 'Current' : 'Güncel'}
                    </span>
                  )}
                </div>
                <time className="text-xs font-semibold text-[var(--text-muted)]">
                  {entry.date}
                </time>
              </div>

              <h2 className="mt-4 text-xl font-extrabold text-[var(--text-main)] sm:text-2xl">
                {isEn ? entry.titleEn : entry.titleTr}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                {isEn ? entry.summaryEn : entry.summaryTr}
              </p>

              <div className="mt-6 space-y-6">
                {sections.map((section, sIdx) => (
                  <div
                    key={sIdx}
                    className="rounded-2xl border border-[var(--border-soft)] bg-[#FFF8FB]/60 p-4 dark:bg-[#221833]/60 sm:p-5"
                  >
                    <h3 className="text-base font-extrabold tracking-tight text-[#9D174D] dark:text-[#F9A8D4] sm:text-lg">
                      {section.heading}
                    </h3>
                    <ul className="mt-3 space-y-2.5">
                      {section.items.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2.5 text-sm text-[var(--text-main)]"
                        >
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#EC4899]" />
                          <span>
                            <strong className="font-bold text-[#7C3AED] dark:text-[#C4B5FD]">
                              [{item.category}]
                            </strong>{' '}
                            {item.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      {/* Bottom CTA */}
      <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-2xl border border-[var(--border-soft)] bg-[#FFF0F5]/60 p-6 dark:bg-[#241b35] sm:flex-row">
        <div>
          <h3 className="text-base font-extrabold text-[var(--text-main)]">
            {isEn ? 'Have a feature request?' : 'Öneriniz veya geri bildiriminiz mi var?'}
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            {isEn
              ? 'Share your ideas with our team anytime.'
              : 'Geliştirmemizi istediğiniz özellikleri bize iletebilirsiniz.'}
          </p>
        </div>
        <Link
          href="/iletisim"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#EC4899] to-[#7C3AED] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:opacity-95"
        >
          {isEn ? 'Contact Support' : 'İletişime Geç'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
