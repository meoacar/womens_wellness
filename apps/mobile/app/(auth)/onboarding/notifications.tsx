import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  AppState,
  AppStateStatus,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  getOsNotificationPermissionStatus,
  openAppNotificationSettings,
  registerPushTokenWithBackend,
  requestOsNotificationPermission,
} from '@/services/notificationEngine';
import { useTheme } from '@/hooks/useTheme';
import { useOnboardingStore } from '@/store/onboardingStore';
import { NotificationSchema, type NotificationInput } from '@/schemas/onboarding';
import { StepContainer } from '@/components/onboarding/StepContainer';
import { StepButtons } from '@/components/onboarding/StepButtons';

const TOTAL_STEPS = 6;

const INTENSITY_OPTIONS = [
  {
    value: 'light' as const,
    label: 'Hafif',
    icon: 'notifications-off-outline' as const,
    color: '#64748B',
    badge: null,
    description: 'Yalnızca kritik regl başlangıç uyarıları ve haftalık özet.',
  },
  {
    value: 'medium' as const,
    label: 'Orta',
    icon: 'notifications-outline' as const,
    color: '#EC4899',
    badge: 'ÖNERİLEN',
    description: 'Döngü fazı ipuçları, günlük su/uyku hatırlatmaları.',
  },
  {
    value: 'high' as const,
    label: 'Yoğun',
    icon: 'flash-outline' as const,
    color: '#8B5CF6',
    badge: null,
    description: 'Sık wellness teşvikleri, ilaç ve nefes hatırlatıcıları.',
  },
];

const QUIET_PRESETS = [
  { label: '22:00 – 08:00', start: '22:00', end: '08:00' },
  { label: '23:00 – 07:00', start: '23:00', end: '07:00' },
  { label: '00:00 – 08:00', start: '00:00', end: '08:00' },
];

function stepHour(timeStr: string, delta: number): string {
  const hour = Number(timeStr.split(':')[0]);
  const safeHour = Number.isFinite(hour) ? hour : 22;
  const nextHour = (safeHour + delta + 24) % 24;
  return `${String(nextHour).padStart(2, '0')}:00`;
}

export default function NotificationsStep() {
  const router = useRouter();
  const theme = useTheme();
  const { data, updateData, completeStep, setCurrentStep } = useOnboardingStore();

  const [permissionGranted, setPermissionGranted] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [quietEnabled, setQuietEnabled] = useState(
    Boolean(data.quietHoursStart || data.quietHoursEnd)
  );

  const {
    control,
    handleSubmit,
    watch,
    setValue,
  } = useForm<NotificationInput>({
    resolver: zodResolver(NotificationSchema) as any,
    defaultValues: {
      intensity: (data.notificationIntensity || 'medium') as
        | 'light'
        | 'medium'
        | 'high',
      quietHoursStart: data.quietHoursStart || '22:00',
      quietHoursEnd: data.quietHoursEnd || '08:00',
    },
  });

  const quietStart = watch('quietHoursStart') || '22:00';
  const quietEnd = watch('quietHoursEnd') || '08:00';

  useEffect(() => {
    setCurrentStep(4);
    getOsNotificationPermissionStatus()
      .then((res) => {
        setPermissionGranted(res.granted);
      })
      .catch(() => {});

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        getOsNotificationPermissionStatus()
          .then((res) => setPermissionGranted(res.granted))
          .catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  const requestNotificationPermission = async () => {
    if (requestingPermission) return;
    setRequestingPermission(true);
    try {
      const res = await requestOsNotificationPermission({ showSettingsPrompt: false });
      if (res.granted) {
        setPermissionGranted(true);
        registerPushTokenWithBackend().catch(() => {});
        Alert.alert(
          'Bildirim İzni Verildi',
          'Bildirim tercihlerin başarıyla kaydedildi.'
        );
      } else if (!res.canAskAgain) {
        setPermissionGranted(false);
        Alert.alert(
          'Bildirim İzni Gerekli',
          'Bildirim izni daha önce reddedilmiş. Cihaz ayarlarından izin verebilir veya doğrudan devam edebilirsin.',
          [
            { text: 'Şimdilik Geç', style: 'cancel' },
            {
              text: 'Ayarları Aç',
              onPress: openAppNotificationSettings,
            },
          ]
        );
      } else {
        setPermissionGranted(false);
        Alert.alert(
          'Bildirimler Kapalı',
          'Bildirimleri daha sonra uygulama ayarlarından açabilirsin.',
          [{ text: 'Tamam' }]
        );
      }
    } catch (error) {
      console.warn('Notification permission request failed:', error);
      setPermissionGranted(false);
      Alert.alert(
        'Bildirim İzni Alınamadı',
        'Cihaz ayarlarından Kadın Atlası bildirimlerine izin verebilir veya daha sonra ayarlardan açabilirsin.'
      );
    } finally {
      setRequestingPermission(false);
    }
  };

  const toggleQuietHours = (enabled: boolean) => {
    setQuietEnabled(enabled);
    if (enabled) {
      setValue('quietHoursStart', quietStart || '22:00');
      setValue('quietHoursEnd', quietEnd || '08:00');
    }
  };

  const onSubmit = async (formData: NotificationInput) => {
    await updateData({
      notificationIntensity: formData.intensity,
      quietHoursStart: quietEnabled ? formData.quietHoursStart || '22:00' : undefined,
      quietHoursEnd: quietEnabled ? formData.quietHoursEnd || '08:00' : undefined,
    });

    completeStep(4);
    router.push('/(auth)/onboarding/premium');
  };

  const handleBack = () => {
    router.back();
  };

  const styles = createStyles(theme);

  return (
    <StepContainer
      currentStep={4}
      totalSteps={TOTAL_STEPS}
      headerIcon="notifications-outline"
      title="Bildirim Tercihleri"
      subtitle="Hangi sıklıkta hatırlatma almak istediğini ve sessiz saatlerini belirle."
      onBack={handleBack}
    >
      <View style={styles.content}>
        {/* Intensity Selection */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Bildirim Yoğunluğu</Text>
          <Controller
            control={control}
            name="intensity"
            render={({ field: { onChange, value } }) => (
              <View style={styles.optionsList}>
                {INTENSITY_OPTIONS.map((option) => {
                  const selected = value === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      activeOpacity={0.82}
                      onPress={() => onChange(option.value)}
                      style={[
                        styles.intensityCard,
                        selected && styles.intensityCardSelected,
                      ]}
                    >
                      <View
                        style={[
                          styles.intensityIconBox,
                          { backgroundColor: `${option.color}18` },
                        ]}
                      >
                        <Ionicons
                          name={option.icon}
                          size={20}
                          color={selected ? theme.colors.primary : option.color}
                        />
                      </View>

                      <View style={styles.intensityBody}>
                        <View style={styles.intensityTitleRow}>
                          <Text
                            style={[
                              styles.intensityLabel,
                              selected && styles.intensityLabelSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                          {option.badge ? (
                            <View style={styles.recommendedPill}>
                              <Text style={styles.recommendedPillText}>
                                {option.badge}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.intensityDesc}>
                          {option.description}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.radioOuter,
                          selected && styles.radioOuterSelected,
                        ]}
                      >
                        {selected ? <View style={styles.radioInner} /> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          />
        </View>

        {/* Quiet Hours */}
        <View style={styles.sectionCard}>
          <View style={styles.quietHeaderRow}>
            <View style={styles.quietTitleCol}>
              <Text style={styles.sectionTitleNoMargin}>Sessiz Saatler</Text>
              <Text style={styles.quietSub}>
                Gece uyurken rahatsız edilme
              </Text>
            </View>
            <Switch
              value={quietEnabled}
              onValueChange={toggleQuietHours}
              trackColor={{
                false: theme.isDark ? '#3F3F46' : '#E5E7EB',
                true: theme.colors.primary,
              }}
              thumbColor="#FFFFFF"
            />
          </View>

          {quietEnabled && (
            <View style={styles.quietBody}>
              {/* Presets */}
              <View style={styles.presetRow}>
                {QUIET_PRESETS.map((preset) => {
                  const active =
                    quietStart === preset.start && quietEnd === preset.end;
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      activeOpacity={0.8}
                      onPress={() => {
                        setValue('quietHoursStart', preset.start);
                        setValue('quietHoursEnd', preset.end);
                      }}
                      style={[
                        styles.presetChip,
                        active && styles.presetChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          active && styles.presetChipTextActive,
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Steppers */}
              <View style={styles.steppersRow}>
                <Controller
                  control={control}
                  name="quietHoursStart"
                  render={({ field: { onChange, value } }) => {
                    const current = value || '22:00';
                    return (
                      <View style={styles.timeStepperCard}>
                        <View style={styles.timeHeader}>
                          <Ionicons
                            name="moon-outline"
                            size={14}
                            color="#8B5CF6"
                          />
                          <Text style={styles.timeLabel}>Başlangıç</Text>
                        </View>
                        <View style={styles.stepperControls}>
                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => onChange(stepHour(current, -1))}
                          >
                            <Ionicons
                              name="remove"
                              size={16}
                              color={theme.colors.text}
                            />
                          </TouchableOpacity>
                          <Text style={styles.timeValue}>{current}</Text>
                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => onChange(stepHour(current, 1))}
                          >
                            <Ionicons
                              name="add"
                              size={16}
                              color={theme.colors.text}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }}
                />

                <Controller
                  control={control}
                  name="quietHoursEnd"
                  render={({ field: { onChange, value } }) => {
                    const current = value || '08:00';
                    return (
                      <View style={styles.timeStepperCard}>
                        <View style={styles.timeHeader}>
                          <Ionicons
                            name="sunny-outline"
                            size={14}
                            color="#F59E0B"
                          />
                          <Text style={styles.timeLabel}>Bitiş</Text>
                        </View>
                        <View style={styles.stepperControls}>
                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => onChange(stepHour(current, -1))}
                          >
                            <Ionicons
                              name="remove"
                              size={16}
                              color={theme.colors.text}
                            />
                          </TouchableOpacity>
                          <Text style={styles.timeValue}>{current}</Text>
                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => onChange(stepHour(current, 1))}
                          >
                            <Ionicons
                              name="add"
                              size={16}
                              color={theme.colors.text}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }}
                />
              </View>
            </View>
          )}
        </View>

        {/* Permission Status Card */}
        {permissionGranted ? (
          <View style={styles.permissionSuccessCard}>
            <Ionicons
              name="checkmark-circle"
              size={22}
              color={theme.colors.success}
            />
            <Text style={styles.permissionSuccessText}>
              Bildirim izni aktif. Hatırlatmaların zamanında iletilecek.
            </Text>
          </View>
        ) : (
          <View style={styles.permissionPromptCard}>
            <View style={styles.permissionTop}>
              <Ionicons
                name="notifications-circle-outline"
                size={24}
                color={theme.colors.primary}
              />
              <View style={styles.permissionCopy}>
                <Text style={styles.permissionTitle}>Cihaz Bildirim İzni</Text>
                <Text style={styles.permissionDesc}>
                  Adet tahminlerini ve su hatırlatmalarını alabilmek için izin ver.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.permissionBtn}
              onPress={requestNotificationPermission}
              disabled={requestingPermission}
            >
              {requestingPermission ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Text style={styles.permissionBtnText}>Bildirimlere İzin Ver</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <StepButtons
        onNext={handleSubmit(onSubmit)}
        nextLabel="Kaydet ve Devam Et"
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
    sectionCard: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 22,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 12,
    },
    sectionTitleNoMargin: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
    },
    optionsList: {
      gap: 10,
    },
    intensityCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.isDark ? '#121215' : '#F9FAFB',
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      borderRadius: 16,
      padding: 13,
    },
    intensityCardSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.isDark
        ? 'rgba(255, 105, 180, 0.08)'
        : '#FFF5F9',
    },
    intensityIconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    intensityBody: {
      flex: 1,
    },
    intensityTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginBottom: 2,
    },
    intensityLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
    },
    intensityLabelSelected: {
      color: theme.colors.primary,
    },
    recommendedPill: {
      backgroundColor: 'rgba(236, 72, 153, 0.14)',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
    },
    recommendedPillText: {
      fontSize: 10,
      fontWeight: '800',
      color: theme.colors.primary,
    },
    intensityDesc: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 17,
    },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOuterSelected: {
      borderColor: theme.colors.primary,
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.primary,
    },
    quietHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    quietTitleCol: {
      gap: 2,
    },
    quietSub: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    quietBody: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      gap: 12,
    },
    presetRow: {
      flexDirection: 'row',
      gap: 6,
    },
    presetChip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: theme.isDark ? '#121215' : '#F3F4F6',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    presetChipActive: {
      backgroundColor: theme.isDark
        ? 'rgba(255, 105, 180, 0.16)'
        : '#FCE7F3',
      borderColor: theme.colors.primary,
    },
    presetChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    presetChipTextActive: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    steppersRow: {
      flexDirection: 'row',
      gap: 10,
    },
    timeStepperCard: {
      flex: 1,
      backgroundColor: theme.isDark ? '#121215' : '#F9FAFB',
      borderRadius: 14,
      padding: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 8,
    },
    timeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },
    timeLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    stepperControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    stepperBtn: {
      width: 30,
      height: 30,
      borderRadius: 9,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    timeValue: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.text,
    },
    permissionSuccessCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.25)',
    },
    permissionSuccessText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.success,
      lineHeight: 18,
    },
    permissionPromptCard: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 20,
      padding: 15,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 12,
    },
    permissionTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    permissionCopy: {
      flex: 1,
      gap: 2,
    },
    permissionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
    },
    permissionDesc: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 17,
    },
    permissionBtn: {
      backgroundColor: theme.isDark ? '#27272A' : '#FCE7F3',
      borderRadius: 12,
      paddingVertical: 11,
      alignItems: 'center',
    },
    permissionBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.primary,
    },
  });
