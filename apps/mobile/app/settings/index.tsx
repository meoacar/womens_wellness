import { useState, useEffect, useMemo } from 'react';
import appConfig from '../../app.json';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Switch,
  Platform,
  Linking,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { api, userService, qnaService, quotaService, postpartumService } from '@/services/api';
import { healthConnectSyncService } from '@/services/healthConnectSync';
import { pedometerSyncService } from '@/services/pedometerSync';
import { gamificationService } from '@/services/gamification';
import { useTheme } from '@/hooks/useTheme';
import { saveLocalPinHash, clearLocalPinHash } from '@/utils/pinHash';
import { PinInputModal } from '@/components/PinInputModal';
import { PremiumBadge } from '@/components/premium/PremiumBadge';
import { resolveAvatarSource } from '@/utils/avatar';
import { GracePeriodBanner } from '@/components/premium/GracePeriodBanner';
import { usePremium } from '@/hooks/usePremium';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { getZodiacSign, ZODIAC_SIGNS } from '@/utils/astrology';
import type { QnaQuota } from '@/types/qna';
import type { GamificationStats } from '@/types/gamification';

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, logout, isAuthenticated } = useAuthStore();
  const { isDarkMode, setDarkMode } = useThemeStore();
  const { flags } = useFeatureFlags();
  const theme = useTheme();

  const { subscription, isPremium } = usePremium();

  const { data: userData, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => userService.getMe(),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    enabled: isAuthenticated,
  });

  const { data: novaQuota } = useQuery<any>({
    queryKey: ['nova', 'quota'],
    queryFn: () => quotaService.getStatus(),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });

  const { data: qnaQuota } = useQuery<QnaQuota>({
    queryKey: ['qna', 'quota'],
    queryFn: () => qnaService.getQuota(),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });

  const { data: gamificationStats } = useQuery<GamificationStats>({
    queryKey: ['gamification-stats'],
    queryFn: () => gamificationService.getStats(),
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000,
  });

  const [isExporting, setIsExporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isEmailBackingUp, setIsEmailBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showPinChange, setShowPinChange] = useState(false);
  const [showPinDisable, setShowPinDisable] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('biometricEnabled')
      .then((val) => setBiometricEnabled(val === 'true'))
      .catch(() => {});
  }, []);

  const handleBiometricToggle = async (nextValue: boolean) => {
    if (!nextValue) {
      await SecureStore.setItemAsync('biometricEnabled', 'false').catch(() => {});
      setBiometricEnabled(false);
      return;
    }
    try {
      const [hasHw, enrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      if (!hasHw || !enrolled) {
        Alert.alert(
          'Biyometrik Doğrulama Bulunamadı',
          'Cihazınızda kayıtlı parmak izi veya yüz tanıma bulunmuyor.',
        );
        return;
      }
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Parmak izi / Face ID kilidini etkinleştir',
        fallbackLabel: 'İptal',
      });
      if (res.success) {
        await SecureStore.setItemAsync('biometricEnabled', 'true').catch(() => {});
        setBiometricEnabled(true);
      }
    } catch {
      Alert.alert('Hata', 'Biyometrik doğrulama başlatılamadı.');
    }
  };

  const { data: pinStatus } = useQuery({
    queryKey: ['pin-status'],
    queryFn: () => userService.getPinStatus(),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (pinStatus) {
      setPinEnabled(pinStatus.pinEnabled);
    }
  }, [pinStatus]);

  const profile = (userData as any)?.profile || (user as any)?.profile;
  const fullName =
    profile?.firstName && profile?.lastName
      ? `${profile.firstName} ${profile.lastName}`
      : profile?.displayName || user?.email?.split('@')[0] || 'Misafir';

  const zodiacInfo = useMemo(() => {
    if (!profile?.dateOfBirth) return null;
    const sign = getZodiacSign(profile.dateOfBirth);
    return ZODIAC_SIGNS[sign];
  }, [profile?.dateOfBirth]);

  const bmiValue = useMemo(() => {
    if (!profile?.heightCm || !profile?.weightKg) return null;
    const h = profile.heightCm / 100;
    return (profile.weightKg / (h * h)).toFixed(1);
  }, [profile?.heightCm, profile?.weightKg]);

  const profileCompletion = useMemo(() => {
    const checks = [
      !!profile?.firstName,
      !!profile?.lastName,
      !!(userData as any)?.username,
      !!profile?.dateOfBirth,
      !!profile?.heightCm && !!profile?.weightKg,
      !!profile?.profilePictureUrl,
    ];
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  }, [profile, userData]);

  const handleLogout = () => {
    Alert.alert('Çıkış Yap', 'Çıkış yapmak istediğinizden emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkış Yap',
        style: 'destructive',
        onPress: async () => {
          await queryClient.clear();
          await logout();
          router.replace('/(auth)/signin');
        },
      },
    ]);
  };

  const deleteAccountMutation = useMutation({
    mutationFn: () => userService.deleteMe(),
    onSuccess: async () => {
      await queryClient.clear();
      await logout();
      router.replace('/(auth)/signin');
    },
    onError: (error: any) => {
      Alert.alert('Hata', error.message || 'Hesap silinemedi');
    },
  });

  const handleDeleteAccount = () => {
    Alert.alert(
      'Hesabı Sil',
      'Hesabınızı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve tüm verileriniz silinecektir.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Hesabı Sil',
          style: 'destructive',
          onPress: () => deleteAccountMutation.mutate(),
        },
      ]
    );
  };

  const handleSyncData = async () => {
    try {
      setIsSyncing(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['me'] }),
        queryClient.invalidateQueries({ queryKey: ['nova', 'quota'] }),
        queryClient.invalidateQueries({ queryKey: ['gamification-stats'] }),
      ]);
      Alert.alert('Başarılı', 'Verileriniz sunucuyla senkronize edildi');
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Senkronizasyon başarısız');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleEmailBackup = async () => {
    try {
      setIsEmailBackingUp(true);
      const res = await api.post<{ sentTo: string }>('/users/me/backup-email');
      Alert.alert(
        'Yedek Gönderildi',
        `Tüm döngü ve sağlık verileriniz JSON yedeği olarak ${res.sentTo || user?.email || 'e-posta adresinize'} gönderildi.`,
      );
    } catch (error: any) {
      Alert.alert('Hata', error?.message || 'Yedek e-posta gönderilemedi');
    } finally {
      setIsEmailBackingUp(false);
    }
  };

  const handleRestoreBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      setIsRestoring(true);
      const rawContent = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const parsed = JSON.parse(rawContent);
      const res = await api.post<{
        restoredCycles: number;
        restoredDailyLogs: number;
        restoredWaterLogs: number;
        restoredSleepLogs: number;
      }>('/users/me/restore-backup', parsed);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['me'] }),
        queryClient.invalidateQueries({ queryKey: ['cycles'] }),
        queryClient.invalidateQueries({ queryKey: ['daily-logs'] }),
      ]);

      Alert.alert(
        'Geri Yükleme Tamamlandı',
        `${res.restoredCycles} döngü, ${res.restoredDailyLogs} günlük kayıt, ${res.restoredWaterLogs} su kaydı ve ${res.restoredSleepLogs} uyku kaydı hesabınıza aktarıldı.`,
      );
    } catch (error: any) {
      Alert.alert(
        'Geri Yükleme Başarısız',
        error?.message || 'Seçilen dosya geçerli bir Kadın Atlası JSON yedeği değil.',
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDownloadData = async () => {
    try {
      setIsExporting(true);
      const exportData = await userService.exportMyData();
      const filename = `womens-wellness-data-${new Date().toISOString().split('T')[0]}.json`;

      if (!FileSystem.cacheDirectory) {
        throw new Error('Dosya sistemi kullanılamıyor');
      }

      const fileUri = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(exportData, null, 2));

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Verilerimi İndir',
        });
      } else {
        Alert.alert('Başarılı', `Verileriniz indirildi: ${filename}`);
      }
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Veriler indirilemedi');
    } finally {
      setIsExporting(false);
    }
  };

  const handleShareApp = async () => {
    const shareUrl =
      Platform.OS === 'ios'
        ? 'https://apps.apple.com/app/id123456789'
        : 'https://play.google.com/store/apps/details?id=com.womenswellness';
    try {
      await Share.share({
        message: `Women's Wellness Companion uygulamasını denemelisin! 🌸 ${shareUrl}`,
      });
    } catch {
      Alert.alert('Hata', 'Paylaşım açılamadı');
    }
  };

  const handleSetupPin = async (pin: string) => {
    await userService.setupPin(pin);
    setPinEnabled(true);
    await SecureStore.setItemAsync('pinEnabled', 'true');
    await SecureStore.deleteItemAsync('pinVerified').catch(() => undefined);
    const uid = useAuthStore.getState().user?.id;
    if (uid) await saveLocalPinHash(uid, pin);
    useAuthStore.getState().setPinStatus(true, true);
    await queryClient.invalidateQueries({ queryKey: ['pin-status'] });
    Alert.alert('Başarılı', 'PIN kilidi aktif edildi');
  };

  const handleChangePin = async (newPin: string, currentPin?: string) => {
    if (!currentPin) {
      throw new Error('Mevcut PIN gereklidir');
    }
    await userService.changePin(currentPin, newPin);
    const uid = useAuthStore.getState().user?.id;
    if (uid) await saveLocalPinHash(uid, newPin);
    Alert.alert('Başarılı', 'PIN kodunuz başarıyla güncellendi');
  };

  const handleConfirmDisablePin = async (pin: string) => {
    await userService.disablePin(pin);
    setPinEnabled(false);
    await SecureStore.setItemAsync('pinEnabled', 'false');
    await SecureStore.deleteItemAsync('pinVerified').catch(() => undefined);
    await clearLocalPinHash();
    useAuthStore.getState().setPinStatus(false, false);
    await queryClient.invalidateQueries({ queryKey: ['pin-status'] });
    Alert.alert('Başarılı', 'PIN kilidi kaldırıldı');
  };

  const handlePinToggle = () => {
    if (pinEnabled) {
      setShowPinDisable(true);
    } else {
      setShowPinSetup(true);
    }
  };

  const styles = createStyles(theme);

  const renderSettingRow = ({
    icon,
    iconColor,
    title,
    subtitle,
    onPress,
    rightElement,
    isLast = false,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    isLast?: boolean;
  }) => {
    const Container: any = onPress ? TouchableOpacity : View;
    return (
      <Container
        style={[styles.rowItem, !isLast && styles.rowBorder]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        <View style={[styles.rowIconBox, { backgroundColor: `${iconColor}18` }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <View style={styles.rowTextBlock}>
          <Text style={styles.rowTitle}>{title}</Text>
          {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
        </View>
        {rightElement ?? (
          <Ionicons name="chevron-forward" size={17} color={theme.colors.textLight} />
        )}
      </Container>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const novaUsed = novaQuota?.used ?? subscription?.aiMessagesUsed ?? 0;
  const novaLimit = novaQuota?.limit ?? subscription?.aiMessagesLimit ?? 100;
  const novaPct = novaLimit > 0 ? Math.min(100, Math.round((novaUsed / novaLimit) * 100)) : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Clean Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.circleIconBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profilim</Text>
        <TouchableOpacity
          onPress={() => router.push('/settings/profile' as any)}
          style={styles.circleIconBtn}
        >
          <Ionicons name="create-outline" size={19} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Gradient Profile Hero Card */}
        <LinearGradient
          colors={theme.isDark ? ['#581C87', '#831843'] : ['#EC4899', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTopRow}>
            <TouchableOpacity
              onPress={() => router.push('/settings/profile' as any)}
              style={styles.avatarWrapper}
              activeOpacity={0.85}
            >
              {profile?.profilePictureUrl ? (
                <Image
                  source={resolveAvatarSource(profile.profilePictureUrl)!}
                  style={styles.avatarImg}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {fullName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={12} color="#EC4899" />
              </View>
            </TouchableOpacity>

            <View style={styles.heroInfo}>
              <View style={styles.heroNameRow}>
                <Text style={styles.heroName} numberOfLines={1}>
                  {fullName}
                </Text>
                {isPremium && <PremiumBadge size="small" variant="icon" />}
              </View>
              <Text style={styles.heroUsername}>
                @{(userData as any)?.username || 'kullanici'}
              </Text>
              <Text style={styles.heroEmail} numberOfLines={1}>
                {(userData as any)?.email}
              </Text>

              <View style={styles.heroBadgesRow}>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>
                    {isPremium ? '✨ Premium' : 'Ücretsiz Plan'}
                  </Text>
                </View>
                {flags.astrology_enabled !== false && zodiacInfo && (
                  <TouchableOpacity
                    style={styles.heroPill}
                    onPress={() => router.push(`/astrology/${zodiacInfo.sign}` as any)}
                  >
                    <Text style={styles.heroPillText}>
                      {zodiacInfo.emoji} {zodiacInfo.nameTr}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Profile Completion Bar if < 100% */}
          {profileCompletion < 100 && (
            <TouchableOpacity
              style={styles.completionBox}
              onPress={() => router.push('/settings/profile' as any)}
              activeOpacity={0.85}
            >
              <View style={styles.completionHeader}>
                <Text style={styles.completionLabel}>
                  Profil Tamamlama • %{profileCompletion}
                </Text>
                <Text style={styles.completionAction}>Tamamla →</Text>
              </View>
              <View style={styles.completionTrack}>
                <View
                  style={[styles.completionFill, { width: `${profileCompletion}%` }]}
                />
              </View>
            </TouchableOpacity>
          )}

          {/* 3-Column Live Wellness Stats Strip */}
          <View style={styles.statsStrip}>
            <TouchableOpacity
              style={styles.statCell}
              onPress={() => router.push('/gamification' as any)}
            >
              <Text style={styles.statValue}>
                {gamificationStats?.currentStreak ?? 0}g 🔥
              </Text>
              <Text style={styles.statLabel}>Seri</Text>
            </TouchableOpacity>

            <View style={styles.statDivider} />

            <TouchableOpacity
              style={styles.statCell}
              onPress={() => router.push('/gamification' as any)}
            >
              <Text style={styles.statValue}>
                Sv. {gamificationStats?.level ?? 1}
              </Text>
              <Text style={styles.statLabel}>
                {gamificationStats?.achievements ?? 0} Rozet
              </Text>
            </TouchableOpacity>

            <View style={styles.statDivider} />

            <TouchableOpacity
              style={styles.statCell}
              onPress={() => router.push('/settings/profile' as any)}
            >
              <Text style={styles.statValue}>{bmiValue ?? '—'}</Text>
              <Text style={styles.statLabel}>VKİ</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Quick Shortcuts Row */}
        <View style={styles.shortcutsRow}>
          <TouchableOpacity
            style={styles.shortcutTile}
            onPress={() => router.push('/gamification?tab=achievements' as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.shortcutIcon, { backgroundColor: 'rgba(245, 158, 11, 0.14)' }]}>
              <Ionicons name="trophy" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.shortcutLabel}>Rozetler</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shortcutTile}
            onPress={() => router.push('/gamification?tab=insights' as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.shortcutIcon, { backgroundColor: 'rgba(16, 185, 129, 0.14)' }]}>
              <Ionicons name="bulb" size={20} color="#10B981" />
            </View>
            <Text style={styles.shortcutLabel}>
              İçgörüler{gamificationStats?.unreadInsights ? ` (${gamificationStats.unreadInsights})` : ''}
            </Text>
          </TouchableOpacity>

          {flags.community_enabled !== false && (
            <TouchableOpacity
              style={styles.shortcutTile}
              onPress={() => router.push('/(tabs)/community/my-questions' as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.shortcutIcon, { backgroundColor: 'rgba(236, 72, 153, 0.14)' }]}>
                <Ionicons name="chatbubbles" size={20} color="#EC4899" />
              </View>
              <Text style={styles.shortcutLabel}>Sorularım</Text>
            </TouchableOpacity>
          )}

          {flags.astrology_enabled !== false && (
            <TouchableOpacity
              style={styles.shortcutTile}
              onPress={() => router.push('/astrology/birth-chart' as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.shortcutIcon, { backgroundColor: 'rgba(139, 92, 246, 0.14)' }]}>
                <Ionicons name="planet" size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.shortcutLabel}>Haritam</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Grace Period Banner */}
        {isPremium && subscription?.isInGracePeriod && (
          <GracePeriodBanner subscription={subscription} />
        )}

        {/* Quotas & Subscription Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Abonelik ve Kotalar</Text>
            {isPremium ? (
              <View style={styles.planTagPremium}>
                <Text style={styles.planTagPremiumText}>
                  {subscription?.tier === 'YEARLY' ? 'Yıllık Premium' : 'Aylık Premium'}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.upgradeMiniPill}
                onPress={() => router.push('/premium' as any)}
              >
                <Ionicons name="sparkles" size={12} color="#FFFFFF" />
                <Text style={styles.upgradeMiniText}>Premium</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* NOVA Quota Bar (Synced with Admin Panel) */}
          <View style={styles.quotaBlock}>
            <View style={styles.quotaTopRow}>
              <Text style={styles.quotaName}>NOVA AI Mesaj Kotası</Text>
              <Text style={styles.quotaCount}>
                {novaUsed} / {novaLimit}
              </Text>
            </View>
            <View style={styles.quotaTrack}>
              <View
                style={[
                  styles.quotaFill,
                  {
                    width: `${novaPct}%`,
                    backgroundColor:
                      novaPct >= 100
                        ? theme.colors.error
                        : novaPct >= 80
                          ? '#F59E0B'
                          : theme.colors.primary,
                  },
                ]}
              />
            </View>
          </View>

          {/* QnA Quota Bar */}
          {qnaQuota && (
            <View style={styles.quotaBlock}>
              <View style={styles.quotaTopRow}>
                <Text style={styles.quotaName}>Topluluk Soru Kotası</Text>
                <Text style={styles.quotaCount}>
                  {qnaQuota.questionsAsked} / {qnaQuota.limit}
                </Text>
              </View>
              <View style={styles.quotaTrack}>
                <View
                  style={[
                    styles.quotaFill,
                    {
                      width: `${Math.min(100, Math.round((qnaQuota.questionsAsked / Math.max(1, qnaQuota.limit)) * 100))}%`,
                      backgroundColor: '#8B5CF6',
                    },
                  ]}
                />
              </View>
            </View>
          )}

          {isPremium ? (
            <View style={styles.premiumLinksRow}>
              <TouchableOpacity
                style={styles.subActionBtn}
                onPress={() => router.push('/premium/stats' as any)}
              >
                <Ionicons name="stats-chart-outline" size={15} color={theme.colors.primary} />
                <Text style={styles.subActionText}>İstatistikler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.subActionBtn}
                onPress={() => {
                  const url =
                    Platform.OS === 'ios'
                      ? 'https://apps.apple.com/account/subscriptions'
                      : 'https://play.google.com/store/account/subscriptions';
                  Linking.openURL(url).catch(() =>
                    Alert.alert('Hata', 'Abonelik yönetimi açılamadı')
                  );
                }}
              >
                <Ionicons name="card-outline" size={15} color={theme.colors.primary} />
                <Text style={styles.subActionText}>Aboneliği Yönet</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.upgradeBannerBtn}
              onPress={() => router.push('/premium' as any)}
              activeOpacity={0.85}
            >
              <Ionicons name="diamond-outline" size={16} color="#FFFFFF" />
              <Text style={styles.upgradeBannerText}>
                Premium ile Yüksek Limit & Gelişmiş İçgörüler
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Preferences & Security */}
        <Text style={styles.groupHeading}>Görünüm ve Güvenlik</Text>
        <View style={styles.groupedCard}>
          {renderSettingRow({
            icon: isDarkMode ? 'moon' : 'sunny-outline',
            iconColor: '#8B5CF6',
            title: 'Koyu Tema',
            subtitle: isDarkMode ? 'Karanlık mod açık' : 'Aydınlık mod açık',
            rightElement: (
              <Switch
                value={isDarkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
              />
            ),
          })}
          {renderSettingRow({
            icon: 'language-outline',
            iconColor: '#3B82F6',
            title: 'Uygulama Dili',
            subtitle: 'Türkçe',
            onPress: () => router.push('/settings/language' as any),
          })}
          {renderSettingRow({
            icon: 'keypad-outline',
            iconColor: '#EC4899',
            title: 'PIN Kilidi',
            subtitle: pinEnabled ? 'Uygulama açılışında PIN aktif' : 'Ekstra gizlilik koruması',
            rightElement: (
              <Switch
                value={pinEnabled}
                onValueChange={handlePinToggle}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
              />
            ),
          })}
          {pinEnabled &&
            renderSettingRow({
              icon: 'finger-print-outline',
              iconColor: '#8B5CF6',
              title: 'Parmak İzi / Face ID',
              subtitle: biometricEnabled
                ? 'PIN ekranında biyometrik kilit açma aktif'
                : 'PIN yerine parmak izi ile hızlı aç',
              rightElement: (
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleBiometricToggle}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
                />
              ),
            })}
          {pinEnabled &&
            renderSettingRow({
              icon: 'key-outline',
              iconColor: '#F59E0B',
              title: 'PIN Kodunu Değiştir',
              onPress: () => setShowPinChange(true),
            })}
          {flags.partner_mode_enabled !== false &&
            renderSettingRow({
              icon: 'heart-half-outline',
              iconColor: '#EC4899',
              title: 'Partner Modu',
              subtitle: 'Eşinle gizlilik korumalı faz paylaşımı',
              onPress: () => router.push('/settings/partner' as any),
            })}
          {renderSettingRow({
            icon: 'lock-closed-outline',
            iconColor: '#10B981',
            title: 'Şifre Değiştir',
            subtitle: 'Hesap güvenliğini güncelle',
            onPress: () => router.push('/settings/change-password' as any),
            isLast: true,
          })}
        </View>

        {/* Notifications & Fun */}
        <Text style={styles.groupHeading}>Bildirimler ve Motivasyon</Text>
        <View style={styles.groupedCard}>
          {renderSettingRow({
            icon: 'notifications-outline',
            iconColor: '#F59E0B',
            title: 'Bildirim Ayarları',
            subtitle: 'Döngü ve su hatırlatıcılarını yönet',
            onPress: () => router.push('/settings/notifications' as any),
          })}
          {renderSettingRow({
            icon: 'happy-outline',
            iconColor: '#EC4899',
            title: 'Mizahi Bildirimler',
            subtitle: 'Eğlenceli günlük motivasyon kartları',
            onPress: () => router.push('/fun-notifications' as any),
            isLast: true,
          })}
        </View>

        {/* Data & Privacy */}
        <Text style={styles.groupHeading}>Veri ve Gizlilik</Text>
        <View style={styles.groupedCard}>
          {renderSettingRow({
            icon: 'heart-circle-outline',
            iconColor: '#EC4899',
            title: 'Anne & Bebek Merkezi',
            subtitle: 'Emzirme, bez, uyku, büyüme & aşı takibi',
            onPress: () => router.push('/postpartum' as any),
          })}
          {renderSettingRow({
            icon: 'compass-outline',
            iconColor: '#F59E0B',
            title: 'Yaşam Evresi Modu',
            subtitle: 'Döngü, Doğurganlık, Gebelik veya Anne & Bebek',
            onPress: () => {
              Alert.alert('Yaşam Evresi Seç', 'Uygulamanın odak modunu seçin:', [
                {
                  text: 'Döngü & Wellness',
                  onPress: () =>
                    postpartumService
                      .updateLifeStage('CYCLE')
                      .then(() => queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] }))
                      .catch(() => {}),
                },
                {
                  text: 'Doğurganlık (Planlama)',
                  onPress: () =>
                    postpartumService
                      .updateLifeStage('FERTILITY')
                      .then(() => queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] }))
                      .catch(() => {}),
                },
                {
                  text: 'Gebelik',
                  onPress: () =>
                    postpartumService
                      .updateLifeStage('PREGNANCY')
                      .then(() => {
                        queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });
                        router.push('/pregnancy');
                      })
                      .catch(() => {}),
                },
                {
                  text: 'Anne & Bebek',
                  onPress: () =>
                    postpartumService
                      .updateLifeStage('POSTPARTUM')
                      .then(() => {
                        queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });
                        router.push('/postpartum' as any);
                      })
                      .catch(() => {}),
                },
                { text: 'İptal', style: 'cancel' },
              ]);
            },
          })}
          {Platform.OS === 'android' &&
            renderSettingRow({
              icon: 'watch-outline',
              iconColor: '#0EA5E9',
              title: 'Health Connect (Akıllı Saat)',
              subtitle: 'Saat ve sağlık uygulamasından adım & uyku çek',
              onPress: async () => {
                const available = await healthConnectSyncService.isAvailable();
                if (!available) {
                  Alert.alert(
                    'Health Connect Bulunamadı',
                    'Cihazınızda Health Connect yüklü değil veya desteklenmiyor.',
                  );
                  return;
                }
                const ok = await healthConnectSyncService.requestPermissions();
                if (ok) {
                  await pedometerSyncService.syncNow(true);
                  const steps = await healthConnectSyncService.getTodaySteps();
                  Alert.alert(
                    'Bağlantı Başarılı',
                    steps != null
                      ? `Health Connect senkronize edildi. Bugünkü adım: ${steps}`
                      : 'Health Connect bağlantısı kuruldu.',
                  );
                } else {
                  Alert.alert(
                    'İzin Gerekli',
                    'Health Connect izinlerini açmak için ayarlara gitmek ister misiniz?',
                    [
                      { text: 'İptal', style: 'cancel' },
                      {
                        text: 'Ayarları Aç',
                        onPress: () => healthConnectSyncService.openSettings(),
                      },
                    ],
                  );
                }
              },
            })}
          {renderSettingRow({
            icon: 'document-text-outline',
            iconColor: '#8B5CF6',
            title: 'Sağlık & Doktor Raporu',
            subtitle: 'Son 30/90 günlük özet raporu paylaş',
            onPress: () => router.push('/metrics/health-report' as any),
          })}
          {renderSettingRow({
            icon: 'sync-outline',
            iconColor: '#06B6D4',
            title: 'Verileri Senkronize Et',
            subtitle: `Hesabınıza (${user?.email || 'sunucu'}) bağlı · Yeni telefonda otomatik yüklenir`,
            onPress: handleSyncData,
            rightElement: isSyncing ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : undefined,
          })}
          {renderSettingRow({
            icon: 'download-outline',
            iconColor: '#10B981',
            title: 'Verilerimi İndir (JSON)',
            onPress: handleDownloadData,
            rightElement: isExporting ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : undefined,
          })}
          {renderSettingRow({
            icon: 'mail-outline',
            iconColor: '#EC4899',
            title: 'Yedeğimi E-postama Gönder',
            subtitle: 'Tüm verilerinizi JSON eki olarak mail kutunuza yedekleyin',
            onPress: handleEmailBackup,
            rightElement: isEmailBackingUp ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : undefined,
          })}
          {renderSettingRow({
            icon: 'cloud-upload-outline',
            iconColor: '#8B5CF6',
            title: 'Yedek Dosyasından Geri Yükle',
            subtitle: 'E-posta veya cihazınızdaki JSON yedeğini hesabınıza aktarın',
            onPress: handleRestoreBackup,
            rightElement: isRestoring ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : undefined,
          })}
          {renderSettingRow({
            icon: 'ban-outline',
            iconColor: '#EF4444',
            title: 'Engellenen Kullanıcılar',
            subtitle: 'Toplulukta engellediğiniz kişileri yönetin',
            onPress: () => router.push('/community/blocked-users'),
          })}
          {renderSettingRow({
            icon: 'shield-checkmark-outline',
            iconColor: '#6366F1',
            title: 'KVKK İzinleri',
            onPress: () => router.push('/settings/kvkk-consent' as any),
          })}
          {renderSettingRow({
            icon: 'document-text-outline',
            iconColor: '#64748B',
            title: 'Gizlilik Politikası',
            onPress: () => router.push('/settings/privacy-policy' as any),
          })}
          {renderSettingRow({
            icon: 'reader-outline',
            iconColor: '#64748B',
            title: 'Kullanım Koşulları',
            onPress: () => router.push('/settings/terms-of-service' as any),
            isLast: true,
          })}
        </View>

        {/* Support & Share */}
        <Text style={styles.groupHeading}>Destek ve Hakkında</Text>
        <View style={styles.groupedCard}>
          {renderSettingRow({
            icon: 'help-circle-outline',
            iconColor: '#3B82F6',
            title: 'Yardım Merkezi',
            onPress: () => router.push('/settings/help' as any),
          })}
          {renderSettingRow({
            icon: 'chatbubble-ellipses-outline',
            iconColor: '#EC4899',
            title: 'Destek Ekibiyle İletişim',
            subtitle: 'Uygulama içinden mesaj gönder ve takip et',
            onPress: () => router.push('/settings/support' as any),
          })}
          {renderSettingRow({
            icon: 'share-social-outline',
            iconColor: '#10B981',
            title: 'Uygulamayı Paylaş',
            onPress: handleShareApp,
          })}
          {renderSettingRow({
            icon: 'information-circle-outline',
            iconColor: '#64748B',
            title: 'Hakkında & Sürüm',
            subtitle: `Versiyon ${appConfig.expo.version}`,
            onPress: () => router.push('/settings/about' as any),
            isLast: true,
          })}
        </View>

        {/* Account Actions */}
        <View style={styles.accountActions}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={18} color={theme.colors.text} />
            <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteAccount}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={17} color={theme.colors.error} />
            <Text style={styles.deleteButtonText}>Hesabı Kalıcı Olarak Sil</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <PinInputModal
        visible={showPinSetup}
        onClose={() => setShowPinSetup(false)}
        onSuccess={handleSetupPin}
        title="PIN Kodu Oluştur"
        subtitle="Uygulamanızı korumak için 4–6 haneli bir PIN oluşturun"
        mode="setup"
        requireConfirm={true}
      />

      <PinInputModal
        visible={showPinChange}
        onClose={() => setShowPinChange(false)}
        onSuccess={handleChangePin}
        title="PIN Kodunu Değiştir"
        subtitle="Önce mevcut, ardından yeni PIN kodunuzu girin"
        mode="change"
        requireConfirm={true}
      />

      <PinInputModal
        visible={showPinDisable}
        onClose={() => setShowPinDisable(false)}
        onSuccess={handleConfirmDisablePin}
        title="PIN Kilidini Kaldır"
        subtitle="Devam etmek için mevcut PIN kodunuzu doğrulayın"
        mode="verify"
        requireConfirm={false}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    circleIconBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.text,
    },
    container: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 48,
      gap: 14,
    },
    heroCard: {
      borderRadius: 24,
      padding: 18,
      gap: 16,
      shadowColor: '#EC4899',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 14,
      elevation: 6,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    avatarWrapper: {
      position: 'relative',
    },
    avatarImg: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 2.5,
      borderColor: 'rgba(255,255,255,0.65)',
    },
    avatarPlaceholder: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: 'rgba(255,255,255,0.22)',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarInitial: {
      fontSize: 28,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    avatarEditBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      justifyContent: 'center',
      alignItems: 'center',
    },
    heroInfo: {
      flex: 1,
      gap: 2,
    },
    heroNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    heroName: {
      fontSize: 20,
      fontWeight: '800',
      color: '#FFFFFF',
      flexShrink: 1,
    },
    heroUsername: {
      fontSize: 13,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.88)',
    },
    heroEmail: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.75)',
    },
    heroBadgesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 6,
    },
    heroPill: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    heroPillText: {
      color: '#FFFFFF',
      fontSize: 11.5,
      fontWeight: '700',
    },
    completionBox: {
      backgroundColor: 'rgba(0,0,0,0.18)',
      borderRadius: 14,
      padding: 11,
      gap: 6,
    },
    completionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    completionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    completionAction: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FDE68A',
    },
    completionTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.2)',
      overflow: 'hidden',
    },
    completionFill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: '#FDE68A',
    },
    statsStrip: {
      flexDirection: 'row',
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderRadius: 16,
      paddingVertical: 10,
      alignItems: 'center',
    },
    statCell: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    statDivider: {
      width: 1,
      height: 24,
      backgroundColor: 'rgba(255,255,255,0.22)',
    },
    statValue: {
      fontSize: 15,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    statLabel: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.85)',
      fontWeight: '600',
    },
    shortcutsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    shortcutTile: {
      flex: 1,
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 4,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 6,
    },
    shortcutIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    shortcutLabel: {
      fontSize: 11.5,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
    },
    card: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.text,
    },
    planTagPremium: {
      backgroundColor: 'rgba(245, 158, 11, 0.16)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    planTagPremiumText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: '#D97706',
    },
    upgradeMiniPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
    },
    upgradeMiniText: {
      color: '#FFFFFF',
      fontSize: 11.5,
      fontWeight: '700',
    },
    quotaBlock: {
      gap: 6,
    },
    quotaTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    quotaName: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    quotaCount: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.text,
    },
    quotaTrack: {
      height: 7,
      borderRadius: 3.5,
      backgroundColor: theme.colors.background,
      overflow: 'hidden',
    },
    quotaFill: {
      height: '100%',
      borderRadius: 3.5,
    },
    premiumLinksRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 2,
    },
    subActionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    subActionText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    upgradeBannerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: 14,
      paddingVertical: 12,
      marginTop: 2,
    },
    upgradeBannerText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },
    groupHeading: {
      fontSize: 12.5,
      fontWeight: '700',
      color: theme.colors.textLight,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginLeft: 6,
      marginTop: 4,
    },
    groupedCard: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    rowItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 12,
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    rowIconBox: {
      width: 34,
      height: 34,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    rowTextBlock: {
      flex: 1,
    },
    rowTitle: {
      fontSize: 14.5,
      fontWeight: '600',
      color: theme.colors.text,
    },
    rowSubtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 1,
    },
    accountActions: {
      gap: 10,
      marginTop: 6,
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 16,
      paddingVertical: 13,
    },
    logoutButtonText: {
      fontSize: 14.5,
      fontWeight: '700',
      color: theme.colors.text,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: 'rgba(239, 68, 68, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.25)',
      borderRadius: 16,
      paddingVertical: 13,
    },
    deleteButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.error,
    },
  });
