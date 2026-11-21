'use client';

import { Refine } from '@refinedev/core';
import { RefineThemes, ThemedLayoutV2, useNotificationProvider } from '@refinedev/antd';
import {
  App as AntdApp,
  ConfigProvider,
  Spin,
  Space,
  Typography,
  Layout,
  Switch,
  Tag,
  theme as antdTheme,
} from 'antd';
import trTR from 'antd/locale/tr_TR';
import routerProvider from '@refinedev/nextjs-router';
import { dataProvider } from '@/providers/dataProvider';
import { authProvider } from '@/providers/authProvider';
import { AdminThemeProvider, useAdminTheme } from '@/providers/themeContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { initSentry } from '@/lib/sentry';
import { usePathname, useRouter } from 'next/navigation';
import {
  UserOutlined,
  SettingOutlined,
  DashboardOutlined,
  BellOutlined,
  CrownOutlined,
  QuestionCircleOutlined,
  BookOutlined,
  HeartOutlined,
  BulbOutlined,
  TrophyOutlined,
  BarChartOutlined,
  TeamOutlined,
  DollarOutlined,
  StarOutlined,
  SafetyCertificateOutlined,
  RiseOutlined,
  MoonOutlined,
  SunOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

const trTranslations: Record<string, string> = {
  'buttons.create': 'Oluştur',
  'buttons.save': 'Kaydet',
  'buttons.logout': 'Çıkış Yap',
  'buttons.delete': 'Sil',
  'buttons.edit': 'Düzenle',
  'buttons.cancel': 'İptal',
  'buttons.confirm': 'Emin misiniz?',
  'buttons.filter': 'Filtrele',
  'buttons.clear': 'Temizle',
  'buttons.refresh': 'Yenile',
  'buttons.show': 'Görüntüle',
  'buttons.undo': 'Geri Al',
  'buttons.import': 'İçe Aktar',
  'buttons.export': 'Dışa Aktar',
  'buttons.clone': 'Kopyala',
  'buttons.notAccessTitle': 'Erişim izniniz yok',
  'actions.list': 'Liste',
  'actions.create': 'Oluştur',
  'actions.edit': 'Düzenle',
  'actions.show': 'Detay',
  'table.actions': 'İşlemler',
  'table.inTotal': 'Toplam',
  'warnWhenUnsavedChanges': 'Kaydedilmemiş değişiklikleriniz var. Çıkmak istediğinize emin misiniz?',
  'notifications.success': 'İşlem Başarılı',
  'notifications.error': 'Hata oluştu (kod: {{statusCode}})',
  'notifications.undoable': 'İşlemi geri almak için {{seconds}} saniyeniz var.',
  'notifications.createSuccess': '{{resource}} başarıyla oluşturuldu',
  'notifications.createError': '{{resource}} oluşturulurken hata oluştu (kod: {{statusCode}})',
  'notifications.deleteSuccess': '{{resource}} başarıyla silindi',
  'notifications.deleteError': '{{resource}} silinirken hata oluştu (kod: {{statusCode}})',
  'notifications.editSuccess': '{{resource}} başarıyla güncellendi',
  'notifications.editError': '{{resource}} güncellenirken hata oluştu (kod: {{statusCode}})',
  'notifications.importProgress': 'İçe aktarılıyor: {{processed}}/{{total}}',
  'pages.login.title': 'Yönetici Girişi',
  'pages.login.signin': 'Giriş Yap',
  'pages.login.fields.email': 'E-posta',
  'pages.login.fields.password': 'Şifre',
  'pages.login.buttons.rememberMe': 'Beni Hatırla',
  'pages.login.buttons.forgotPassword': 'Şifremi Unuttum',
  'pages.login.buttons.noAccount': 'Hesabınız yok mu?',
  'pages.login.signup': 'Kayıt Ol',
  'loading': 'Yükleniyor...',
};

const i18nProvider = {
  translate: (key: string, options?: any, defaultMessage?: string) => {
    let text = trTranslations[key] || defaultMessage || key;
    if (options && typeof options === 'object') {
      Object.keys(options).forEach((k) => {
        text = text.replace(new RegExp(`{{${k}}}`, 'g'), String(options[k]));
      });
    }
    return text;
  },
  changeLocale: async () => {},
  getLocale: () => 'tr',
};

function BrandTitle({ collapsed }: { collapsed: boolean }) {
  return (
    <Space size={10} style={{ display: 'flex', alignItems: 'center' }}>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <SafetyCertificateOutlined style={{ color: '#fff', fontSize: 16 }} />
      </div>
      {!collapsed && (
        <Text strong style={{ fontSize: 15, letterSpacing: '-0.2px' }}>
          NOVA Admin
        </Text>
      )}
    </Space>
  );
}

function AdminHeader() {
  const { isDark, toggleTheme } = useAdminTheme();
  const { token } = antdTheme.useToken();
  const [adminEmail, setAdminEmail] = useState<string>('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw);
        setAdminEmail(parsed?.email || parsed?.username || '');
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  return (
    <Layout.Header
      style={{
        backgroundColor: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: '0 24px',
        height: 58,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <Space size={14} align="center">
        <div
          onClick={toggleTheme}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') toggleTheme();
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 12px',
            borderRadius: 999,
            border: `1px solid ${token.colorBorder}`,
            background: token.colorFillQuaternary,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          {isDark ? (
            <MoonOutlined style={{ color: '#a78bfa', fontSize: 14 }} />
          ) : (
            <SunOutlined style={{ color: '#f59e0b', fontSize: 14 }} />
          )}
          <Text style={{ fontSize: 12.5, fontWeight: 600 }}>
            {isDark ? 'Karanlık Mod' : 'Aydınlık Mod'}
          </Text>
          <Switch
            size="small"
            checked={isDark}
            onChange={toggleTheme}
          />
        </div>

        {adminEmail && (
          <Tag
            icon={<UserOutlined />}
            color={isDark ? 'purple' : 'default'}
            style={{ margin: 0, padding: '3px 10px', borderRadius: 999 }}
          >
            {adminEmail}
          </Tag>
        )}
      </Space>
    </Layout.Header>
  );
}

function AdminSessionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token } = antdTheme.useToken();
  const [status, setStatus] = useState<'checking' | 'allowed' | 'redirecting'>('checking');

  const isLoginRoute = pathname === '/login';

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      if (isLoginRoute) {
        const accessToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (accessToken) {
          const res = await authProvider.check();
          if (!cancelled && res.authenticated) {
            setStatus('redirecting');
            router.replace('/');
            return;
          }
        }
        if (!cancelled) setStatus('allowed');
        return;
      }

      setStatus('checking');
      const res = await authProvider.check();
      if (cancelled) return;
      if (!res.authenticated) {
        setStatus('redirecting');
        router.replace('/login');
        return;
      }
      setStatus('allowed');
    };

    verify();
    return () => {
      cancelled = true;
    };
  }, [pathname, isLoginRoute, router]);

  if (status !== 'allowed') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: token.colorBgLayout,
        }}
      >
        <Spin size="large" tip="Oturum doğrulanıyor..." />
      </div>
    );
  }

  if (isLoginRoute) {
    return <>{children}</>;
  }

  return (
    <ThemedLayoutV2 Title={BrandTitle} Header={AdminHeader}>
      {children}
    </ThemedLayoutV2>
  );
}

function ThemedAdminShell({ children }: { children: React.ReactNode }) {
  const { isDark } = useAdminTheme();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          ...RefineThemes.Purple,
          algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          token: {
            colorPrimary: isDark ? '#9d7aff' : '#7C3AED',
            borderRadius: 10,
            ...(isDark
              ? {
                  colorBgLayout: '#0f1117',
                  colorBgContainer: '#171a23',
                  colorBgElevated: '#1e222d',
                  colorBorder: '#272c3a',
                  colorBorderSecondary: '#202533',
                  colorText: '#e6e8f0',
                  colorTextSecondary: '#9ca3af',
                }
              : {
                  colorBgLayout: '#f5f6fa',
                }),
          },
        }}
        locale={trTR}
      >
        <AntdApp>
          <Refine
            routerProvider={routerProvider}
            dataProvider={dataProvider}
            authProvider={authProvider}
            notificationProvider={useNotificationProvider}
            i18nProvider={i18nProvider}
            resources={[
              {
                name: 'dashboard',
                list: '/',
                meta: {
                  label: 'Kontrol Paneli',
                  icon: <DashboardOutlined />,
                },
              },
              {
                name: 'users',
                list: '/users',
                create: '/users/create',
                edit: '/users/edit/:id',
                show: '/users/show/:id',
                meta: {
                  label: 'Kullanıcılar',
                  icon: <UserOutlined />,
                },
              },
              {
                name: 'user-segmentation',
                list: '/user-segmentation',
                meta: {
                  label: 'Segmentasyon',
                  icon: <TeamOutlined />,
                },
              },
              {
                name: 'retention',
                list: '/retention',
                meta: {
                  label: 'Retention & Win-Back',
                  icon: <RiseOutlined />,
                },
              },
              {
                name: 'subscriptions-group',
                meta: {
                  label: 'Abonelik & Premium',
                  icon: <CrownOutlined />,
                },
              },
              {
                name: 'subscriptions',
                list: '/subscriptions',
                show: '/subscriptions/show/:id',
                meta: {
                  label: 'Kullanıcı Abonelikleri',
                  parent: 'subscriptions-group',
                },
              },
              {
                name: 'subscriptions/paywall',
                list: '/subscriptions/paywall',
                meta: {
                  label: 'Premium Sayfası & Fiyatlar',
                  parent: 'subscriptions-group',
                },
              },
              {
                name: 'financial-dashboard',
                list: '/financial-dashboard',
                meta: {
                  label: 'Finansal Panel',
                  icon: <DollarOutlined />,
                },
              },
              {
                name: 'qna',
                meta: {
                  label: 'Topluluk Yönetimi',
                  icon: <QuestionCircleOutlined />,
                },
              },
              {
                name: 'qna/overview',
                list: '/qna/overview',
                meta: {
                  label: 'Genel Bakış',
                  parent: 'qna',
                },
              },
              {
                name: 'qna/questions',
                list: '/qna/questions',
                create: '/qna/questions/create',
                edit: '/qna/questions/edit/:id',
                show: '/qna/questions/show/:id',
                meta: {
                  label: 'Sorular & Konular',
                  parent: 'qna',
                },
              },
              {
                name: 'qna/answers',
                list: '/qna/answers',
                show: '/qna/answers/show/:id',
                edit: '/qna/answers/edit/:id',
                meta: {
                  label: 'Cevaplar',
                  parent: 'qna',
                },
              },
              {
                name: 'qna/reports',
                list: '/qna/reports',
                show: '/qna/reports/show/:id',
                meta: {
                  label: 'Moderasyon Raporları',
                  parent: 'qna',
                },
              },
              {
                name: 'content',
                meta: {
                  label: 'İçerik Yönetimi',
                  icon: <BookOutlined />,
                },
              },
              {
                name: 'content/articles',
                list: '/content/articles',
                create: '/content/articles/create',
                edit: '/content/articles/edit/:id',
                meta: {
                  label: 'Makaleler',
                  parent: 'content',
                },
              },
              {
                name: 'content/pages',
                list: '/pages',
                meta: {
                  label: 'Statik & Yasal Sayfalar',
                  parent: 'content',
                },
              },
              {
                name: 'astrology',
                meta: {
                  label: 'Astroloji Yönetimi',
                  icon: <StarOutlined />,
                },
              },
              {
                name: 'astrology/cosmic',
                list: '/astrology/cosmic',
                meta: {
                  label: 'Kozmik Gökyüzü & Ay',
                  parent: 'astrology',
                },
              },
              {
                name: 'astrology/horoscopes',
                list: '/astrology/horoscopes',
                create: '/astrology/horoscopes/create',
                edit: '/astrology/horoscopes/edit/:id',
                meta: {
                  label: 'Burç Yorumları',
                  parent: 'astrology',
                },
              },
              {
                name: 'gamification',
                meta: {
                  label: 'Başarım & İçgörü',
                  icon: <TrophyOutlined />,
                },
              },
              {
                name: 'gamification/badges',
                list: '/gamification/badges',
                meta: {
                  label: 'Başarımlar & Rozetler',
                  parent: 'gamification',
                },
              },
              {
                name: 'gamification/insights',
                list: '/gamification/insights',
                meta: {
                  label: 'İçgörüler & İpuçları',
                  parent: 'gamification',
                },
              },
              {
                name: 'health',
                meta: {
                  label: 'Sağlık Takibi',
                  icon: <HeartOutlined />,
                },
              },
              {
                name: 'health/cycles',
                list: '/health/cycles',
                show: '/health/cycles/show/:id',
                meta: {
                  label: 'Regl Döngüleri',
                  parent: 'health',
                },
              },
              {
                name: 'health/pregnancy',
                list: '/health/pregnancy',
                show: '/health/pregnancy/show/:id',
                meta: {
                  label: 'Hamilelik',
                  parent: 'health',
                },
              },
              {
                name: 'health/postpartum',
                list: '/health/postpartum',
                meta: {
                  label: 'Anne & Bebek (Lohusalık)',
                  parent: 'health',
                },
              },
              {
                name: 'health/wellness',
                list: '/health/wellness',
                meta: {
                  label: 'Wellness Verileri',
                  parent: 'health',
                },
              },
              {
                name: 'notifications-group',
                meta: {
                  label: 'Bildirim & Hatırlatıcılar',
                  icon: <BellOutlined />,
                },
              },
              {
                name: 'reminders',
                list: '/reminders',
                meta: {
                  label: 'Kullanıcı Hatırlatıcıları',
                  parent: 'notifications-group',
                },
              },
              {
                name: 'period-notifications',
                list: '/reminders/period-messages',
                meta: {
                  label: 'Regl Dönemi Bildirimleri',
                  parent: 'notifications-group',
                },
              },
              {
                name: 'ai',
                meta: {
                  label: 'NOVA & AI Yönetimi',
                  icon: <BulbOutlined />,
                },
              },
              {
                name: 'ai-analytics',
                list: '/ai-analytics',
                meta: {
                  label: 'AI Analitiği',
                  parent: 'ai',
                  icon: <BarChartOutlined />,
                },
              },
              {
                name: 'ai-providers',
                list: '/ai/providers',
                create: '/ai/providers/create',
                edit: '/ai/providers/edit/:id',
                meta: {
                  label: 'AI Sağlayıcıları',
                  parent: 'ai',
                },
              },
              {
                name: 'ai/model-policies',
                list: '/ai/model-policies',
                create: '/ai/model-policies/create',
                edit: '/ai/model-policies/edit/:id',
                meta: {
                  label: 'Model Politikaları',
                  parent: 'ai',
                },
              },
              {
                name: 'ai/quotas',
                list: '/ai/quotas',
                meta: {
                  label: 'NOVA Limitleri & Kotalar',
                  parent: 'ai',
                },
              },
              {
                name: 'system',
                meta: {
                  label: 'Sistem',
                  icon: <SettingOutlined />,
                },
              },
              {
                name: 'system/feature-flags',
                list: '/system/feature-flags',
                edit: '/system/feature-flags/edit/:id',
                meta: {
                  label: 'Özellik Bayrakları',
                  parent: 'system',
                },
              },
              {
                name: 'system/audit-logs',
                list: '/system/audit-logs',
                meta: {
                  label: 'Denetim Kayıtları',
                  parent: 'system',
                },
              },
              {
                name: 'support',
                list: '/support',
                meta: {
                  label: 'Destek Talepleri',
                  parent: 'system',
                },
              },
            ]}
            options={{
              syncWithLocation: true,
              warnWhenUnsavedChanges: true,
              projectId: 'wellness-admin',
            }}
          >
            <AdminSessionGate>{children}</AdminSessionGate>
          </Refine>
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initSentry();
  }, []);

  return (
    <AdminThemeProvider>
      <ThemedAdminShell>{children}</ThemedAdminShell>
    </AdminThemeProvider>
  );
}
