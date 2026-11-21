import { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { pagesService } from '@/services/api';
import { CmsMarkdownView } from '@/components/CmsMarkdownView';

const OFFLINE_TERMS_FALLBACK = `## 1. Taraflar ve Hizmetin Kapsamı
Bu Kullanım Koşulları, **Kadın Atlası Dijital Sağlık ve Wellness Teknolojileri Yönetimi** tarafından sunulan Kadın Atlası mobil uygulaması ve \`kadinatlasi.com\` web sitesinin kullanım şartlarını düzenler.

## 2. Tıbbi Sorumluluk Reddi (Önemli Uyarı)
- Kadın Atlası tıbbi cihaz değildir; sunulan döngü/ovulasyon/gebelik hesaplamaları, makaleler ve NOVA AI yanıtları **tıbbi teşhis, tanı, tedavi veya doğum kontrol yöntemi yerine geçmez**.
- Sağlık sorunlarınızda mutlaka uzman bir hekime danışınız; acil durumlarda **112**'yi arayınız.

## 3. Üyelik, Yaş Sınırı (18+) ve NOVA AI Kotaları
- Platformu kullanmak için en az **18 yaşında** olmalısınız.
- Ücretsiz planda aylık **100 mesaj**, Premium planda aylık **1.000 mesaj** NOVA AI sohbet kotası tanımlanır.

## 4. Premium Abonelik ve İptal Koşulları
- Aylık (99 ₺) ve Yıllık (799 ₺ – 7 gün ücretsiz deneme) abonelikler App Store / Google Play üzerinden yönetilir ve dönem bitiminden en az 24 saat önce iptal edilmediği sürece otomatik yenilenir.

## 5. Uygulanacak Hukuk ve İletişim
Türkiye Cumhuriyeti kanunları geçerlidir; İstanbul Mahkemeleri yetkilidir. İletişim: **destek@kadinatlasi.com**, **hukuk@kadinatlasi.com**.`;

export default function TermsOfServiceScreen() {
    const router = useRouter();
    const theme = useTheme();
    const styles = createStyles(theme);

    const [title, setTitle] = useState('Kullanım Koşulları');
    const [content, setContent] = useState(OFFLINE_TERMS_FALLBACK);
    const [updatedAt, setUpdatedAt] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        pagesService
            .getBySlug('kullanim-kosullari')
            .then((data) => {
                if (mounted && data?.contentTr) {
                    setTitle(data.titleTr || 'Kullanım Koşulları');
                    setContent(data.contentTr);
                    setUpdatedAt(data.updatedAt);
                }
            })
            .catch(() => {
                // Keep offline fallback if network is unavailable
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
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {title}
                </Text>
                <View style={styles.headerRight} />
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
                {loading ? (
                    <View style={styles.loadingRow}>
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                        <Text style={styles.loadingText}>Güncel metin yükleniyor...</Text>
                    </View>
                ) : null}

                <View style={styles.card}>
                    <CmsMarkdownView content={content} updatedAt={updatedAt} />
                </View>

                <View style={styles.acceptanceBox}>
                    <Text style={styles.acceptanceText}>
                        Kadın Atlası uygulamasını kullanarak yukarıdaki Kullanım Koşullarını ve Tıbbi Sorumluluk Reddini okuduğunuzu ve kabul ettiğinizi beyan edersiniz.
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
            flex: 1,
            textAlign: 'center',
            marginHorizontal: theme.spacing.sm,
        },
        headerRight: {
            width: 48,
        },
        container: {
            flex: 1,
        },
        contentContainer: {
            padding: theme.spacing.lg,
            paddingBottom: 40,
        },
        loadingRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: theme.spacing.md,
            gap: 8,
        },
        loadingText: {
            fontSize: 13,
            color: theme.colors.textSecondary,
        },
        card: {
            backgroundColor: theme.colors.backgroundCard,
            borderRadius: 16,
            padding: theme.spacing.lg,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        acceptanceBox: {
            backgroundColor: theme.colors.primary + '15',
            borderRadius: 12,
            padding: theme.spacing.lg,
            marginTop: theme.spacing.lg,
            borderWidth: 1,
            borderColor: theme.colors.primary + '30',
        },
        acceptanceText: {
            fontSize: 13,
            color: theme.colors.text,
            lineHeight: 20,
            textAlign: 'center',
            fontWeight: '600',
        },
    });
