import { Suspense } from 'react';
import Providers from './providers';
import '@refinedev/antd/dist/reset.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NOVA Wellness Yönetim Paneli',
  description: 'NOVA Kadın Sağlığı & Wellness platform yönetim merkezi',
};

const themeBootScript = `
(function() {
  try {
    var m = localStorage.getItem('admin-color-mode');
    if (!m && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      m = 'dark';
    }
    if (m === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.style.colorScheme = 'dark';
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body style={{ margin: 0 }}>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <Suspense fallback={null}>
          <Providers>{children}</Providers>
        </Suspense>
      </body>
    </html>
  );
}
