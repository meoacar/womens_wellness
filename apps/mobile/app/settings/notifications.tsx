import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useFunNotificationStore } from '@/store/funNotificationStore';
import { remindersService } from '@/services/api';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationSettingsState,
  cancelAllScheduledAppNotifications,
  ensureAndroidNotificationChannels,
  getOsNotificationPermissionStatus,
  loadLocalNotificationSettings,
  openAppNotificationSettings,
  registerPushTokenWithBackend,
  requestOsNotificationPermission,
  saveLocalNotificationSettings,
  syncFunLocalNotifications,
  syncLocalRemindersSchedule,
  syncPendingServerNotifications,
  syncWellnessLocalNotifications,
} from '@/services/notificationEngine';
import { syncPeriodNotifications } from '@/services/periodNotificationSync';

export default function NotificationSettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const {
    setEnabled: setFunEnabled,
    setPeriodSupportNotifications,
  } = useFunNotificationStore();

  const [settings, setSettings] = useState<NotificationSettingsState>(
    DEFAULT_NOTIFICATION_SETTINGS,
  );
  const [osGranted, setOsGranted] = useState(false);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  const styles = createStyles(theme);

  const syncAllSchedules = useCallback(
    async (nextSettings: NotificationSettingsState, granted: boolean) => {
      if (!granted || !nextSettings.enabled) {
        await cancelAllScheduledAppNotifications();
        return;
      }

      await syncWellnessLocalNotifications(nextSettings);
      await syncFunLocalNotifications();
      await syncPeriodNotifications({
        scheduleLocal: nextSettings.periodReminders,
      }).catch(() => {});

      if (isAuthenticated) {
        const reminders = await remindersService.getReminders().catch(() => []);
        if (Array.isArray(reminders)) {
          await syncLocalRemindersSchedule(reminders as any);
        }
      }
    },
    [isAuthenticated],
  );

  const loadState = useCallback(async () => {
    try {
      const [perm, local] = await Promise.all([
        getOsNotificationPermissionStatus(),
        loadLocalNotificationSettings(),
      ]);
      setOsGranted(perm.granted);
      setCanAskAgain(perm.canAskAgain);

      let merged = local;
      if (isAuthenticated) {
        try {
          const remote = await remindersService.getNotificationPreferences();
          if (remote && typeof remote === 'object') {
            merged = {
              ...local,
              enabled:
                typeof remote.enabled === 'boolean' ? remote.enabled : local.enabled,
              periodReminders:
                typeof remote.periodReminders === 'boolean'
                  ? remote.periodReminders
                  : local.periodReminders,
              discreetMode:
                typeof remote.discreetMode === 'boolean'
                  ? remote.discreetMode
                  : local.discreetMode,
              pregnancyUpdates:
                typeof remote.pregnancyUpdates === 'boolean'
                  ? remote.pregnancyUpdates
                  : local.pregnancyUpdates,
              appointmentReminders:
                typeof remote.appointmentReminders === 'boolean'
                  ? remote.appointmentReminders
                  : local.appointmentReminders,
              dailyTips:
                typeof remote.dailyTips === 'boolean'
                  ? remote.dailyTips
                  : local.dailyTips,
              funNotifications:
                typeof remote.funNotifications === 'boolean'
                  ? remote.funNotifications
                  : local.funNotifications,
              meditationReminders:
                typeof remote.meditationReminders === 'boolean'
                  ? remote.meditationReminders
                  : local.meditationReminders,
              waterReminders:
                typeof remote.waterReminders === 'boolean'
                  ? remote.waterReminders
                  : local.waterReminders,
              quietHours: remote.quietHours
                ? {
                    enabled:
                      typeof remote.quietHours.enabled === 'boolean'
                        ? remote.quietHours.enabled
                        : local.quietHours.enabled,
                    startHour:
                      typeof remote.quietHours.startHour === 'number'
                        ? remote.quietHours.startHour
                        : typeof remote.quietHours.start === 'string'
                        ? Number(remote.quietHours.start.split(':')[0])
                        : local.quietHours.startHour,
                    endHour:
                      typeof remote.quietHours.endHour === 'number'
                        ? remote.quietHours.endHour
                        : typeof remote.quietHours.end === 'string'
                        ? Number(remote.quietHours.end.split(':')[0])
                        : local.quietHours.endHour,
                  }
                : local.quietHours,
            };
            await saveLocalNotificationSettings(merged);
          }
        } catch {
          // Use local state silently if offline
        }
      }

      setSettings(merged);
      setFunEnabled(merged.funNotifications);
      setPeriodSupportNotifications(merged.periodReminders);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, setFunEnabled, setPeriodSupportNotifications]);

  useEffect(() => {
    loadState();

    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        getOsNotificationPermissionStatus().then((perm) => {
          setOsGranted(perm.granted);
          setCanAskAgain(perm.canAskAgain);
        });
      }
    });

    return () => sub.remove();
  }, [loadState]);

  const persistUpdate = useCallback(
    async (
      next: NotificationSettingsState,
      grantedOverride?: boolean,
    ) => {
      const granted = grantedOverride ?? osGranted;
      setSettings(next);
      setFunEnabled(next.funNotifications);
      setPeriodSupportNotifications(next.periodReminders);

      await saveLocalNotificationSettings(next);

      if (isAuthenticated) {
        remindersService
          .updateNotificationPreferences({
            enabled: next.enabled,
            periodReminders: next.periodReminders,
            discreetMode: next.discreetMode,
            pregnancyUpdates: next.pregnancyUpdates,
            appointmentReminders: next.appointmentReminders,
            dailyTips: next.dailyTips,
            funNotifications: next.funNotifications,
            meditationReminders: next.meditationReminders,
            waterReminders: next.waterReminders,
            quietHours: next.quietHours,
          })
          .catch(() => {});
      }

      await syncAllSchedules(next, granted);
    },
    [
      isAuthenticated,
      osGranted,
      setFunEnabled,
      setPeriodSupportNotifications,
      syncAllSchedules,
    ],
  );

  const ensurePermissionIfEnabling = async (turningOn: boolean): Promise<boolean> => {
    if (!turningOn) return true;
    const perm = await getOsNotificationPermissionStatus();
    if (perm.granted) {
      setOsGranted(true);
      setCanAskAgain(perm.canAskAgain);
      return true;
    }

    const req = await requestOsNotificationPermission({ showSettingsPrompt: true });
    setOsGranted(req.granted);
    setCanAskAgain(req.canAskAgain);
    if (req.granted) {
      await registerPushTokenWithBackend();
      await syncPendingServerNotifications().catch(() => {});
    }
    return req.granted;
  };

  const handleMasterToggle = async (value: boolean) => {
    const granted = await ensurePermissionIfEnabling(value);
    if (value && !granted) {
      return;
    }
    await persistUpdate({ ...settings, enabled: value }, granted);
  };

  const handleToggleField = async (
    key: Exclude<keyof NotificationSettingsState, 'enabled' | 'quietHours'>,
    value: boolean,
  ) => {
    const granted = await ensurePermissionIfEnabling(value);
    if (value && !granted) {
      return;
    }
    const next: NotificationSettingsState = {
      ...settings,
      enabled: value ? true : settings.enabled,
      [key]: value,
    };
    await persistUpdate(next, granted);
  };

  const handleToggleQuietHours = async (value: boolean) => {
    await persistUpdate({
      ...settings,
      quietHours: {
        ...settings.quietHours,
        enabled: value,
      },
    });
  };

  const handleRequestOsPermission = async () => {
    const res = await requestOsNotificationPermission({ showSettingsPrompt: true });
    setOsGranted(res.granted);
    setCanAskAgain(res.canAskAgain);
    if (res.granted) {
      await registerPushTokenWithBackend();
      await syncPendingServerNotifications().catch(() => {});
      const next = { ...settings, enabled: true };
      await persistUpdate(next, true);
      Alert.alert(
        'Bildirim İzni Verildi',
        'Artık tüm aktif bildirim kategorileriniz zamanında çalışacak.',
      );
    }
  };

  const handleTestNotification = async () => {
    setTesting(true);
    try {
      const granted = await ensurePermissionIfEnabling(true);
      if (!granted) return;

      await ensureAndroidNotificationChannels();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Kadın Atlası Bildirim Testi 🔔',
          body: settings.discreetMode
            ? 'Gizli mod aktif: Günlük kontrol zamanın geldi.'
            : 'Bildirim ayarların aktif ve cihazına sorunsuz ulaşıyor.',
          sound: 'default',
          data: { screen: 'settings-notifications', test: true },
        },
        trigger: null,
      });

      if (isAuthenticated) {
        const res = await remindersService.testPush().catch(() => null);
        if (res?.status === 'queued') {
          await syncPendingServerNotifications().catch(() => {});
        }
      }

      Alert.alert(
        'Test Bildirimi Gönderildi',
        'Yerel bildirim ve sunucu senkronizasyonu başarıyla tetiklendi.',
      );
    } finally {
      setTesting(false);
    }
  };

  const effectiveMasterOn = osGranted && settings.enabled;
  const formatHour = (h: number) => `${String(h).padStart(2, '0')}:00`;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bildirim Ayarları</Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          {!osGranted && (
            <View style={styles.permissionBanner}>
              <View style={styles.permissionBannerRow}>
                <Ionicons name="notifications-off-outline" size={22} color="#B45309" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.permissionBannerTitle}>
                    Cihaz Bildirim İzni Kapalı
                  </Text>
                  <Text style={styles.permissionBannerText}>
                    {canAskAgain
                      ? 'Hatırlatıcı, su, regl desteği ve mizah bildirimlerinin gelmesi için izin vermelisin.'
                      : 'Bildirim izni sistem ayarlarından kapatılmış. Ayarlardan tekrar açabilirsin.'}
                  </Text>
                </View>
              </View>
              <View style={styles.permissionActionsRow}>
                <TouchableOpacity
                  style={styles.permissionPrimaryBtn}
                  onPress={handleRequestOsPermission}
                >
                  <Text style={styles.permissionPrimaryBtnText}>
                    Bildirim İzni Ver
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.permissionSecondaryBtn}
                  onPress={openAppNotificationSettings}
                >
                  <Text style={styles.permissionSecondaryBtnText}>
                    Cihaz Ayarları
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Master Switch */}
          <View style={styles.section}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Bildirimler</Text>
                <Text style={styles.settingDescription}>
                  {osGranted
                    ? 'Tüm bildirimleri aç/kapat'
                    : 'Önce cihaz bildirim izni gereklidir'}
                </Text>
              </View>
              <Switch
                value={effectiveMasterOn}
                onValueChange={handleMasterToggle}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary,
                }}
              />
            </View>
          </View>

          {/* Döngü & Sağlık */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Döngü & Sağlık</Text>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Regl & Döngü Desteği</Text>
                <Text style={styles.settingDescription}>
                  Yaklaşan regl tarihi, yumurtlama ve dönem destek mesajları
                </Text>
              </View>
              <Switch
                value={effectiveMasterOn && settings.periodReminders}
                onValueChange={(v) => handleToggleField('periodReminders', v)}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary,
                }}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>
                  Gizli Regl Modu (Discreet)
                </Text>
                <Text style={styles.settingDescription}>
                  Kilit ekranında &ldquo;regl&rdquo; yerine genel iyi yaşam mesajı göster
                </Text>
              </View>
              <Switch
                value={settings.discreetMode}
                onValueChange={(v) => handleToggleField('discreetMode', v)}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary,
                }}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Hamilelik Güncellemeleri</Text>
                <Text style={styles.settingDescription}>
                  Haftalık bebek gelişimi ve sağlık bilgileri
                </Text>
              </View>
              <Switch
                value={effectiveMasterOn && settings.pregnancyUpdates}
                onValueChange={(v) => handleToggleField('pregnancyUpdates', v)}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary,
                }}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Randevu Hatırlatıcıları</Text>
                <Text style={styles.settingDescription}>
                  Doktor randevularından önce hatırlatmalar
                </Text>
              </View>
              <Switch
                value={effectiveMasterOn && settings.appointmentReminders}
                onValueChange={(v) =>
                  handleToggleField('appointmentReminders', v)
                }
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary,
                }}
              />
            </View>
          </View>

          {/* Yaşam Tarzı & Eğlence */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Yaşam Tarzı & Eğlence</Text>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Günlük İpuçları</Text>
                <Text style={styles.settingDescription}>
                  Her gün saat 11:00&apos;da sağlık ve yaşam ipuçları
                </Text>
              </View>
              <Switch
                value={effectiveMasterOn && settings.dailyTips}
                onValueChange={(v) => handleToggleField('dailyTips', v)}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary,
                }}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Eğlenceli Bildirimler</Text>
                <Text style={styles.settingDescription}>
                  Mizahi mesajlar ve günlük motivasyonlar
                </Text>
              </View>
              <Switch
                value={effectiveMasterOn && settings.funNotifications}
                onValueChange={(v) => handleToggleField('funNotifications', v)}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary,
                }}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Meditasyon Hatırlatıcıları</Text>
                <Text style={styles.settingDescription}>
                  Her akşam 20:30&apos;da günlük meditasyon zamanı
                </Text>
              </View>
              <Switch
                value={effectiveMasterOn && settings.meditationReminders}
                onValueChange={(v) =>
                  handleToggleField('meditationReminders', v)
                }
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary,
                }}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Su İçme Hatırlatıcıları</Text>
                <Text style={styles.settingDescription}>
                  Gün içinde 10:00, 14:00, 17:00 ve 20:00&apos;da düzenli hatırlatma
                </Text>
              </View>
              <Switch
                value={effectiveMasterOn && settings.waterReminders}
                onValueChange={(v) => handleToggleField('waterReminders', v)}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary,
                }}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Sessiz Saatler</Text>
                <Text style={styles.settingDescription}>
                  {`${formatHour(settings.quietHours.startHour)} - ${formatHour(
                    settings.quietHours.endHour,
                  )} arası bildirim gönderme`}
                </Text>
              </View>
              <Switch
                value={settings.quietHours.enabled}
                onValueChange={handleToggleQuietHours}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary,
                }}
              />
            </View>
          </View>

          {/* Detaylı Ekranlar & Test */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hızlı Erişim & Test</Text>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/fun-notifications')}
            >
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Mizahi Bildirim Ayarları</Text>
                <Text style={styles.settingDescription}>
                  Sıklık, kategori ve anlık test ayarları
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/(tabs)/reminders')}
            >
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Özel Hatırlatıcılar</Text>
                <Text style={styles.settingDescription}>
                  Kişisel ilaç, vitamin ve kontrol hatırlatıcıların
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/(tabs)/community/notification-preferences')}
            >
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Topluluk Bildirimleri</Text>
                <Text style={styles.settingDescription}>
                  Yorum, beğeni ve takipçi tercihlerin
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.testButton, testing && { opacity: 0.7 }]}
              disabled={testing}
              onPress={handleTestNotification}
            >
              {testing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.testButtonText}>
                    Şimdi Test Bildirimi Gönder
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <Text style={styles.infoCardIcon}>🔔</Text>
            <View style={styles.infoCardContent}>
              <Text style={styles.infoCardTitle}>Bildirim İpucu</Text>
              <Text style={styles.infoCardText}>
                Tüm değişiklikler cihaz takvimine ve sunucudaki hesabına anında kaydedilir.
                Dilersen Gizli Regl Modu ile kilit ekranı gizliliğini artırabilirsin.
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
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
      fontSize: 24,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    headerRight: {
      width: 40,
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    container: {
      flex: 1,
    },
    permissionBanner: {
      marginHorizontal: theme.spacing.lg,
      marginTop: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: 12,
      backgroundColor: '#FEF3C7',
      borderWidth: 1,
      borderColor: '#F59E0B',
      gap: 10,
    },
    permissionBannerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    permissionBannerTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#92400E',
      marginBottom: 2,
    },
    permissionBannerText: {
      fontSize: 13,
      color: '#78350F',
      lineHeight: 18,
    },
    permissionActionsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    permissionPrimaryBtn: {
      flex: 1,
      backgroundColor: '#D97706',
      borderRadius: 8,
      paddingVertical: 9,
      alignItems: 'center',
    },
    permissionPrimaryBtnText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '600',
    },
    permissionSecondaryBtn: {
      paddingHorizontal: 14,
      borderRadius: 8,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: '#D97706',
      alignItems: 'center',
      justifyContent: 'center',
    },
    permissionSecondaryBtnText: {
      color: '#92400E',
      fontSize: 13,
      fontWeight: '600',
    },
    section: {
      marginTop: theme.spacing.lg,
      paddingHorizontal: theme.spacing.lg,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    settingItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    navItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    settingInfo: {
      flex: 1,
      marginRight: theme.spacing.md,
    },
    settingTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    testButton: {
      marginTop: theme.spacing.md,
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    testButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
    },
    infoCard: {
      flexDirection: 'row',
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 12,
      padding: theme.spacing.md,
      margin: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    infoCardIcon: {
      fontSize: 24,
      marginRight: theme.spacing.md,
    },
    infoCardContent: {
      flex: 1,
    },
    infoCardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    infoCardText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
  });
