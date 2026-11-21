'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Moon, Sun, Menu, X, Smartphone, Globe } from 'lucide-react';
import { useAppContext } from './AppContext';

export function Navbar() {
  const pathname = usePathname();
  const { locale, setLocale, t, dark, toggleDark, openDownloadModal } = useAppContext();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: '/', label: t.nav.home },
    { href: '/hesaplayicilar', label: t.nav.calculators },
    { href: '/kesfet', label: t.nav.discover },
    { href: '/premium', label: t.nav.premium },
    { href: '/iletisim', label: t.nav.contact },
  ];

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const langAriaLabel = t.nav.ariaSwitchLang;
  const themeAriaLabel = dark ? t.nav.ariaThemeLight : t.nav.ariaThemeDark;
  const menuAriaLabel = mobileOpen ? t.nav.ariaMenuClose : t.nav.ariaMenuOpen;

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-soft)] bg-white/85 backdrop-blur-md dark:bg-[#120e1a]/85">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src="/images/mascots/2.png"
            alt={t.brand}
            className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#FFF0F5] to-[#F3E8FF] p-1 shadow-sm ring-1 ring-pink-200/60 object-contain dark:from-[#2a1936] dark:to-[#1f1630] dark:ring-pink-900/40"
          />
          <span className="bg-gradient-to-r from-[#FF69B4] to-[#7C3AED] bg-clip-text text-lg font-extrabold tracking-tight text-transparent">
            {t.brand}
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav
          aria-label={locale === 'tr' ? 'Ana gezinme menüsü' : 'Primary navigation'}
          className="hidden items-center gap-1 md:flex"
        >
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                isActive(item.href)
                  ? 'bg-[#FFF0F5] text-[#E91E63] dark:bg-[#2a1936] dark:text-[#FF69B4]'
                  : 'text-[var(--text-muted)] hover:bg-[#FFF0F5]/60 hover:text-[var(--text-main)] dark:hover:bg-[#241b35]'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLocale(locale === 'tr' ? 'en' : 'tr')}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border-soft)] px-2.5 py-1.5 text-xs font-bold text-[var(--text-main)] transition hover:border-[#FF69B4]"
            aria-label={langAriaLabel}
            title={langAriaLabel}
          >
            <Globe className="h-3.5 w-3.5 text-[#FF69B4]" aria-hidden="true" />
            <span>{locale.toUpperCase()}</span>
          </button>

          <button
            type="button"
            onClick={toggleDark}
            className="rounded-xl border border-[var(--border-soft)] p-2 text-[var(--text-main)] transition hover:border-[#FF69B4]"
            aria-label={themeAriaLabel}
            title={themeAriaLabel}
          >
            {dark ? (
              <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4 text-[#7C3AED]" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={openDownloadModal}
            className="hidden items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF69B4] to-[#D946EF] px-4 py-2 text-sm font-bold text-white shadow-md shadow-pink-500/20 transition hover:opacity-95 sm:flex"
          >
            <Smartphone className="h-4 w-4" aria-hidden="true" />
            <span>{t.nav.download}</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((p) => !p)}
            className="rounded-xl border border-[var(--border-soft)] p-2 text-[var(--text-main)] md:hidden"
            aria-label={menuAriaLabel}
            title={menuAriaLabel}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation-drawer"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div
          id="mobile-navigation-drawer"
          className="border-t border-[var(--border-soft)] bg-[var(--bg-card)] px-4 py-4 md:hidden"
        >
          <div className="flex flex-col gap-1.5">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                  isActive(item.href)
                    ? 'bg-[#FFF0F5] text-[#E91E63] dark:bg-[#2a1936] dark:text-[#FF69B4]'
                    : 'text-[var(--text-main)]'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                openDownloadModal();
              }}
              className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF69B4] to-[#D946EF] px-4 py-3 text-sm font-bold text-white"
            >
              <Smartphone className="h-4 w-4" aria-hidden="true" />
              <span>{t.nav.download}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
