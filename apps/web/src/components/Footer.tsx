'use client';

import React from 'react';
import Link from 'next/link';
import { useAppContext } from './AppContext';
import { AppleIcon, GooglePlayIcon } from './StoreIcons';
import type { SiteSummary } from '@/lib/api';

export function Footer({ pages = [] }: { pages?: SiteSummary['pages'] }) {
  const { locale, t, openDownloadModal } = useAppContext();

  const defaultCorporate = [
    { slug: 'hakkimizda', titleTr: 'Hakkımızda', titleEn: 'About Us' },
    { slug: 'gizlilik-politikasi', titleTr: 'Gizlilik Politikası', titleEn: 'Privacy Policy' },
    { slug: 'kullanim-kosullari', titleTr: 'Kullanım Koşulları', titleEn: 'Terms of Use' },
  ];

  const legalLinks = pages.length > 0 ? pages : defaultCorporate;

  return (
    <footer className="mt-20 border-t border-[var(--border-soft)] bg-[var(--bg-card)]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <img
                src="/images/mascots/2.png"
                alt={t.brand}
                className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#FFF0F5] to-[#F3E8FF] p-1 shadow-sm ring-1 ring-pink-200/60 object-contain dark:from-[#2a1936] dark:to-[#1f1630] dark:ring-pink-900/40"
              />
              <span className="bg-gradient-to-r from-[#FF69B4] to-[#7C3AED] bg-clip-text text-xl font-extrabold text-transparent">
                {t.brand}
              </span>
            </div>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--text-muted)]">
              {t.footer.desc}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={openDownloadModal}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1A1523] px-4 py-2 text-xs font-bold text-white transition hover:opacity-90 dark:bg-white dark:text-[#1A1523]"
              >
                <AppleIcon className="h-4 w-4 shrink-0" />
                <span>App Store</span>
              </button>
              <button
                type="button"
                onClick={openDownloadModal}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-page)] px-4 py-2 text-xs font-bold text-[var(--text-main)] transition hover:border-[#FF69B4]"
              >
                <GooglePlayIcon className="h-4 w-4 shrink-0" />
                <span>Google Play</span>
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-[var(--text-main)]">{t.footer.linksTitle}</h4>
            <ul className="mt-3 space-y-2.5 text-sm text-[var(--text-muted)]">
              <li>
                <Link href="/hesaplayicilar" className="hover:text-[#FF69B4]">
                  {t.nav.calculators}
                </Link>
              </li>
              <li>
                <Link href="/kesfet" className="hover:text-[#FF69B4]">
                  {t.nav.discover}
                </Link>
              </li>
              <li>
                <Link href="/premium" className="hover:text-[#FF69B4]">
                  {t.nav.premium}
                </Link>
              </li>
              <li>
                <Link href="/guncellemeler" className="hover:text-[#FF69B4]">
                  {t.nav.updates}
                </Link>
              </li>
              <li>
                <Link href="/iletisim" className="hover:text-[#FF69B4]">
                  {t.nav.contact}
                </Link>
              </li>
              <li>
                <Link href="/hesap-silme" className="hover:text-[#FF69B4]">
                  {locale === 'en' ? 'Delete Account & Data' : 'Hesap ve Veri Silme'}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-[var(--text-main)]">{t.footer.legalTitle}</h4>
            <ul className="mt-3 space-y-2.5 text-sm text-[var(--text-muted)]">
              {legalLinks.map((p) => (
                <li key={p.slug}>
                  <Link href={`/sayfa/${p.slug}`} className="hover:text-[#FF69B4]">
                    {locale === 'en' && p.titleEn ? p.titleEn : p.titleTr}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col justify-between gap-4 border-t border-[var(--border-soft)] pt-6 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} {t.brand}. {t.footer.rights}
          </p>
          <p className="max-w-lg sm:text-right">{t.footer.medicalNote}</p>
        </div>
      </div>
    </footer>
  );
}
