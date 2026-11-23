import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '@/hooks/useTheme';
import { useOnboardingStore } from '@/store/onboardingStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;

const SHOWCASE_SLIDES = [
  {
    key: 'cycle',
    badge: 'DÖNGÜ ZEKASI',
    icon: 'calendar-outline' as const,
    gradient: ['#EC4899', '#F43F5E'] as const,
    softBg: 'rgba(236, 72, 153, 0.12)',
    title: 'Regl & Ovulasyonu\nÖnceden Gör',
    desc: 'Önümüzdeki 3 döngü tahmini, doğurganlık penceresi ve tek dokunuşla günlük semptom check-in.',
    chips: ['3 Döngü Öngörüsü', 'Faz Rehberi', 'Tek Tık Check-in'],
  },
  {
    key: 'nova',
    badge: 'NOVA AI ASİSTAN',
    icon: 'sparkles-outline' as const,
    gradient: ['#8B5CF6', '#EC4899'] as const,
    softBg: 'rgba(139, 92, 246, 0.12)',
    title: 'Seni Hatırlayan\n7/24 AI Rehberin',
    desc: 'Son 14 günlük ruh hali, ağrı ve enerji sinyallerini bilen NOVA ile kişiselleştirilmiş destek.',
    chips: ['14 Gün Hafıza', 'Doktor Soru Listesi', 'Anlık Yanıt'],
  },
  {
    key: 'privacy',
    badge: 'GİZLİLİK & PARTNER',
    icon: 'shield-checkmark-outline' as const,
    gradient: ['#0EA5E9', '#10B981'] as const,
    softBg: 'rgba(14, 165, 233, 0.12)',
    title: 'Verilerin Sende,\nKontrol Elinde',
    desc: 'PIN kilidi, kilit ekranında gizli bildirim modu, doktor raporu çıktısı ve isteğe bağlı partner paylaşımı.',
    chips: ['Gizli Bildirim', 'Klinik Rapor', 'Partner Modu'],
  },
];

export default function WelcomeSignUpScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { data, loadDraft } = useOnboardingStore();
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  const hasDraft = Boolean(data?.firstName || data?.email);

  const markWelcomeSeen = async () => {
    try {
      await SecureStore.setItemAsync('hasSeenWelcome', 'true');
    } catch {
      // Ignore secure store errors
    }
  };

  const handleStartOnboarding = async () => {
    await markWelcomeSeen();
    router.push('/(auth)/onboarding/identity');
  };

  const handleGoToSignIn = async () => {
    await markWelcomeSeen();
    router.replace('/(auth)/signin');
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offsetX / CARD_WIDTH);
    if (idx !== activeSlide && idx >= 0 && idx < SHOWCASE_SLIDES.length) {
      setActiveSlide(idx);
    }
  };

  const jumpToSlide = (idx: number) => {
    setActiveSlide(idx);
    carouselRef.current?.scrollTo({ x: idx * CARD_WIDTH, animated: true });
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Hero Visual */}
        <LinearGradient
          colors={
            theme.isDark ? ['#2C173B', '#1B1429'] : ['#FFF1F7', '#F3E8FF']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.topTagRow}>
            <View style={styles.brandPill}>
              <Ionicons name="sparkles" size={12} color={theme.colors.primary} />
              <Text style={styles.brandPillText}>KADIN ATLASI</Text>
            </View>
            <TouchableOpacity
              onPress={handleGoToSignIn}
              style={styles.quickLoginPill}
              activeOpacity={0.75}
            >
              <Text style={styles.quickLoginText}>Giriş Yap</Text>
              <Ionicons name="chevron-forward" size={13} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.mascotHalo}>
            <Image
              source={require('../../assets/images/mascot/5.png')}
              style={styles.mascot}
            />
          </View>

          <Text style={styles.title}>
            {hasDraft && data.firstName
              ? `Tekrar Hoş Geldin,\n${data.firstName}`
              : 'Döngünü Tanı,\nKendini Keşfet'}
          </Text>
          <Text style={styles.subtitle}>
            Regl takibi, semptom analizi, wellness hedefleri ve NOVA yapay zeka asistanı tek yerde.
          </Text>

          {hasDraft && (
            <View style={styles.draftBadge}>
              <Ionicons name="bookmark-outline" size={13} color="#7C3AED" />
              <Text style={styles.draftBadgeText}>
                Yarım kalan kayıt taslağın hazır
              </Text>
            </View>
          )}
        </LinearGradient>

        {/* Interactive Feature Carousel */}
        <View style={styles.carouselSection}>
          <ScrollView
            ref={carouselRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            decelerationRate="fast"
          >
            {SHOWCASE_SLIDES.map((slide) => (
              <View key={slide.key} style={[styles.slideCard, { width: CARD_WIDTH }]}>
                <View style={styles.slideTopRow}>
                  <LinearGradient
                    colors={slide.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.slideIconBadge}
                  >
                    <Ionicons name={slide.icon} size={22} color="#FFFFFF" />
                  </LinearGradient>
                  <View style={[styles.slideBadge, { backgroundColor: slide.softBg }]}>
                    <Text style={[styles.slideBadgeText, { color: slide.gradient[0] }]}>
                      {slide.badge}
                    </Text>
                  </View>
                </View>

                <Text style={styles.slideTitle}>{slide.title}</Text>
                <Text style={styles.slideDesc}>{slide.desc}</Text>

                <View style={styles.chipsWrap}>
                  {slide.chips.map((chip) => (
                    <View key={chip} style={styles.featureChip}>
                      <Ionicons
                        name="checkmark-circle"
                        size={13}
                        color={slide.gradient[0]}
                      />
                      <Text style={styles.featureChipText}>{chip}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Pagination Dots */}
          <View style={styles.dotsRow}>
            {SHOWCASE_SLIDES.map((slide, idx) => {
              const active = idx === activeSlide;
              return (
                <TouchableOpacity
                  key={slide.key}
                  onPress={() => jumpToSlide(idx)}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                >
                  <View style={[styles.dot, active && styles.dotActive]} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Bottom CTA */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleStartOnboarding}
            style={styles.ctaWrap}
          >
            <LinearGradient
              colors={['#EC4899', '#9333EA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>
                {hasDraft ? 'Kaldığın Yerden Devam Et' : 'Ücretsiz Başla'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleGoToSignIn}
            style={styles.signInButton}
            activeOpacity={0.8}
          >
            <Text style={styles.signInButtonText}>Zaten Hesabım Var · Giriş Yap</Text>
          </TouchableOpacity>

          <View style={styles.privacyBar}>
            <Ionicons name="lock-closed-outline" size={13} color="#10B981" />
            <Text style={styles.privacyText}>
              Verilerin şifreli saklanır · Reklamsız ve özel deneyim
            </Text>
          </View>

          <View style={styles.legalLinksRow}>
            <TouchableOpacity
              onPress={() => router.push('/settings/privacy-policy' as any)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.legalLinkText}>KVKK Aydınlatma Metni</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>·</Text>
            <TouchableOpacity
              onPress={() => router.push('/settings/terms-of-service' as any)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.legalLinkText}>Kullanım Koşulları</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 20,
      justifyContent: 'space-between',
      gap: 16,
    },
    heroBanner: {
      borderRadius: 28,
      paddingTop: 16,
      paddingBottom: 22,
      paddingHorizontal: 18,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    topTagRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    brandPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: theme.colors.backgroundCard,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    brandPillText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.9,
      color: theme.colors.primary,
    },
    quickLoginPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: theme.isDark ? 'rgba(236,72,153,0.16)' : '#FFFFFF',
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(236,72,153,0.35)' : '#FBCFE8',
    },
    quickLoginText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    mascotHalo: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: theme.colors.backgroundCard,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 14,
      elevation: 4,
    },
    mascot: {
      width: 76,
      height: 76,
      resizeMode: 'contain',
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: theme.colors.text,
      textAlign: 'center',
      lineHeight: 32,
      letterSpacing: -0.3,
    },
    subtitle: {
      marginTop: 8,
      fontSize: 13.5,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 19,
      paddingHorizontal: 8,
    },
    draftBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
      backgroundColor: 'rgba(124, 58, 237, 0.12)',
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 12,
    },
    draftBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#7C3AED',
    },
    carouselSection: {
      gap: 10,
    },
    slideCard: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    slideTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    slideIconBadge: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    slideBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    slideBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.7,
    },
    slideTitle: {
      fontSize: 19,
      fontWeight: '800',
      color: theme.colors.text,
      lineHeight: 24,
      marginBottom: 6,
    },
    slideDesc: {
      fontSize: 13,
      lineHeight: 19,
      color: theme.colors.textSecondary,
      marginBottom: 12,
    },
    chipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    featureChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    featureChipText: {
      fontSize: 11.5,
      fontWeight: '600',
      color: theme.colors.text,
    },
    dotsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: theme.colors.border,
    },
    dotActive: {
      width: 22,
      backgroundColor: theme.colors.primary,
    },
    ctaSection: {
      gap: 10,
    },
    ctaWrap: {
      borderRadius: 18,
      overflow: 'hidden',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 6,
    },
    ctaGradient: {
      height: 54,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    ctaText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
    },
    signInButton: {
      height: 48,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundCard,
      alignItems: 'center',
      justifyContent: 'center',
    },
    signInButtonText: {
      fontSize: 14.5,
      fontWeight: '700',
      color: theme.colors.text,
    },
    privacyBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingTop: 2,
    },
    privacyText: {
      fontSize: 11.5,
      color: theme.colors.textSecondary,
    },
    legalLinksRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 2,
    },
    legalLinkText: {
      fontSize: 11.5,
      fontWeight: '600',
      color: theme.colors.primary,
      textDecorationLine: 'underline',
    },
    legalDot: {
      fontSize: 11.5,
      color: theme.colors.textLight,
    },
  });
