import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { StepContainer } from '@/components/onboarding/StepContainer';
import { StepButtons } from '@/components/onboarding/StepButtons';
import { authService, cyclesService, userService } from '@/services/api';
import { parseBirthDateSafe, toBirthDateIsoNoon } from '@/utils/astrology';

const TOTAL_STEPS = 6;

const FEATURE_SHOWCASE = [
  {
    key: 'cycle',
    shortTitle: 'Takvim',
    title: 'Akıllı Döngü & Faz Rehberi',
    icon: 'calendar-outline' as const,
    color: '#EC4899',
    description:
      'Regl, ovülasyon ve luteal faz tahminlerini takip et; her fazda enerjine uygun öneriler al.',
    highlight: 'Takvim sekmesinde canlı tahmin',
  },
  {
    key: 'nova',
    shortTitle: 'NOVA AI',
    title: '7/24 Kişisel Sağlık Asistanın',
    icon: 'sparkles-outline' as const,
    color: '#8B5CF6',
    description:
      'Semptomların, ruh halin ve soruların için yargısız, bilimsel temelli yanıtlar al.',
    highlight: 'Sohbet geçmişine duyarlı hafıza',
  },
  {
    key: 'wellness',
    shortTitle: 'Wellness',
    title: 'Su, Uyku ve 4-7-8 Nefes',
    icon: 'water-outline' as const,
    color: '#0EA5E9',
    description:
      'Günlük su hedefini, uyku süreni ve stres anlarında nefes egzersizlerini tek yerden yönet.',
    highlight: 'Tek dokunuşla günlük kayıt',
  },
  {
    key: 'reminders',
    shortTitle: 'Hatırlatma',
    title: 'Zamanında Gelen Nazik Uyarılar',
    icon: 'notifications-outline' as const,
    color: '#F59E0B',
    description:
      'Sessiz saatlerine saygı duyan akıllı hatırlatmalarla ilaç, su ve dönem takibini kaçırma.',
    highlight: 'Ayarlardan anında özelleştir',
  },
];

export default function TourStep() {
  const router = useRouter();
  const theme = useTheme();
  const { data, completeStep, setCurrentStep, clearData } = useOnboardingStore();
  const { setAuth } = useAuthStore();

  const [selectedFeatureIdx, setSelectedFeatureIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCurrentStep(6);
  }, []);

  const handleBack = () => {
    router.back();
  };

  const handleComplete = async () => {
    if (
      !data.email ||
      !data.password ||
      !data.username ||
      !data.firstName ||
      !data.lastName ||
      !data.birthDate
    ) {
      Alert.alert('Hata', 'Lütfen tüm gerekli alanları doldurun');
      router.push('/(auth)/onboarding/identity');
      return;
    }

    setLoading(true);
    try {
      const parsedDob = parseBirthDateSafe(data.birthDate) || new Date(data.birthDate);
      const birthDateIso = toBirthDateIsoNoon(parsedDob);

      const response = await authService.register({
        email: data.email,
        password: data.password,
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: birthDateIso,
        kvkkConsents: {
          acceptPrivacy: data.acceptPrivacy ?? true,
          privacyAcceptedAt: data.privacyAcceptedAt || new Date().toISOString(),
          aiMemoryOptIn: Boolean(data.aiMemoryOptIn),
          aiMemoryAcceptedAt: data.aiMemoryOptIn
            ? data.aiMemoryAcceptedAt || new Date().toISOString()
            : undefined,
          version: '1.0',
          source: 'ONBOARDING',
        },
      });

      await setAuth(response.user, {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });

      if (data.heightCm || data.weightKg) {
        try {
          await userService.updateMe({
            heightCm: data.heightCm,
            weightKg: data.weightKg,
          });
        } catch (error) {
          console.error('Failed to update height/weight:', error);
        }
      }

      if (data.lastPeriodDate) {
        try {
          const localDate = new Date(data.lastPeriodDate);
          localDate.setHours(0, 0, 0, 0);
          await cyclesService.createCycle({
            startDate: localDate.toISOString(),
          });
        } catch (error) {
          console.error('Failed to create initial cycle:', error);
        }
      }

      const chosePremium = data.selectedPlan === 'premium';
      const chosenTier = data.selectedTier || 'YEARLY';

      completeStep(6);
      await clearData();

      if (chosePremium) {
        router.replace({
          pathname: '/premium',
          params: { tier: chosenTier, fromOnboarding: '1' },
        } as any);
      } else {
        router.replace('/(tabs)/home');
      }
    } catch (error: any) {
      Alert.alert('Kayıt Hatası', error.message || 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const activeFeature = FEATURE_SHOWCASE[selectedFeatureIdx];
  const firstName = data.firstName?.trim() || 'Hoş Geldin';
  const planLabel =
    data.selectedPlan === 'premium'
      ? data.selectedTier === 'MONTHLY'
        ? 'Aylık Premium'
        : 'Yıllık Premium'
      : 'Ücretsiz Plan';

  const summaryItems = [
    {
      icon: 'person-outline' as const,
      label: data.username ? `@${data.username}` : firstName,
    },
    {
      icon: 'calendar-outline' as const,
      label: data.lastPeriodDate ? 'Döngü kaydedildi' : 'Takvim hazır',
    },
    {
      icon: 'sparkles-outline' as const,
      label: planLabel,
    },
  ];

  const styles = createStyles(theme);

  return (
    <StepContainer
      currentStep={6}
      totalSteps={TOTAL_STEPS}
      title="Her Şey Hazır"
      subtitle="Hesabını oluşturmadan önce kişisel alanına göz at."
      onBack={handleBack}
    >
      <View style={styles.content}>
        {/* Celebration Hero Card with Mascot */}
        <LinearGradient
          colors={
            theme.isDark ? ['#2A1836', '#1B1429'] : ['#FFF0F7', '#F5EEFF']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.mascotWrap}>
            <Image
              source={require('../../../assets/images/mascot/5.png')}
              style={styles.mascot}
            />
          </View>
          <View style={styles.heroBody}>
            <Text style={styles.heroBadgeText}>KAYIT ÖZETİ</Text>
            <Text style={styles.heroGreeting}>
              Harika, {firstName}!
            </Text>
            <Text style={styles.heroDesc}>
              Tüm tercihlerin hazır. Tek dokunuşla Kadın Atlası dünyana katıl.
            </Text>
          </View>
        </LinearGradient>

        {/* User Setup Summary Strip */}
        <View style={styles.summaryStrip}>
          {summaryItems.map((item) => (
            <View key={item.label} style={styles.summaryPill}>
              <Ionicons
                name={item.icon}
                size={13}
                color={theme.colors.primary}
              />
              <Text style={styles.summaryPillText} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Interactive Feature Showcase Tabs */}
        <View style={styles.showcaseCard}>
          <View style={styles.tabsRow}>
            {FEATURE_SHOWCASE.map((item, idx) => {
              const selected = idx === selectedFeatureIdx;
              return (
                <TouchableOpacity
                  key={item.key}
                  activeOpacity={0.8}
                  onPress={() => setSelectedFeatureIdx(idx)}
                  style={[styles.tabPill, selected && styles.tabPillActive]}
                >
                  <Ionicons
                    name={item.icon}
                    size={15}
                    color={selected ? '#FFFFFF' : theme.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.tabText,
                      selected && styles.tabTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {item.shortTitle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.featurePreview}>
            <View
              style={[
                styles.featureIconCircle,
                { backgroundColor: `${activeFeature.color}1A` },
              ]}
            >
              <Ionicons
                name={activeFeature.icon}
                size={28}
                color={activeFeature.color}
              />
            </View>

            <Text style={styles.featureTitle}>{activeFeature.title}</Text>
            <Text style={styles.featureDesc}>
              {activeFeature.description}
            </Text>

            <View style={styles.featureTipPill}>
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={theme.colors.success}
              />
              <Text style={styles.featureTipText}>
                {activeFeature.highlight}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <StepButtons
        onNext={handleComplete}
        nextLabel={
          data.selectedPlan === 'premium'
            ? 'Hesabı Oluştur ve Premium’a Geç'
            : 'Hesabı Oluştur ve Başla'
        }
        loading={loading}
      />
    </StepContainer>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    content: {
      flex: 1,
      gap: 12,
    },
    heroCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      borderRadius: 24,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    mascotWrap: {
      width: 78,
      height: 78,
      borderRadius: 39,
      backgroundColor: theme.colors.backgroundCard,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.16,
      shadowRadius: 10,
      elevation: 4,
    },
    mascot: {
      width: 64,
      height: 64,
      resizeMode: 'contain',
    },
    heroBody: {
      flex: 1,
      gap: 3,
    },
    heroBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: theme.colors.primary,
    },
    heroGreeting: {
      fontSize: 21,
      fontWeight: '800',
      color: theme.colors.text,
    },
    heroDesc: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 17,
    },
    summaryStrip: {
      flexDirection: 'row',
      gap: 8,
    },
    summaryPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    summaryPillText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.text,
      flexShrink: 1,
    },
    showcaseCard: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 22,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 16,
    },
    tabsRow: {
      flexDirection: 'row',
      gap: 6,
    },
    tabPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 9,
      paddingHorizontal: 6,
      borderRadius: 12,
      backgroundColor: theme.isDark ? '#121215' : '#F3F4F6',
    },
    tabPillActive: {
      backgroundColor: theme.colors.primary,
    },
    tabText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    tabTextActive: {
      color: '#FFFFFF',
    },
    featurePreview: {
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingBottom: 6,
    },
    featureIconCircle: {
      width: 60,
      height: 60,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    featureTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 6,
    },
    featureDesc: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 19,
      marginBottom: 14,
    },
    featureTipPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    featureTipText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.success,
    },
  });
