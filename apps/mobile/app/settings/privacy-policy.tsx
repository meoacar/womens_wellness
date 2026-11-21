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

const OFFLINE_PRIVACY_FALLBACK = `## 1. Veri Sorumlusu ve Kapsam
6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") Madde 10 uyarınca Veri Sorumlusu **Kadın Atlası Dijital Sağlık ve Wellness Teknolojileri Yönetimi**'dir (İletişim: kvkk@kadinatlasi.com, destek@kadinatlasi.com).

## 2. Toplanan Kişisel ve Sağlık Verileri
- **Kimlik ve Hesap Bilgileri:** Ad, soyad, kullanıcı adı, e-posta adresi, doğum tarihi, şifrelenmiş parola.
- **Özel Nitelikli Sağlık ve Döngü Verileri (KVKK m. 6):** Açık rızanızla kaydettiğiniz regl döngüsü tarihleri, ovulasyon/doğurganlık penceresi, gebelik haftası, semptom, ruh hali, su, uyku, adım ve boy/kilo verileri.
- **Yapay Zeka (NOVA AI) Verileri:** Sohbet mesajları ve aylık kota sayaçları (Ücretsiz planda 100 mesaj/ay, Premium planda 1.000 mesaj/ay).

## 3. Verilerin İşlenme Amaçları ve AI İlkeleri
- Sağlık kayıtlarınız üçüncü taraf reklam ağlarına veya veri simsarlarına **satılmaz**.
- NOVA AI sohbet içerikleriniz genel yapay zeka modellerini eğitmek amacıyla **kullanılmaz**.
- *Profilim > KVKK İzinleri* ekranından açık rıza tercihlerinizi dilediğiniz zaman geri çekebilirsiniz.

## 4. Veri Saklama Süresi, İndirme ve Silme
- *Profilim > Veri ve Gizlilik > Verilerimi İndir (JSON)* adımıyla tüm verilerinizi indirebilirsiniz.
- Hesabınızı sildiğinizde tüm sağlık ve döngü kayıtlarınız aktif veritabanından **derhal**, şifreli sistem yedeklerinden **en geç 30 gün** içinde kalıcı olarak silinir.

## 5. KVKK Madde 11 Hakları ve Başvuru
KVKK kapsamındaki tüm taleplerinizi **kvkk@kadinatlasi.com** adresine veya uygulama içi Destek menüsünden iletebilirsiniz (en geç 30 gün içinde yanıtlanır).`;

export default function PrivacyPolicyScreen() {
    const router = useRouter();
    const theme = useTheme();
    const styles = createStyles(theme);

    const [title, setTitle] = useState('Gizlilik Politikası ve KVKK');
    const [content, setContent] = useState(OFFLINE_PRIVACY_FALLBACK);
    const [updatedAt, setUpdatedAt] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        pagesService
            .getBySlug('gizlilik-politikasi')
            .then((data) => {
                if (mounted && data?.contentTr) {
                    setTitle(data.titleTr || 'Gizlilik Politikası ve KVKK');
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
    });
