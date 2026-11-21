'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Locale } from '@/lib/api';
import { translations, getRouteMeta } from '@/lib/i18n';

interface AppContextValue {
  locale: Locale;
  setLocale: (loc: Locale) => void;
  t: (typeof translations)['tr'];
  dark: boolean;
  toggleDark: () => void;
  downloadOpen: boolean;
  openDownloadModal: () => void;
  closeDownloadModal: () => void;
  storeLinks: { ios: string; android: string };
}

const AppContext = createContext<AppContextValue | null>(null);

function syncDocumentSeo(pathname: string, locale: Locale) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.documentElement.setAttribute('lang', locale);

  const meta = getRouteMeta(pathname, locale);
  if (!pathname.startsWith('/kesfet/')) {
    document.title = meta.title;
  }

  let canonicalEl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', meta.canonical);
}

export function AppProvider({
  children,
  initialLocale = 'tr',
  storeLinks = { ios: 'https://apps.apple.com', android: 'https://play.google.com/store' },
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
  storeLinks?: { ios: string; android: string };
}) {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [dark, setDark] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);

  // Initialize locale & theme from URL / localStorage / cookie
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get('lang') || params.get('locale');
    const savedLocale = localStorage.getItem('web_locale') as Locale | null;
    const targetLocale: Locale =
      urlLang === 'en' || urlLang === 'tr'
        ? urlLang
        : savedLocale === 'en' || savedLocale === 'tr'
          ? savedLocale
          : initialLocale;

    setLocaleState(targetLocale);
    localStorage.setItem('web_locale', targetLocale);
    document.cookie = `web_locale=${targetLocale};path=/;max-age=31536000;SameSite=Lax`;
    syncDocumentSeo(pathname, targetLocale);

    if (targetLocale !== initialLocale) {
      router.refresh();
    }

    const savedTheme = localStorage.getItem('web_theme');
    if (savedTheme === 'dark') {
      setDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Keep <html lang>, <title>, and <link rel="canonical"> strictly synchronized on every route or locale change
  useEffect(() => {
    syncDocumentSeo(pathname, locale);

    const htmlEl = document.documentElement;
    const observer = new MutationObserver(() => {
      if (htmlEl.getAttribute('lang') !== locale) {
        htmlEl.setAttribute('lang', locale);
      }
    });
    observer.observe(htmlEl, { attributes: true, attributeFilter: ['lang'] });
    return () => observer.disconnect();
  }, [locale, pathname]);

  const setLocale = (loc: Locale) => {
    setLocaleState(loc);
    localStorage.setItem('web_locale', loc);
    document.cookie = `web_locale=${loc};path=/;max-age=31536000;SameSite=Lax`;
    syncDocumentSeo(pathname, loc);
    router.refresh();
  };

  const toggleDark = () => {
    setDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('web_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('web_theme', 'light');
      }
      return next;
    });
  };

  return (
    <AppContext.Provider
      value={{
        locale,
        setLocale,
        t: translations[locale],
        dark,
        toggleDark,
        downloadOpen,
        openDownloadModal: () => setDownloadOpen(true),
        closeDownloadModal: () => setDownloadOpen(false),
        storeLinks,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used inside AppProvider');
  }
  return ctx;
}
