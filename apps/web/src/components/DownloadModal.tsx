'use client';

import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { useAppContext } from './AppContext';
import { AppleIcon, AndroidIcon, GooglePlayIcon } from './StoreIcons';

export function DownloadModal() {
  const { downloadOpen, closeDownloadModal, t, storeLinks } = useAppContext();

  if (!downloadOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={closeDownloadModal}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={closeDownloadModal}
          className="absolute right-4 top-4 rounded-full p-2 text-[var(--text-muted)] hover:bg-pink-50 dark:hover:bg-white/10"
          aria-label={t.downloadModal.close}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <img
            src="/images/mascots/Morning.png"
            alt="Kadın Atlası"
            className="h-28 w-28 object-contain"
          />
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#FFF0F5] px-3 py-1 text-xs font-bold text-[#E91E63] dark:bg-[#2a1936] dark:text-[#FF69B4]">
            <AppleIcon className="h-3.5 w-3.5" />
            <span>iOS &amp; Android</span>
            <AndroidIcon className="h-3.5 w-3.5 text-[#3DDC84]" />
          </span>
          <h3 className="mt-3 text-xl font-extrabold text-[var(--text-main)]">
            {t.downloadModal.title}
          </h3>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{t.downloadModal.subtitle}</p>

          <div className="mt-6 flex w-full flex-col gap-3">
            <a
              href={storeLinks.ios}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-2xl bg-[#1A1523] px-5 py-3.5 text-sm font-bold text-white transition hover:opacity-90 dark:bg-white dark:text-[#1A1523]"
            >
              <span className="flex items-center gap-2.5">
                <AppleIcon className="h-5 w-5 shrink-0" />
                {t.downloadModal.ios}
              </span>
              <ExternalLink className="h-4 w-4 opacity-70" />
            </a>

            <a
              href={storeLinks.android}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-[#FF69B4] to-[#D946EF] px-5 py-3.5 text-sm font-bold text-white transition hover:opacity-95"
            >
              <span className="flex items-center gap-2.5">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white">
                  <GooglePlayIcon className="h-4 w-4" />
                </span>
                {t.downloadModal.android}
              </span>
              <ExternalLink className="h-4 w-4 opacity-85" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
