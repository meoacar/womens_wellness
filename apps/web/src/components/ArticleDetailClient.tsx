'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock,
  Share2,
  Check,
  Smartphone,
  ShieldCheck,
  UserCheck,
  ChevronDown,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import type { PublicArticle } from '@/lib/api';
import { useAppContext } from './AppContext';
import { CATEGORY_LABELS, formatTagLabel } from '@/lib/i18n';
import { getAuthorProfile, getCategoryReferences } from '@/lib/articleMeta';
import { MarkdownContent } from './MarkdownContent';

export function ArticleDetailClient({ article }: { article: PublicArticle }) {
  const { locale, t, openDownloadModal } = useAppContext();
  const [copied, setCopied] = useState(false);
  const [authorOpen, setAuthorOpen] = useState(false);

  const authorProfile = getAuthorProfile(article.author);
  const references = getCategoryReferences(article.category, locale);
  const reviewDateStr = new Date(article.updatedAt || article.publishedAt).toLocaleDateString(
    locale === 'tr' ? 'tr-TR' : 'en-US',
    { day: 'numeric', month: 'long', year: 'numeric' },
  );

  const title =
    locale === 'en' && article.titleEn ? article.titleEn : article.titleTr || article.title;
  const content =
    locale === 'en' && article.contentEn
      ? article.contentEn
      : article.contentTr || article.content || article.excerpt;
  const catLabel = CATEGORY_LABELS[locale][article.category] || article.category;

  React.useEffect(() => {
    if (typeof document !== 'undefined' && title) {
      document.title = `${title} — Kadın Atlası`;
    }
  }, [title, locale]);

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Fallback to copy
      }
    }
    if (navigator.clipboard && url) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href="/kesfet"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#7C3AED] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>{t.discover.backToList}</span>
      </Link>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs">
          <span className="rounded-full bg-[#FFF0F5] px-3 py-1 font-bold text-[#E91E63] dark:bg-[#2a1936] dark:text-[#FF69B4]">
            {catLabel}
          </span>
          <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
            <Clock className="h-3.5 w-3.5" />
            {article.readTimeMin} {t.discover.readTime}
          </span>
        </div>
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] px-3.5 py-1.5 text-xs font-bold text-[var(--text-main)] hover:border-[#FF69B4]"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Share2 className="h-3.5 w-3.5" />}
          <span>{copied ? (locale === 'tr' ? 'Kopyalandı' : 'Copied') : locale === 'tr' ? 'Paylaş' : 'Share'}</span>
        </button>
      </div>

      <h1 className="mt-5 text-3xl font-extrabold leading-tight text-[var(--text-main)] sm:text-4xl">
        {title}
      </h1>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--text-muted)]">
        <button
          type="button"
          onClick={() => setAuthorOpen((prev) => !prev)}
          aria-expanded={authorOpen}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 py-1 font-bold text-[var(--text-main)] transition hover:border-[#FF69B4]"
        >
          <UserCheck className="h-3.5 w-3.5 text-[#7C3AED]" />
          <span>{authorProfile.name}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-[var(--text-muted)] transition-transform ${
              authorOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>
            {locale === 'tr' ? 'Tıbbi İnceleme:' : 'Medical Review:'}{' '}
            <strong className="font-semibold text-[var(--text-main)]">
              {locale === 'tr' ? authorProfile.reviewerTr : authorProfile.reviewerEn}
            </strong>
          </span>
        </span>

        <span>
          {locale === 'tr' ? 'İnceleme Tarihi:' : 'Reviewed:'} {reviewDateStr}
        </span>
      </div>

      {authorOpen && (
        <div className="mt-4 rounded-2xl border border-[#FFD4E7] bg-[#FFF0F5]/60 p-4 text-xs leading-relaxed dark:border-[#3b254a] dark:bg-[#231731]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-extrabold text-[var(--text-main)]">
                {authorProfile.name}
              </div>
              <div className="font-semibold text-[#E91E63] dark:text-[#FF69B4]">
                {locale === 'tr' ? authorProfile.roleTr : authorProfile.roleEn}
              </div>
            </div>
            <Link
              href="/iletisim"
              className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 py-1 font-bold text-[#7C3AED] hover:border-[#7C3AED]"
            >
              {locale === 'tr' ? 'Editoryal İletişim' : 'Editorial Contact'}
            </Link>
          </div>
          <p className="mt-2 text-[var(--text-muted)]">
            {locale === 'tr' ? authorProfile.bioTr : authorProfile.bioEn}
          </p>
          <div className="mt-2.5 border-t border-[var(--border-soft)] pt-2 text-[11px] text-[var(--text-muted)]">
            {locale === 'tr'
              ? `Tıbbi doğrulama (${reviewDateStr}): ${authorProfile.reviewerTr} tarafından uluslararası klinik kılavuzlar (ACOG, WHO, NHS, NIH) referans alınarak incelenmiştir. Bilgilendirme amaçlıdır; tanı ve tedavi yerine geçmez.`
              : `Medical verification (${reviewDateStr}): Reviewed by ${authorProfile.reviewerEn} against international clinical guidelines (ACOG, WHO, NHS, NIH). Informational only; does not replace medical advice.`}
          </div>
        </div>
      )}

      <div className="mt-8 rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 sm:p-8">
        <MarkdownContent content={content} />
      </div>

      {/* Scientific References */}
      <section className="mt-6 rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6">
        <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--text-main)]">
          <BookOpen className="h-4 w-4 text-[#7C3AED]" />
          <span>
            {locale === 'tr' ? 'Kaynakça ve Bilimsel Referanslar' : 'Sources & Clinical References'}
          </span>
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {locale === 'tr'
            ? 'Bu rehberde yer alan temel klinik bilgiler aşağıdaki uluslararası sağlık otoritelerinin rehberleri doğrultusunda derlenmiştir:'
            : 'Core clinical facts in this guide are aligned with publications from the following public health authorities:'}
        </p>
        <ul className="mt-4 space-y-2.5">
          {references.map((ref, idx) => (
            <li key={ref.url}>
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-page)] px-4 py-3 text-xs transition hover:border-[#FF69B4]"
              >
                <span className="flex items-center gap-2.5">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FFF0F5] text-[11px] font-extrabold text-[#E91E63] dark:bg-[#2a1936] dark:text-[#FF69B4]">
                    {idx + 1}
                  </span>
                  <span className="rounded-md bg-purple-500/15 px-2 py-0.5 text-[10px] font-extrabold text-[#7C3AED]">
                    {ref.org}
                  </span>
                  <span className="font-semibold text-[var(--text-main)]">{ref.title}</span>
                </span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      {article.tags && article.tags.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[var(--border-soft)] bg-[var(--bg-card)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]"
            >
              #{formatTagLabel(tag, locale)}
            </span>
          ))}
        </div>
      )}

      {/* App Promo */}
      <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-3xl bg-gradient-to-r from-[#FF69B4] to-[#7C3AED] p-6 text-white sm:flex-row sm:items-center">
        <div>
          <h3 className="text-base font-extrabold">
            {locale === 'tr'
              ? 'Bu konuyu NOVA AI asistanına sor!'
              : 'Ask NOVA AI about this topic!'}
          </h3>
          <p className="mt-1 text-xs text-white/90">
            {locale === 'tr'
              ? 'Kadın Atlası mobil uygulamasında makaleleri kaydet ve kişisel rehberlik al.'
              : 'Save articles and get personalized guidance inside the Kadın Atlası app.'}
          </p>
        </div>
        <button
          type="button"
          onClick={openDownloadModal}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-extrabold text-[#E91E63]"
        >
          <Smartphone className="h-4 w-4" />
          <span>{t.nav.download}</span>
        </button>
      </div>

      {article.relatedArticles && article.relatedArticles.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-extrabold text-[var(--text-main)]">
            {t.discover.relatedTitle}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {article.relatedArticles.map((rel) => (
              <Link
                key={rel.id}
                href={`/kesfet/${rel.id}`}
                className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 transition hover:border-[#FF69B4]"
              >
                <h3 className="line-clamp-2 text-sm font-bold text-[var(--text-main)]">
                  {locale === 'en' && rel.titleEn ? rel.titleEn : rel.titleTr || rel.title}
                </h3>
                <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                  {rel.readTimeMin} {t.discover.readTime}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
