'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  ShieldCheck,
  Calendar,
  Mail,
  ListChecks,
  Building2,
} from 'lucide-react';
import type { CmsPage } from '@/lib/api';
import { useAppContext } from './AppContext';
import { MarkdownContent, extractMarkdownHeadings } from './MarkdownContent';

const LEGAL_NAV_ITEMS = [
  {
    slug: 'hakkimizda',
    labelTr: 'Hakkımızda & Künye',
    labelEn: 'About Us & Imprint',
  },
  {
    slug: 'gizlilik-politikasi',
    labelTr: 'Gizlilik Politikası ve KVKK',
    labelEn: 'Privacy Policy & KVKK',
  },
  {
    slug: 'kvkk-aydinlatma-metni',
    labelTr: 'KVKK Aydınlatma Metni',
    labelEn: 'KVKK Clarification Notice',
  },
  {
    slug: 'kullanim-kosullari',
    labelTr: 'Kullanım Koşulları',
    labelEn: 'Terms of Service',
  },
];

export function CmsPageClient({
  page,
  slug,
  fallbackTitleTr,
  fallbackTitleEn,
  fallbackContentTr,
  fallbackContentEn,
}: {
  page: CmsPage | null;
  slug?: string;
  fallbackTitleTr?: string;
  fallbackTitleEn?: string;
  fallbackContentTr?: string;
  fallbackContentEn?: string;
}) {
  const { locale, t } = useAppContext();
  const activeSlug = page?.slug || slug || '';

  const title = page
    ? locale === 'en' && page.titleEn
      ? page.titleEn
      : page.titleTr
    : locale === 'en'
      ? fallbackTitleEn || 'Page'
      : fallbackTitleTr || 'Sayfa';

  const content = page
    ? locale === 'en' && page.contentEn
      ? page.contentEn
      : page.contentTr
    : locale === 'en'
      ? fallbackContentEn || ''
      : fallbackContentTr || '';

  const headings = React.useMemo(() => extractMarkdownHeadings(content), [content]);

  const updatedDateStr = page?.updatedAt
    ? new Date(page.updatedAt).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#7C3AED] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>{t.nav.home}</span>
      </Link>

      {/* Quick Navigation Bar Across Legal & Corporate Pages */}
      <div className="mt-5 flex flex-wrap gap-2">
        {LEGAL_NAV_ITEMS.map((item) => {
          const isCurrent = activeSlug === item.slug;
          return (
            <Link
              key={item.slug}
              href={`/sayfa/${item.slug}`}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                isCurrent
                  ? 'bg-gradient-to-r from-[#FF69B4] to-[#7C3AED] text-white shadow-sm'
                  : 'border border-[var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-[#FF69B4] hover:text-[var(--text-main)]'
              }`}
            >
              {locale === 'en' ? item.labelEn : item.labelTr}
            </Link>
          );
        })}
      </div>

      {/* Document Header */}
      <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-wider text-[#FF69B4]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF0F5] px-3 py-1 text-[#E91E63] dark:bg-[#2a1936] dark:text-[#FF69B4]">
          <FileText className="h-3.5 w-3.5" />
          {locale === 'tr' ? 'Kurumsal & Yasal Doküman' : 'Corporate & Legal Document'}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          {locale === 'tr' ? '6698 Sayılı KVKK Kapsamında' : 'KVKK & GDPR Aligned'}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[var(--text-muted)] normal-case font-medium">
          <Calendar className="h-3.5 w-3.5" />
          {locale === 'tr' ? `Son Güncelleme: ${updatedDateStr}` : `Last Updated: ${updatedDateStr}`}
        </span>
      </div>

      <h1 className="mt-3 text-3xl font-extrabold text-[var(--text-main)] sm:text-4xl">{title}</h1>

      {/* Table of Contents (if multiple sections exist) */}
      {headings.length >= 2 && (
        <div className="mt-6 rounded-2xl border border-[var(--border-soft)] bg-[#FFF0F5]/60 p-4 sm:p-5 dark:bg-[#2a1936]/40">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#7C3AED] dark:text-[#c4b5fd]">
            <ListChecks className="h-4 w-4" />
            <span>{locale === 'tr' ? 'İçindekiler ve Bölüm Başlıkları' : 'Table of Contents'}</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {headings.map((h) => (
              <a
                key={h.id}
                href={`#${h.id}`}
                className="rounded-xl border border-transparent bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold text-[var(--text-main)] transition hover:border-[#FF69B4] hover:text-[#E91E63]"
              >
                {h.text}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Body */}
      <div className="mt-6 rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 sm:p-8 shadow-sm">
        <MarkdownContent content={content} />
      </div>

      {/* Data Controller & Official Contact Card */}
      <div className="mt-6 rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#7C3AED]">
              <Building2 className="h-4 w-4" />
              <span>
                {locale === 'tr'
                  ? 'Veri Sorumlusu ve Resmi Başvuru Kanalları'
                  : 'Data Controller & Official Contact Channels'}
              </span>
            </div>
            <p className="mt-1.5 text-sm font-bold text-[var(--text-main)]">
              {locale === 'tr'
                ? 'Kadın Atlası Dijital Sağlık ve Wellness Teknolojileri Yönetimi (İstanbul, Türkiye)'
                : 'Kadın Atlası Digital Health & Wellness Technologies Management (Istanbul, Turkey)'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
              {locale === 'tr'
                ? 'KVKK m. 11 kapsamındaki veri erişim, düzeltme, JSON dışa aktarma veya kalıcı hesap silme taleplerinizi mobil uygulama içinden anında gerçekleştirebilir veya aşağıdaki resmi kanallardan bize iletebilirsiniz (en geç 30 gün içinde yanıtlanır).'
                : 'Exercise your data access, portability (JSON export), rectification, or permanent account deletion rights directly inside the mobile app or via our official channels below (answered within 30 days).'}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2.5">
            <a
              href="mailto:kvkk@kadinatlasi.com"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-page)] px-3.5 py-2 text-xs font-bold text-[var(--text-main)] transition hover:border-[#FF69B4]"
            >
              <Mail className="h-3.5 w-3.5 text-[#E91E63]" />
              <span>kvkk@kadinatlasi.com</span>
            </a>
            <Link
              href="/iletisim"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF69B4] to-[#7C3AED] px-4 py-2 text-xs font-bold text-white transition hover:opacity-95"
            >
              <span>{locale === 'tr' ? 'Başvuru & İletişim Formu' : 'Contact & Request Form'}</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
