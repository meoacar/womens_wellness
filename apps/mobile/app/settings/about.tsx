import { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Linking,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import appConfig from '../../app.json';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { pagesService } from '@/services/api';
import { CmsMarkdownView } from '@/components/CmsMarkdownView';

const OFFLINE_ABOUT_FALLBACK = `## 1. Kurumsal Kimlik ve İşletmeci Bilgileri
**Kadın Atlası** (\`kadinatlasi.com\` ve mobil uygulamaları), kadınların döngü sağlığı, doğurganlık, gebelik takibi ve günlük wellness alışkanlıklarını bilimsel rehberlik ve yüksek veri gizliliği standartlarıyla yönetebilmesi amacıyla geliştirilmiştir.

- **İşletmeci / Veri Sorumlusu:** Kadın Atlası Dijital Sağlık ve Wellness Teknolojileri Yönetimi (İstanbul, Türkiye)
- **Destek E-postası:** destek@kadinatlasi.com
- **KVKK Başvuru E-postası:** kvkk@kadinatlasi.com

## 2. Ekibimiz ve Tıbbi Yayın & İnceleme Kurulu
- **Dr. Ayşe Yılmaz:** Kadın Hastalıkları, Doğum ve Üreme Endokrinolojisi Editörlüğü
- **Uzm. Dyt. Elif Kaya:** Beslenme ve Diyetetik Editörlüğü
- **Uzm. Psk. Zeynep Demir:** Klinik Psikoloji ve Cinsel Sağlık Danışmanlığı
- **Kadın Atlası Tıbbi Yayın & İnceleme Kurulu:** ACOG, WHO, NHS ve NIH kılavuzları doğrultusunda içerik denetimi.`;

export default function AboutScreen() {
    const router = useRouter();
    const theme = useTheme();
    const styles = createStyles(theme);

    const appVersion = appConfig.expo.version || '1.3.0';
    const buildNumber = String(appConfig.expo.android?.versionCode || 4);

    const [aboutContent, setAboutContent] = useState(OFFLINE_ABOUT_FALLBACK);
    const [updatedAt, setUpdatedAt] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        pagesService
            .getBySlug('hakkimizda')
            .then((data) => {
                if (mounted && data?.contentTr) {
                    setAboutContent(data.contentTr);
                    setUpdatedAt(data.updatedAt);
                }
            })
            .catch(() => {
                // Keep offline fallback
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, []);

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>‹ Geri</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Hakkımızda & Künye</Text>
                <View style={styles.headerRight} />
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
                {/* App Logo & Name */}
                <View style={styles.logoSection}>
                    <View style={styles.logoContainer}>
                        <Text style={styles.logoEmoji}>🌸</Text>
                    </View>
                    <Text style={styles.appName}>Kadın Atlası</Text>
                    <Text style={styles.appTagline}>Döngü, Gebelik & Wellness Asistanı</Text>
                    <Text style={styles.versionText}>Versiyon {appVersion} ({buildNumber})</Text>
                </View>

                {/* Live CMS Corporate Content managed from Admin Panel */}
                <View style={styles.section}>
                    {loading ? (
                        <View style={styles.loadingRow}>
                            <ActivityIndicator size="small" color={theme.colors.primary} />
                            <Text style={styles.loadingText}>Kurumsal bilgiler yükleniyor...</Text>
                        </View>
                    ) : null}
                    <View style={styles.featureList}>
                        <CmsMarkdownView content={aboutContent} updatedAt={updatedAt} />
                    </View>
                </View>

                {/* Legal & Corporate Links */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Yasal Dokümanlar ve Bağlantılar</Text>

                    <TouchableOpacity
                        style={styles.linkItem}
                        onPress={() => Linking.openURL('https://kadinatlasi.com')}
                    >
                        <Text style={styles.linkIcon}>🌐</Text>
                        <Text style={styles.linkText}>Resmi Web Sitesi (kadinatlasi.com)</Text>
                        <Text style={styles.linkArrow}>›</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.linkItem}
                        onPress={() => router.push('/settings/kvkk-consent')}
                    >
                        <Text style={styles.linkIcon}>🔐</Text>
                        <Text style={styles.linkText}>KVKK Aydınlatma ve Açık Rıza İzinleri</Text>
                        <Text style={styles.linkArrow}>›</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.linkItem}
                        onPress={() => router.push('/settings/privacy-policy')}
                    >
                        <Text style={styles.linkIcon}>🔒</Text>
                        <Text style={styles.linkText}>Gizlilik Politikası ve KVKK Metni</Text>
                        <Text style={styles.linkArrow}>›</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.linkItem}
                        onPress={() => router.push('/settings/terms-of-service')}
                    >
                        <Text style={styles.linkIcon}>📄</Text>
                        <Text style={styles.linkText}>Kullanım Koşulları ve Tıbbi Uyarı</Text>
                        <Text style={styles.linkArrow}>›</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.linkItem}
                        onPress={() => Linking.openURL('mailto:destek@kadinatlasi.com')}
                    >
                        <Text style={styles.linkIcon}>✉️</Text>
                        <Text style={styles.linkText}>İletişim: destek@kadinatlasi.com</Text>
                        <Text style={styles.linkArrow}>›</Text>
                    </TouchableOpacity>
                </View>

                {/* Copyright */}
                <View style={styles.copyrightSection}>
                    <Text style={styles.copyrightText}>
                        © {new Date().getFullYear()} Kadın Atlası (kadinatlasi.com)
                    </Text>
                    <Text style={styles.copyrightText}>
                        Tüm hakları saklıdır.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (theme: any) =>
    StyleSheet.create({
        safeArea: {
            flex: 1,
            backgroundColor: theme.colors.background,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
        },
        backButton: {
            padding: theme.spacing.xs,
        },
        backButtonText: {
            fontSize: 20,
            color: theme.colors.primary,
            fontWeight: '600',
        },
        headerTitle: {
            fontSize: 17,
            fontWeight: '700',
            color: theme.colors.text,
        },
        headerRight: {
            width: 48,
        },
        container: {
            flex: 1,
        },
        contentContainer: {
            paddingBottom: 40,
        },
        logoSection: {
            alignItems: 'center',
            paddingVertical: theme.spacing.lg,
        },
        logoContainer: {
            width: 84,
            height: 84,
            borderRadius: 42,
            backgroundColor: theme.colors.primary + '20',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: theme.spacing.sm,
        },
        logoEmoji: {
            fontSize: 42,
        },
        appName: {
            fontSize: 26,
            fontWeight: '800',
            color: theme.colors.text,
            marginBottom: 2,
        },
        appTagline: {
            fontSize: 15,
            fontWeight: '600',
            color: theme.colors.primary,
            marginBottom: 4,
        },
        versionText: {
            fontSize: 13,
            color: theme.colors.textSecondary,
        },
        section: {
            marginTop: theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
        },
        sectionTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: theme.spacing.md,
        },
        loadingRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: theme.spacing.sm,
            gap: 8,
        },
        loadingText: {
            fontSize: 13,
            color: theme.colors.textSecondary,
        },
        featureList: {
            backgroundColor: theme.colors.backgroundCard,
            borderRadius: 16,
            padding: theme.spacing.lg,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        linkItem: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.backgroundCard,
            borderRadius: 12,
            padding: theme.spacing.md,
            marginBottom: theme.spacing.sm,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        linkIcon: {
            fontSize: 22,
            marginRight: theme.spacing.md,
        },
        linkText: {
            flex: 1,
            fontSize: 15,
            fontWeight: '600',
            color: theme.colors.text,
        },
        linkArrow: {
            fontSize: 22,
            color: theme.colors.textSecondary,
        },
        copyrightSection: {
            alignItems: 'center',
            marginTop: theme.spacing.xl,
            paddingVertical: theme.spacing.lg,
        },
        copyrightText: {
            fontSize: 12,
            color: theme.colors.textSecondary,
            marginVertical: 2,
        },
    });
