import { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Platform,
    Linking,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { usePremium } from '@/hooks/usePremium';
import { PremiumBadge } from '@/components/premium/PremiumBadge';
import { TierSelector } from '@/components/premium/TierSelector';
import { FeaturesComparison } from '@/components/premium/FeaturesComparison';
import { BenefitsSection } from '@/components/premium/BenefitsSection';
import { FAQSection } from '@/components/premium/FAQSection';
import { subscriptionService } from '@/services/api';
import { iapManager } from '@/services/iap.wrapper';
import type { SubscriptionTier, PremiumPaywallConfig } from '@/types/subscription';

export default function PremiumScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ tier?: string; fromOnboarding?: string }>();
    const theme = useTheme();
    const queryClient = useQueryClient();
    const { subscription, isPremium, isLoading } = usePremium();
    const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(
        params.tier === 'MONTHLY' ? 'MONTHLY' : 'YEARLY',
    );
    const [isPurchasing, setIsPurchasing] = useState(false);

    const { data: paywallConfig } = useQuery<PremiumPaywallConfig>({
        queryKey: ['subscription', 'paywall-config'],
        queryFn: () => subscriptionService.getPaywallConfig(),
        staleTime: 60 * 1000,
        refetchOnMount: 'always',
    });

    const { data: products } = useQuery({
        queryKey: ['products', Platform.OS],
        queryFn: () => subscriptionService.getProducts(Platform.OS as 'ios' | 'android'),
    });

    useEffect(() => {
        if (params.tier === 'MONTHLY' || params.tier === 'YEARLY') {
            setSelectedTier(params.tier);
            return;
        }
        if (paywallConfig?.defaultSelectedTier) {
            const preferred = paywallConfig.defaultSelectedTier;
            if (paywallConfig.plans?.[preferred]?.isActive !== false) {
                setSelectedTier(preferred);
            } else {
                const fallback: SubscriptionTier = preferred === 'YEARLY' ? 'MONTHLY' : 'YEARLY';
                setSelectedTier(fallback);
            }
        }
    }, [paywallConfig?.defaultSelectedTier, paywallConfig?.plans]);

    const monthlyProduct = products?.find((p) => p.productId.toLowerCase().includes('monthly'));
    const yearlyProduct = products?.find((p) => p.productId.toLowerCase().includes('yearly'));

    const monthlyPlan = paywallConfig?.plans?.MONTHLY;
    const yearlyPlan = paywallConfig?.plans?.YEARLY;

    const monthlyPrice = monthlyPlan
        ? `${monthlyPlan.currencySymbol || '₺'}${monthlyPlan.price}`
        : monthlyProduct?.localizedPrice || monthlyProduct?.price || '₺99';
    const yearlyPrice = yearlyPlan
        ? `${yearlyPlan.currencySymbol || '₺'}${yearlyPlan.price}`
        : yearlyProduct?.localizedPrice || yearlyProduct?.price || '₺999';
    const selectedPrice = selectedTier === 'YEARLY' ? yearlyPrice : monthlyPrice;
    const activePlan = selectedTier === 'YEARLY' ? yearlyPlan : monthlyPlan;

    const heroEyebrow = paywallConfig?.heroEyebrow || 'KADIN SAĞLIĞI ASİSTANI';
    const heroTitle = paywallConfig?.heroTitle || "NOVA Premium'a Geç";
    const heroSubtitle =
        paywallConfig?.heroSubtitle ||
        'Gelişmiş AI hafızası, kişisel sağlık içgörüleri ve yüksek mesaj kotasıyla sağlığını bir üst seviyeye taşı.';
    const heroHighlights =
        paywallConfig?.heroHighlights?.length
            ? paywallConfig.heroHighlights
            : ['1000+ Mesaj', 'Kişisel İçgörü', 'Astroloji'];
    const showTrialBanner =
        !isPremium &&
        !subscription?.hasHadTrial &&
        (paywallConfig?.trialEnabled ?? true);

    const styles = createStyles(theme);

    const handlePurchase = async () => {
        if (isPurchasing) return;

        setIsPurchasing(true);
        try {
            if (!iapManager.isReady()) {
                await iapManager.initialize();
            }

            await iapManager.purchase(selectedTier);

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['subscription'] }),
                queryClient.invalidateQueries({ queryKey: ['nova', 'quota'] }),
                queryClient.invalidateQueries({ queryKey: ['usage-stats'] }),
            ]);

            router.push('/premium/success');
        } catch (error: any) {
            console.error('Purchase error:', error);

            if (error.name === 'IAPServiceError') {
                const userMessage = error.getUserMessage ? error.getUserMessage() : error.message;

                if (error.code === 'USER_CANCELLED') {
                    return;
                }

                if (error.code === 'ALREADY_OWNED') {
                    Alert.alert('Zaten Sahipsiniz', userMessage, [
                        { text: 'İptal', style: 'cancel' },
                        { text: 'Geri Yükle', onPress: handleRestore },
                    ]);
                    return;
                }

                if (error.code === 'NETWORK_ERROR' || error.isRecoverable?.()) {
                    Alert.alert('Bağlantı Hatası', userMessage, [
                        { text: 'İptal', style: 'cancel' },
                        { text: 'Tekrar Dene', onPress: handlePurchase },
                    ]);
                    return;
                }

                if (error.requiresUserAction?.()) {
                    Alert.alert('İşlem Gerekli', userMessage, [
                        { text: 'Tamam' },
                        {
                            text: 'Ayarlar',
                            onPress: () => {
                                if (Platform.OS === 'ios') {
                                    Linking.openURL('app-settings:');
                                } else {
                                    Linking.openSettings();
                                }
                            },
                        },
                    ]);
                    return;
                }

                Alert.alert('Satın Alma Başarısız', userMessage, [{ text: 'Tamam' }]);
            } else {
                Alert.alert(
                    'Hata',
                    error.message || 'Bir hata oluştu. Lütfen tekrar deneyin.',
                    [{ text: 'Tamam' }],
                );
            }
        } finally {
            setIsPurchasing(false);
        }
    };

    const handleRestore = async () => {
        if (isPurchasing) return;
        setIsPurchasing(true);
        try {
            if (!iapManager.isReady()) {
                await iapManager.initialize();
            }

            const restoredPurchases = await iapManager.restorePurchases();

            if (restoredPurchases.length === 0) {
                Alert.alert(
                    'Satın Alım Bulunamadı',
                    'Geri yüklenecek satın alım bulunamadı. Daha önce satın aldıysanız aynı Apple ID veya Google hesabıyla giriş yaptığınızdan emin olun.',
                    [{ text: 'Tamam' }],
                );
            } else {
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ['subscription'] }),
                    queryClient.invalidateQueries({ queryKey: ['nova', 'quota'] }),
                    queryClient.invalidateQueries({ queryKey: ['usage-stats'] }),
                ]);

                Alert.alert('Başarılı!', 'Satın alımlarınız geri yüklendi.', [
                    { text: 'Tamam', onPress: () => router.push('/(tabs)/home') },
                ]);
            }
        } catch (error: any) {
            console.error('Restore error:', error);

            if (error.name === 'IAPServiceError') {
                const userMessage = error.getUserMessage ? error.getUserMessage() : error.message;
                if (error.code === 'NETWORK_ERROR' || error.isRecoverable?.()) {
                    Alert.alert('Bağlantı Hatası', userMessage, [
                        { text: 'İptal', style: 'cancel' },
                        { text: 'Tekrar Dene', onPress: handleRestore },
                    ]);
                    return;
                }
                Alert.alert('Geri Yükleme Başarısız', userMessage, [{ text: 'Tamam' }]);
            } else {
                Alert.alert(
                    'Hata',
                    error.message || 'Geri yükleme başarısız oldu. Lütfen tekrar deneyin.',
                    [{ text: 'Tamam' }],
                );
            }
        } finally {
            setIsPurchasing(false);
        }
    };

    const handleManageSubscription = () => {
        const url =
            Platform.OS === 'ios'
                ? 'https://apps.apple.com/account/subscriptions'
                : 'https://play.google.com/store/account/subscriptions';

        Linking.openURL(url);
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={styles.loadingText}>Üyelik bilgileri yükleniyor...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Top Bar */}
            <View style={styles.topBar}>
                <TouchableOpacity
                    onPress={() => {
                        if (params.fromOnboarding === '1') {
                            router.replace('/(tabs)/home');
                        } else {
                            router.back();
                        }
                    }}
                    style={styles.iconBtn}
                    activeOpacity={0.7}
                >
                    <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.topBarTitle}>NOVA Premium</Text>
                {!isPremium ? (
                    <TouchableOpacity onPress={handleRestore} disabled={isPurchasing} style={styles.restorePill}>
                        <Text style={styles.restorePillText}>Geri Yükle</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.iconPlaceholder} />
                )}
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    !isPremium && { paddingBottom: 150 },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero Banner */}
                <LinearGradient
                    colors={[theme.colors.primary, theme.colors.primaryDark || '#6D28D9', '#EC4899']}
                    style={styles.heroCard}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.heroPill}>
                        <Ionicons name="sparkles" size={13} color="#FDE047" />
                        <Text style={styles.heroPillText}>
                            {isPremium ? 'AKTİF ÜYELİK' : heroEyebrow}
                        </Text>
                    </View>
                    <Text style={styles.heroTitle}>
                        {isPremium ? 'Premium Deneyimin Aktif' : heroTitle}
                    </Text>
                    <Text style={styles.heroSubtitle}>
                        {isPremium
                            ? 'Gelişmiş AI yanıtları, kişisel içgörüler ve derin astroloji rehberliği açık.'
                            : heroSubtitle}
                    </Text>

                    <View style={styles.heroHighlights}>
                        {heroHighlights.slice(0, 3).map((highlight, idx) => (
                            <View key={`${highlight}-${idx}`} style={styles.highlightChip}>
                                <Ionicons
                                    name={idx === 0 ? 'chatbubbles' : idx === 1 ? 'bulb' : 'planet'}
                                    size={13}
                                    color="#FFFFFF"
                                />
                                <Text style={styles.highlightText}>{highlight}</Text>
                            </View>
                        ))}
                    </View>
                </LinearGradient>

                {/* Current Status Card (if premium) */}
                {isPremium && subscription && (
                    <View style={styles.statusCard}>
                        <View style={styles.statusHeader}>
                            <PremiumBadge size="medium" variant="full" />
                            <Text style={styles.statusTitle}>Üyelik Detayları</Text>
                        </View>
                        <View style={styles.statusDetails}>
                            <View style={styles.statusRow}>
                                <Text style={styles.statusLabel}>Plan</Text>
                                <Text style={styles.statusValue}>
                                    {subscription.tier === 'YEARLY' ? 'Yıllık Premium' : 'Aylık Premium'}
                                </Text>
                            </View>
                            <View style={styles.statusRow}>
                                <Text style={styles.statusLabel}>Yenileme Tarihi</Text>
                                <Text style={styles.statusValue}>
                                    {subscription.endDate
                                        ? new Date(subscription.endDate).toLocaleDateString('tr-TR', {
                                              day: 'numeric',
                                              month: 'long',
                                              year: 'numeric',
                                          })
                                        : '—'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.statusActions}>
                            <TouchableOpacity
                                style={styles.statsButton}
                                onPress={() => router.push('/premium/stats' as any)}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="bar-chart-outline" size={17} color="#FFFFFF" />
                                <Text style={styles.statsButtonText}>Kullanım İstatistikleri</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.manageButton}
                                onPress={handleManageSubscription}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="settings-outline" size={17} color={theme.colors.primary} />
                                <Text style={styles.manageButtonText}>Aboneliği Yönet</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Tier Selector */}
                {!isPremium && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Planını Seç</Text>
                        <TierSelector
                            selectedTier={selectedTier}
                            onSelectTier={setSelectedTier}
                            monthlyPrice={monthlyPrice}
                            yearlyPrice={yearlyPrice}
                            monthlyPlan={monthlyPlan}
                            yearlyPlan={yearlyPlan}
                        />
                    </View>
                )}

                {/* Trial Info Banner */}
                {showTrialBanner && (
                    <View style={styles.trialInfo}>
                        <View style={styles.trialIconCircle}>
                            <Ionicons name="gift-outline" size={20} color={theme.colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.trialTitle}>
                                {paywallConfig?.trialTitle || '7 Gün Ücretsiz Deneme'}
                            </Text>
                            <Text style={styles.trialText}>
                                {paywallConfig?.trialDescription ||
                                    'Ücret ödemeden dene, memnun kalmazsan istediğin zaman tek dokunuşla iptal et.'}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Benefits Grid */}
                <View style={styles.section}>
                    <BenefitsSection items={paywallConfig?.benefits} />
                </View>

                {/* Features Comparison */}
                <View style={styles.section}>
                    <FeaturesComparison rows={paywallConfig?.comparisonRows} />
                </View>

                {/* FAQ Section */}
                <View style={styles.section}>
                    <FAQSection faqs={paywallConfig?.faqs} />
                </View>

                {/* Ön Bilgilendirme & Abonelik Koşulları */}
                <View style={styles.preInfoCard}>
                    <View style={styles.preInfoHeader}>
                        <Ionicons name="document-text-outline" size={16} color={theme.colors.primary} />
                        <Text style={styles.preInfoTitle}>Ön Bilgilendirme ve Abonelik Koşulları</Text>
                    </View>
                    <Text style={styles.preInfoBody}>
                        • Seçilen plan ({selectedPrice} / {selectedTier === 'YEARLY' ? 'yıl' : 'ay'}) onayınızla birlikte Google Play / App Store hesabınızdan tahsil edilir.{'\n'}
                        • Ücretsiz deneme varsa, deneme bitiminden en az 24 saat önce iptal edilmediği sürece abonelik otomatik yenilenir.{'\n'}
                        • Aboneliğinizi dilediğiniz zaman cihazınızın mağaza abonelik ayarlarından iptal edebilirsiniz.{'\n'}
                        • Dijital içerik ve hizmetlerde anında ifa başladığından yasal cayma istisnaları geçerlidir.
                    </Text>
                    <View style={styles.preInfoLinks}>
                        <TouchableOpacity onPress={() => router.push('/settings/terms-of-service' as any)}>
                            <Text style={styles.preInfoLink}>Kullanım Koşulları</Text>
                        </TouchableOpacity>
                        <Text style={styles.preInfoDot}>·</Text>
                        <TouchableOpacity onPress={() => router.push('/settings/privacy-policy' as any)}>
                            <Text style={styles.preInfoLink}>Gizlilik &amp; KVKK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            {/* Sticky Bottom CTA Bar */}
            {!isPremium && (
                <View style={styles.stickyFooter}>
                    <View style={styles.footerSummaryRow}>
                        <Text style={styles.footerPlanName}>
                            {activePlan?.title || (selectedTier === 'YEARLY' ? 'Yıllık Plan' : 'Aylık Plan')}
                        </Text>
                        <Text style={styles.footerPlanPrice}>
                            {selectedPrice} / {selectedTier === 'YEARLY' ? 'yıl' : 'ay'}
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.ctaButton, isPurchasing && styles.ctaButtonDisabled]}
                        onPress={handlePurchase}
                        disabled={isPurchasing}
                        activeOpacity={0.85}
                    >
                        {isPurchasing ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                <Ionicons name="sparkles" size={18} color="#FFFFFF" />
                                <Text style={styles.ctaButtonText}>
                                    {showTrialBanner
                                        ? paywallConfig?.ctaTrialButtonText || '7 Gün Ücretsiz Başla'
                                        : paywallConfig?.ctaButtonText || "Premium'a Başla"}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <Text style={styles.ctaNote}>
                        {paywallConfig?.ctaFooterNote ||
                            'Otomatik yenilenir • İstediğin zaman iptal edebilirsin'}
                    </Text>
                </View>
            )}
        </SafeAreaView>
    );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.colors.background,
        },
        topBar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 10,
        },
        iconBtn: {
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: theme.colors.backgroundCard,
            borderWidth: 1,
            borderColor: theme.colors.border,
            alignItems: 'center',
            justifyContent: 'center',
        },
        iconPlaceholder: {
            width: 72,
        },
        topBarTitle: {
            fontSize: 17,
            fontWeight: '700',
            color: theme.colors.text,
        },
        restorePill: {
            paddingHorizontal: 10,
            paddingVertical: 7,
            borderRadius: 10,
            backgroundColor: theme.colors.backgroundCard,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        restorePillText: {
            fontSize: 12,
            fontWeight: '600',
            color: theme.colors.primary,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 10,
        },
        loadingText: {
            fontSize: 14,
            color: theme.colors.textSecondary,
        },
        scrollView: {
            flex: 1,
        },
        scrollContent: {
            paddingHorizontal: 16,
            paddingBottom: 40,
            gap: 18,
        },
        heroCard: {
            borderRadius: 24,
            padding: 20,
        },
        heroPill: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            alignSelf: 'flex-start',
            backgroundColor: 'rgba(255, 255, 255, 0.18)',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 12,
            marginBottom: 12,
        },
        heroPillText: {
            fontSize: 10.5,
            fontWeight: '800',
            color: '#FFFFFF',
            letterSpacing: 0.6,
        },
        heroTitle: {
            fontSize: 24,
            fontWeight: '800',
            color: '#FFFFFF',
            marginBottom: 6,
        },
        heroSubtitle: {
            fontSize: 13.5,
            color: 'rgba(255, 255, 255, 0.9)',
            lineHeight: 20,
            marginBottom: 14,
        },
        heroHighlights: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        highlightChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            backgroundColor: 'rgba(255, 255, 255, 0.18)',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 12,
        },
        highlightText: {
            fontSize: 12,
            fontWeight: '600',
            color: '#FFFFFF',
        },
        statusCard: {
            backgroundColor: theme.colors.backgroundCard,
            padding: 16,
            borderRadius: 18,
            borderWidth: 1.5,
            borderColor: theme.colors.primary,
            gap: 12,
        },
        statusHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        statusTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.colors.text,
        },
        statusDetails: {
            gap: 8,
            paddingVertical: 8,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: theme.colors.border,
        },
        statusRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
        },
        statusLabel: {
            fontSize: 13.5,
            color: theme.colors.textSecondary,
        },
        statusValue: {
            fontSize: 13.5,
            color: theme.colors.text,
            fontWeight: '700',
        },
        statusActions: {
            flexDirection: 'row',
            gap: 10,
        },
        statsButton: {
            flex: 1,
            backgroundColor: theme.colors.primary,
            paddingVertical: 12,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
        },
        statsButtonText: {
            color: '#FFFFFF',
            fontWeight: '700',
            fontSize: 13,
        },
        manageButton: {
            flex: 1,
            backgroundColor: theme.colors.background,
            paddingVertical: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
        },
        manageButtonText: {
            color: theme.colors.primary,
            fontWeight: '700',
            fontSize: 13,
        },
        section: {},
        sectionTitle: {
            fontSize: 16.5,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: 14,
        },
        trialInfo: {
            backgroundColor: 'rgba(139, 92, 246, 0.08)',
            borderWidth: 1,
            borderColor: 'rgba(139, 92, 246, 0.2)',
            padding: 14,
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        trialIconCircle: {
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: theme.colors.backgroundCard,
            alignItems: 'center',
            justifyContent: 'center',
        },
        trialTitle: {
            fontSize: 14,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: 2,
        },
        trialText: {
            fontSize: 12.5,
            color: theme.colors.textSecondary,
            lineHeight: 18,
        },
        stickyFooter: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.colors.backgroundCard,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: Platform.OS === 'ios' ? 26 : 14,
            gap: 8,
        },
        footerSummaryRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        footerPlanName: {
            fontSize: 13,
            fontWeight: '600',
            color: theme.colors.textSecondary,
        },
        footerPlanPrice: {
            fontSize: 14.5,
            fontWeight: '800',
            color: theme.colors.text,
        },
        ctaButton: {
            backgroundColor: theme.colors.primary,
            paddingVertical: 14,
            borderRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
        },
        ctaButtonDisabled: {
            opacity: 0.65,
        },
        ctaButtonText: {
            color: '#FFFFFF',
            fontWeight: '800',
            fontSize: 16,
        },
        ctaNote: {
            fontSize: 11,
            color: theme.colors.textLight,
            textAlign: 'center',
        },
        preInfoCard: {
            marginHorizontal: 16,
            marginTop: 8,
            marginBottom: 16,
            padding: 14,
            borderRadius: 16,
            backgroundColor: theme.colors.backgroundCard,
            borderWidth: 1,
            borderColor: theme.colors.border,
            gap: 8,
        },
        preInfoHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        preInfoTitle: {
            fontSize: 13,
            fontWeight: '800',
            color: theme.colors.text,
        },
        preInfoBody: {
            fontSize: 11.5,
            lineHeight: 17,
            color: theme.colors.textSecondary,
        },
        preInfoLinks: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 2,
        },
        preInfoLink: {
            fontSize: 11.5,
            fontWeight: '700',
            color: theme.colors.primary,
            textDecorationLine: 'underline',
        },
        preInfoDot: {
            fontSize: 11.5,
            color: theme.colors.textLight,
        },
    });
