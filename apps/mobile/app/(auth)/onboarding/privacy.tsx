import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTheme } from '@/hooks/useTheme';
import { useOnboardingStore } from '@/store/onboardingStore';
import { ConsentSchema, type ConsentInput } from '@/schemas/onboarding';
import { StepContainer } from '@/components/onboarding/StepContainer';
import { StepButtons } from '@/components/onboarding/StepButtons';

const TOTAL_STEPS = 6;

const TRUST_PILLARS = [
  { icon: 'lock-closed-outline' as const, label: 'Şifreli Veri' },
  { icon: 'eye-off-outline' as const, label: 'Paylaşılmaz' },
  { icon: 'trash-outline' as const, label: 'Anında Silinir' },
];

export default function PrivacyStep() {
  const router = useRouter();
  const theme = useTheme();
  const { data, updateData, completeStep, setCurrentStep } = useOnboardingStore();

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ConsentInput>({
    resolver: zodResolver(ConsentSchema) as any,
    mode: 'onChange',
    defaultValues: {
      acceptPrivacy: (data.acceptPrivacy || false) as any,
      aiMemoryOptIn: data.aiMemoryOptIn || false,
    },
  });

  useEffect(() => {
    setCurrentStep(3);
  }, []);

  const onSubmit = async (formData: ConsentInput) => {
    const nowIso = new Date().toISOString();
    await updateData({
      acceptPrivacy: formData.acceptPrivacy,
      privacyAcceptedAt: data.privacyAcceptedAt || nowIso,
      aiMemoryOptIn: formData.aiMemoryOptIn,
      aiMemoryAcceptedAt: formData.aiMemoryOptIn
        ? data.aiMemoryAcceptedAt || nowIso
        : undefined,
    });

    completeStep(3);
    router.push('/(auth)/onboarding/notifications');
  };

  const handleBack = () => {
    router.back();
  };

  const styles = createStyles(theme);

  return (
    <StepContainer
      currentStep={3}
      totalSteps={TOTAL_STEPS}
      headerIcon="shield-checkmark-outline"
      title="Gizlilik ve İzinler"
      subtitle="Sağlık verilerin KVKK güvencesi altındadır. Tercihlerini şeffaf biçimde yönet."
      onBack={handleBack}
    >
      <View style={styles.content}>
        {/* Trust Highlights Strip */}
        <View style={styles.trustGrid}>
          {TRUST_PILLARS.map((item) => (
            <View key={item.label} style={styles.trustPill}>
              <Ionicons
                name={item.icon}
                size={16}
                color={theme.colors.primary}
              />
              <Text style={styles.trustPillText}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Legal Docs Quick Links */}
        <View style={styles.docsCard}>
          <TouchableOpacity
            activeOpacity={0.75}
            style={styles.docRow}
            onPress={() => router.push('/settings/privacy-policy' as any)}
          >
            <View style={styles.docLeft}>
              <Ionicons
                name="document-text-outline"
                size={18}
                color={theme.colors.primary}
              />
              <Text style={styles.docText}>Gizlilik Politikası ve KVKK</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={theme.colors.textLight}
            />
          </TouchableOpacity>

          <View style={styles.docDivider} />

          <TouchableOpacity
            activeOpacity={0.75}
            style={styles.docRow}
            onPress={() => router.push('/settings/terms-of-service' as any)}
          >
            <View style={styles.docLeft}>
              <Ionicons
                name="reader-outline"
                size={18}
                color="#8B5CF6"
              />
              <Text style={styles.docText}>Kullanım Koşulları</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={theme.colors.textLight}
            />
          </TouchableOpacity>
        </View>

        {/* Required Consent Card */}
        <Controller
          control={control}
          name="acceptPrivacy"
          render={({ field: { onChange, value } }) => (
            <View>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => onChange(!value)}
                style={[
                  styles.consentCard,
                  Boolean(value) && styles.consentCardActive,
                  errors.acceptPrivacy && styles.consentCardError,
                ]}
              >
                <View style={styles.consentTopRow}>
                  <View style={styles.requiredBadge}>
                    <Text style={styles.requiredBadgeText}>ZORUNLU</Text>
                  </View>

                  <View
                    style={[
                      styles.checkCircle,
                      Boolean(value) && styles.checkCircleActive,
                    ]}
                  >
                    {value ? (
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    ) : null}
                  </View>
                </View>

                <Text style={styles.consentTitle}>
                  Gizlilik politikasını ve kullanım koşullarını okudum, kabul ediyorum
                </Text>
                <Text style={styles.consentDesc}>
                  Hesap oluşturma ve döngü/wellness verilerinin güvenli şekilde işlenmesi için gereklidir.
                </Text>
              </TouchableOpacity>

              {errors.acceptPrivacy && (
                <Text style={styles.errorText}>
                  {errors.acceptPrivacy.message}
                </Text>
              )}
            </View>
          )}
        />

        {/* Optional AI Memory Card */}
        <Controller
          control={control}
          name="aiMemoryOptIn"
          render={({ field: { onChange, value } }) => (
            <View
              style={[
                styles.consentCard,
                Boolean(value) && styles.consentCardPurple,
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => onChange(!value)}
              >
                <View style={styles.consentTopRow}>
                  <View style={styles.optionalBadge}>
                    <Ionicons name="sparkles" size={12} color="#8B5CF6" />
                    <Text style={styles.optionalBadgeText}>
                      İSTEĞE BAĞLI • ÖNERİLEN
                    </Text>
                  </View>

                  <Switch
                    value={Boolean(value)}
                    onValueChange={onChange}
                    trackColor={{
                      false: theme.isDark ? '#3F3F46' : '#E5E7EB',
                      true: '#A855F7',
                    }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <Text style={styles.consentTitle}>
                  NOVA AI Kişisel Hafıza İzni
                </Text>
                <Text style={styles.consentDesc}>
                  NOVA asistanın önceki sohbetlerini ve tercihlerini hatırlayarak daha isabetli öneriler sunmasına izin ver.
                </Text>
              </TouchableOpacity>

              {value ? (
                <View style={styles.memoryActiveNote}>
                  <Ionicons
                    name="shield-outline"
                    size={15}
                    color="#8B5CF6"
                  />
                  <Text style={styles.memoryActiveText}>
                    Ayarlar içinden tek dokunuşla "Her şeyi unut" diyerek tüm AI hafızasını sıfırlayabilirsin.
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        />
      </View>

      <StepButtons
        onNext={handleSubmit(onSubmit)}
        nextDisabled={!isValid}
        nextLabel="Onayla ve Devam Et"
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
    trustGrid: {
      flexDirection: 'row',
      gap: 8,
    },
    trustPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    trustPillText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.text,
    },
    docsCard: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    docRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    docLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    docText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    docDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginHorizontal: 14,
    },
    consentCard: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
    },
    consentCardActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.isDark
        ? 'rgba(255, 105, 180, 0.08)'
        : '#FFF5F9',
    },
    consentCardPurple: {
      borderColor: '#A855F7',
      backgroundColor: theme.isDark
        ? 'rgba(168, 85, 247, 0.1)'
        : '#FAF5FF',
    },
    consentCardError: {
      borderColor: theme.colors.error,
    },
    consentTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    requiredBadge: {
      backgroundColor: 'rgba(236, 72, 153, 0.12)',
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 8,
    },
    requiredBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
      color: theme.colors.primary,
    },
    optionalBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(139, 92, 246, 0.12)',
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 8,
    },
    optionalBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
      color: '#8B5CF6',
    },
    checkCircle: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.backgroundCard,
    },
    checkCircleActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    consentTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
      lineHeight: 21,
      marginBottom: 4,
    },
    consentDesc: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    memoryActiveNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    memoryActiveText: {
      flex: 1,
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 17,
    },
    errorText: {
      fontSize: 12,
      color: theme.colors.error,
      marginTop: 5,
      fontWeight: '500',
    },
  });
