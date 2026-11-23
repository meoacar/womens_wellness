import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/store/authStore';
import { homeService, discoverService, userService } from '@/services/api';
import { widgetSyncService } from '@/services/widgetSync';
import { usePedometer } from '@/hooks/usePedometer';
import { useTheme } from '@/hooks/useTheme';
import { PriorityCard } from '@/components/home/PriorityCard';
import { WaterTile, StepsTile, MeditationTile, SleepTile } from '@/components/wellness';
import { ArticleCard } from '@/components/discover/ArticleCard';
import { usePremium } from '@/hooks/usePremium';
import { PremiumBadge } from '@/components/premium/PremiumBadge';
import { DailyHabitSection } from '@/components/home/DailyHabitSection';
import { DailyMicroCardsDeck } from '@/components/home/DailyMicroCardsDeck';
import { CycleWheelHero } from '@/components/home/CycleWheelHero';
import { WinbackOfferBanner } from '@/components/home/WinbackOfferBanner';
import { FunNotificationExample } from '@/components/notifications';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { resolveAvatarSource } from '@/utils/avatar';

export default function HomeScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [sessionDismissedCards, setSessionDismissedCards] = useState<Set<string>>(new Set());
  const [maintenanceDismissed, setMaintenanceDismissed] = useState(false);
  const [lowerTab, setLowerTab] = useState<'routine' | 'discover'>('routine');

  const { isPremium } = usePremium();
  const { flags } = useFeatureFlags();
  const { isAutoActive, totalSteps: autoSteps } = usePedometer();

  const { data: retentionOffer } = useQuery({
    queryKey: ['retentionOffer'],
    queryFn: () => userService.getRetentionOffer(),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });

  const [cachedSnapshot, setCachedSnapshot] = useState<any>(undefined);

  useEffect(() => {
    if (!user?.id) {
      setCachedSnapshot(undefined);
      return;
    }
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    AsyncStorage.getItem(`@home_snapshot_cache_${user.id}`)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed?.dateKey === todayKey && parsed?.snapshot) {
          setCachedSnapshot(parsed.snapshot);
        } else {
          setCachedSnapshot(undefined);
        }
      })
      .catch(() => {});
  }, [user?.id]);

  const {
    data: snapshot,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['homeSnapshot'],
    queryFn: async () => {
      const fresh = await homeService.getSnapshot('tr');
      if (user?.id && fresh) {
        const now = new Date();
        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        AsyncStorage.setItem(
          `@home_snapshot_cache_${user.id}`,
          JSON.stringify({ dateKey: todayKey, snapshot: fresh }),
        ).catch(() => {});
      }
      return fresh;
    },
    placeholderData: cachedSnapshot,
    enabled: isAuthenticated,
    staleTime: 60000,
    retry: 2,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        refetch();
        queryClient.invalidateQueries({ queryKey: ['dailyTasks'] });
        queryClient.invalidateQueries({ queryKey: ['gamification'] });
      }
    }, [isAuthenticated, refetch, queryClient]),
  );

  useEffect(() => {
    if (snapshot) {
      widgetSyncService.syncFromSnapshot(
        snapshot,
        isAutoActive ? autoSteps : 0,
        user?.profile?.dateOfBirth,
      );
    }
  }, [snapshot, isAutoActive, autoSteps, user?.profile?.dateOfBirth]);

  const dismissCardMutation = useMutation({
    mutationFn: (cardId: string) => homeService.dismissCard(cardId, 7),
    onSuccess: (_, cardId) => {
      setSessionDismissedCards((prev) => new Set(prev).add(cardId));
      queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });
    },
  });

  const toggleSaveMutation = useMutation({
    mutationFn: (articleId: string) => discoverService.toggleSave(articleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ['dailyTasks'] }),
      queryClient.invalidateQueries({ queryKey: ['gamification'] }),
    ]);
    setRefreshing(false);
  };

  const hour = new Date().getHours();
  const isNight = hour >= 20 || hour < 6;
  const getGreeting = () => {
    if (isNight) return 'İyi Geceler';
    if (hour >= 12 && hour < 17) return 'İyi Günler';
    if (hour >= 17) return 'İyi Akşamlar';
    return 'Günaydın';
  };

  const styles = createStyles(theme);
  const showLoading = isLoading && !snapshot;
  const showError = isError && !snapshot;

  if (showLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Günlük özetin hazırlanıyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (showError) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconCircle}>
            <Ionicons name="cloud-offline-outline" size={32} color={theme.colors.primary} />
          </View>
          <Text style={styles.errorText}>Veriler yüklenirken bir hata oluştu</Text>
          <Text style={styles.errorSubtext}>
            {error instanceof Error ? error.message : 'Lütfen tekrar deneyin'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()} activeOpacity={0.85}>
            <Text style={styles.retryButtonText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const ts = snapshot?.todaySnapshot;
  const displayName =
    snapshot?.user?.displayName || user?.profile?.displayName || 'Misafir';
  const remindersCount = ts?.remindersToday ?? 0;
  const visiblePriorityCards =
    snapshot?.priorityCards?.filter((card) => !sessionDismissedCards.has(card.id)).slice(0, 4) ||
    [];
  const todayLabel = new Date().toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  });

  const greetingGradient = isNight
    ? (['#1E1B4B', '#3B1D6A', '#6D28D9'] as const)
    : theme.isDark
    ? (['#4A1D4D', '#701A75', '#9D174D'] as const)
    : (['#FDF2F8', '#FCE7F3', '#F3E8FF'] as const);

  const isLightGreeting = !isNight && !theme.isDark;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Top Navigation Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('/settings')}
            activeOpacity={0.8}
          >
            <View style={styles.profileImageContainer}>
              {snapshot?.user?.profilePictureUrl ? (
                <Image
                  source={resolveAvatarSource(snapshot.user.profilePictureUrl)!}
                  style={styles.profileImage}
                />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Text style={styles.profilePlaceholderText}>
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              {isPremium && (
                <View style={styles.premiumBadgeOverlay}>
                  <PremiumBadge size="small" variant="icon" />
                </View>
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.brandCenter}>
            <Text style={styles.appTitle}>
              Kadın <Text style={styles.appTitleAccent}>Atlası</Text>
            </Text>
          </View>

          <View style={styles.topRightActions}>
            {snapshot?.streak != null && (
              <TouchableOpacity
                style={styles.streakMiniPill}
                onPress={() => router.push('/gamification')}
                activeOpacity={0.8}
              >
                <Ionicons name="flame" size={14} color="#F97316" />
                <Text style={styles.streakMiniText}>{snapshot.streak.current}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => router.push('/(tabs)/reminders')}
              activeOpacity={0.8}
              accessibilityLabel="Hatırlatıcılar"
            >
              <Ionicons name="notifications-outline" size={20} color={theme.colors.text} />
              {remindersCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {remindersCount > 9 ? '9+' : remindersCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Graceful Mascot Greeting Hero */}
        <View style={styles.greetingCardContainer}>
          <LinearGradient
            colors={greetingGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.greetingCard,
              isLightGreeting && styles.greetingCardLightBorder,
            ]}
          >
            <View style={styles.greetingOrbOne} />
            <View style={styles.greetingOrbTwo} />

            <View style={styles.greetingContent}>
              <View style={styles.greetingDatePill}>
                <Ionicons
                  name={isNight ? 'moon' : 'sunny'}
                  size={12}
                  color={isLightGreeting ? '#DB2777' : '#FDE68A'}
                />
                <Text
                  style={[
                    styles.greetingDateText,
                    { color: isLightGreeting ? '#9D174D' : 'rgba(255,255,255,0.88)' },
                  ]}
                  numberOfLines={1}
                >
                  {todayLabel}
                </Text>
              </View>

              <Text
                style={[
                  styles.greetingTitle,
                  { color: isLightGreeting ? '#1F2937' : '#FFFFFF' },
                ]}
              >
                {getGreeting()},{' '}
                <Text style={{ color: isLightGreeting ? '#DB2777' : '#F9A8D4' }}>
                  {displayName.split(' ')[0]}
                </Text>
              </Text>

              <Text
                style={[
                  styles.greetingQuestion,
                  { color: isLightGreeting ? '#6B7280' : 'rgba(255,255,255,0.8)' },
                ]}
              >
                {ts?.cyclePhase?.title
                  ? `${ts.cyclePhase.title} · Bugün nasıl hissediyorsun?`
                  : 'Bugün kendini nasıl hissediyorsun?'}
              </Text>

              <TouchableOpacity
                style={[
                  styles.greetingCtaBtn,
                  isLightGreeting
                    ? styles.greetingCtaBtnLight
                    : styles.greetingCtaBtnDark,
                ]}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/calendar',
                    params: { openToday: 'true' },
                  })
                }
                activeOpacity={0.85}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={14}
                  color={isLightGreeting ? '#FFFFFF' : '#FFFFFF'}
                />
                <Text style={styles.greetingCtaText}>Günlük Check-in</Text>
                <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.mascotFrame}>
              <View
                style={[
                  styles.mascotHalo,
                  {
                    backgroundColor: isLightGreeting
                      ? 'rgba(236, 72, 153, 0.10)'
                      : 'rgba(255, 255, 255, 0.14)',
                  },
                ]}
              />
              <Image
                source={
                  isNight
                    ? require('../../assets/images/mascots/GoodNight.png')
                    : require('../../assets/images/mascots/Morning.png')
                }
                style={styles.mascotImage}
                resizeMode="contain"
              />
            </View>
          </LinearGradient>
        </View>

        {/* Admin Controlled Maintenance Banner */}
        {flags.maintenance_mode && !maintenanceDismissed && (
          <View style={styles.maintenanceWrapper}>
            <View style={styles.maintenanceCard}>
              <View style={styles.maintenanceIconBox}>
                <Ionicons name="construct-outline" size={18} color="#D97706" />
              </View>
              <View style={styles.maintenanceBody}>
                <Text style={styles.maintenanceTitle}>Planlı Bakım Çalışması</Text>
                <Text style={styles.maintenanceDesc}>
                  Size daha akıcı bir deneyim sunmak için kısa süreli iyileştirme yapılıyor.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setMaintenanceDismissed(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Personalized Retention / Win-Back Return Banner */}
        {retentionOffer?.banner && <WinbackOfferBanner banner={retentionOffer.banner} />}

        {/* Interactive Cycle Wheel + 1-Tap Check-In */}
        <CycleWheelHero
          cycleDay={ts?.cycleDay}
          cyclePhase={ts?.cyclePhase}
          nextPeriodEstimate={ts?.nextPeriodEstimate}
          isAuthenticated={isAuthenticated}
          isPregnant={Boolean(ts?.pregnancy)}
        />

        {/* Conditional Pregnancy / Postpartum / Fertility Compact Pill */}
        {(snapshot?.user?.lifeStage === 'POSTPARTUM' ||
          ts?.pregnancy ||
          ts?.fertilityWindow ||
          ts?.ovulationEstimate) && (
          <View style={styles.contextStrip}>
            {snapshot?.user?.lifeStage === 'POSTPARTUM' ? (
              <TouchableOpacity
                style={styles.contextPill}
                onPress={() => router.push('/postpartum' as any)}
                activeOpacity={0.82}
              >
                <Ionicons name="heart-circle" size={16} color="#EC4899" />
                <Text style={styles.contextPillText}>
                  Anne & Bebek Merkezi · Emzirme, Bez, Uyku & Aşılar
                </Text>
                <Ionicons name="chevron-forward" size={14} color={theme.colors.textLight} />
              </TouchableOpacity>
            ) : ts?.pregnancy ? (
              <TouchableOpacity
                style={styles.contextPill}
                onPress={() => router.push('/pregnancy')}
                activeOpacity={0.82}
              >
                <Ionicons name="heart" size={14} color="#F43F5E" />
                <Text style={styles.contextPillText}>
                  Gebelik Takibi · {ts.pregnancy.weeks}h {ts.pregnancy.days}g
                </Text>
                <Ionicons name="chevron-forward" size={14} color={theme.colors.textLight} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.contextPill}
                onPress={() => router.push('/(tabs)/calendar')}
                activeOpacity={0.82}
              >
                <Ionicons name="leaf" size={14} color="#10B981" />
                <Text style={styles.contextPillText}>
                  {ts?.fertilityWindow
                    ? `Verimli Pencere: ${ts.fertilityWindow.start}–${ts.fertilityWindow.end}. Gün`
                    : 'Doğurganlık Takibi'}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={theme.colors.textLight} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Contextual Fun Notification */}
        {snapshot?.streak && (
          <FunNotificationExample
            streakDay={snapshot.streak.current}
            dataEntryCount={
              ts?.dataEntriesCount || (ts?.waterProgress?.current ? 1 : 0)
            }
            cycleDay={ts?.cycleDay}
            isPeriodWeek={
              ts?.cycleDay ? ts.cycleDay >= 1 && ts.cycleDay <= 7 : false
            }
            autoShow={true}
          />
        )}

        {/* Wellness Tiles (2x2 Grid) */}
        {snapshot?.wellnessTiles && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Bugünkü Aktiviteler</Text>
              <View style={styles.headerMiniLinks}>
                <TouchableOpacity
                  style={styles.miniLinkChip}
                  onPress={() => router.push('/metrics')}
                  activeOpacity={0.75}
                >
                  <Ionicons name="analytics-outline" size={13} color={theme.colors.primary} />
                  <Text style={styles.miniLinkText}>Metrikler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.miniLinkChip}
                  onPress={() => router.push('/(tabs)/calendar')}
                  activeOpacity={0.75}
                >
                  <Ionicons name="calendar-outline" size={13} color={theme.colors.primary} />
                  <Text style={styles.miniLinkText}>Takvim</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.tilesGrid}>
              <View style={styles.tilesRow}>
                <View style={styles.tileWrapper}>
                  <WaterTile data={snapshot.todaySnapshot.waterProgress} />
                </View>
                <View style={styles.tileWrapper}>
                  <StepsTile data={snapshot.wellnessTiles.steps} />
                </View>
              </View>
              <View style={styles.tilesRow}>
                <View style={styles.tileWrapper}>
                  <MeditationTile data={snapshot.wellnessTiles.meditation} />
                </View>
                <View style={styles.tileWrapper}>
                  <SleepTile data={snapshot.wellnessTiles.sleep} />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Compact Segmented Switcher for Lower Home Content */}
        <View style={styles.lowerSegmentWrap}>
          <View style={styles.lowerSegmentTrack}>
            <TouchableOpacity
              style={[
                styles.lowerSegmentBtn,
                lowerTab === 'routine' && styles.lowerSegmentBtnActive,
              ]}
              onPress={() => setLowerTab('routine')}
              activeOpacity={0.85}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={15}
                color={lowerTab === 'routine' ? '#FFFFFF' : theme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.lowerSegmentText,
                  lowerTab === 'routine' && styles.lowerSegmentTextActive,
                ]}
              >
                Günlük Rutin
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.lowerSegmentBtn,
                lowerTab === 'discover' && styles.lowerSegmentBtnActive,
              ]}
              onPress={() => setLowerTab('discover')}
              activeOpacity={0.85}
            >
              <Ionicons
                name="sparkles-outline"
                size={15}
                color={lowerTab === 'discover' ? '#FFFFFF' : theme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.lowerSegmentText,
                  lowerTab === 'discover' && styles.lowerSegmentTextActive,
                ]}
              >
                Keşfet &amp; Astroloji
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {lowerTab === 'routine' ? (
          <>
            {/* Swipeable Daily Micro-Cards */}
            <DailyMicroCardsDeck
              phase={
                snapshot?.user?.lifeStage === 'POSTPARTUM'
                  ? 'POSTPARTUM'
                  : ts?.pregnancy
                  ? 'PREGNANCY'
                  : ts?.cyclePhase?.phase
              }
              isAuthenticated={isAuthenticated}
            />

            {/* Daily Habit Loop */}
            <DailyHabitSection
              cyclePhase={ts?.cyclePhase}
              isAuthenticated={isAuthenticated}
            />

            {/* Priority Recommendations */}
            {visiblePriorityCards.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Senin İçin Öneriler</Text>
                </View>
                {visiblePriorityCards.map((card) => (
                  <PriorityCard
                    key={card.id}
                    card={card}
                    onDismiss={() => dismissCardMutation.mutate(card.id)}
                  />
                ))}
              </View>
            )}

            {/* Subtle Premium Discovery Card (Free Users Only) */}
            {isAuthenticated && !isPremium && (
              <TouchableOpacity
                style={styles.proCardWrap}
                activeOpacity={0.88}
                onPress={() => router.push('/premium' as any)}
              >
                <View style={styles.proCard}>
                  <View style={styles.proIconBox}>
                    <Ionicons name="diamond-outline" size={19} color="#DB2777" />
                  </View>
                  <View style={styles.proTextCol}>
                    <Text style={styles.proTitle}>Kadın Atlası Pro’yu Keşfet</Text>
                    <Text style={styles.proSubtitle}>
                      3 Aylık Tahmin · Klinik Rapor · Partner Modu
                    </Text>
                  </View>
                  <View style={styles.proBadgePill}>
                    <Text style={styles.proBadgeText}>7 Gün Ücretsiz</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <View style={styles.discoverSection}>
            <View style={styles.discoverCardsGrid}>
              <TouchableOpacity
                style={styles.discoverPortalCard}
                onPress={() => router.push('/discover')}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={
                    theme.isDark
                      ? ['#9D174D', '#DB2777']
                      : ['#FB7185', '#EC4899']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.discoverPortalGradient}
                >
                  <View style={styles.discoverOrbTopRight} />
                  <View style={styles.discoverCardTopRow}>
                    <View style={styles.discoverIconBadge}>
                      <Ionicons name="book-outline" size={17} color="#FFFFFF" />
                    </View>
                    <View style={styles.discoverTagPill}>
                      <Text style={styles.discoverTagText}>REHBER</Text>
                    </View>
                  </View>
                  <View style={styles.discoverCardBody}>
                    <Text style={styles.discoverPortalTitle}>Sağlık Rehberi</Text>
                    <Text style={styles.discoverPortalSubtitle} numberOfLines={2}>
                      Uzman makaleleri &amp; döngü ipuçları
                    </Text>
                  </View>
                  <View style={styles.discoverCardFooter}>
                    <Text style={styles.discoverActionText}>Makaleleri Aç</Text>
                    <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {flags.astrology_enabled !== false && (
                <TouchableOpacity
                  style={styles.discoverPortalCard}
                  onPress={() => router.push('/astrology')}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={
                      theme.isDark
                        ? ['#4338CA', '#7C3AED']
                        : ['#6366F1', '#8B5CF6']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.discoverPortalGradient}
                  >
                    <View style={styles.discoverOrbTopRight} />
                    <View style={styles.discoverCardTopRow}>
                      <View style={styles.discoverIconBadge}>
                        <Ionicons name="sparkles-outline" size={17} color="#FFFFFF" />
                      </View>
                      <View style={styles.discoverTagPill}>
                        <Text style={styles.discoverTagText}>KOZMİK</Text>
                      </View>
                    </View>
                    <View style={styles.discoverCardBody}>
                      <Text style={styles.discoverPortalTitle}>Astroloji</Text>
                      <Text style={styles.discoverPortalSubtitle} numberOfLines={2}>
                        Günlük burç yorumu &amp; harita
                      </Text>
                    </View>
                    <View style={styles.discoverCardFooter}>
                      <Text style={styles.discoverActionText}>Yorumu Gör</Text>
                      <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shortcutScroll}
            >
              {flags.astrology_enabled !== false && (
                <>
                  <TouchableOpacity
                    style={styles.shortcutChip}
                    onPress={() => router.push('/astrology/birth-chart')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="planet-outline" size={14} color="#7C3AED" />
                    <Text style={styles.shortcutText}>Doğum Haritası</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.shortcutChip}
                    onPress={() => router.push('/astrology/compatibility')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="heart-half-outline" size={14} color="#EC4899" />
                    <Text style={styles.shortcutText}>Burç Uyumu</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={styles.shortcutChip}
                onPress={() => router.push('/discover')}
                activeOpacity={0.8}
              >
                <Ionicons name="library-outline" size={14} color="#F97316" />
                <Text style={styles.shortcutText}>Tüm Rehberler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shortcutChip}
                onPress={() => router.push('/(tabs)/community')}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubbles-outline" size={14} color="#10B981" />
                <Text style={styles.shortcutText}>Topluluk</Text>
              </TouchableOpacity>
            </ScrollView>

            {snapshot?.educationalArticles && snapshot.educationalArticles.length > 0 && (
              <View style={styles.articlesBlock}>
                <View style={styles.articlesSubHeader}>
                  <Text style={styles.articlesSubTitle}>Öne Çıkan Okumalar</Text>
                  <TouchableOpacity
                    onPress={() => router.push('/discover')}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.seeAllText}>Tümünü Gör</Text>
                  </TouchableOpacity>
                </View>
                {snapshot.educationalArticles.slice(0, 2).map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    variant="horizontal"
                    onPress={() => router.push(`/discover/article/${article.id}`)}
                    onSave={() => toggleSaveMutation.mutate(article.id)}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.bottomSpacer} />
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
    container: {
      flex: 1,
    },
    contentContainer: {
      paddingBottom: 92,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    errorIconCircle: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: theme.isDark ? 'rgba(236,72,153,0.14)' : '#FDF2F8',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    errorText: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 6,
    },
    errorSubtext: {
      fontSize: 13.5,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 20,
    },
    retryButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 14,
    },
    retryButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
    },
    profileButton: {
      padding: 2,
    },
    profileImageContainer: {
      position: 'relative',
    },
    profileImage: {
      width: 40,
      height: 40,
      borderRadius: 14,
    },
    profilePlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: theme.isDark ? 'rgba(236,72,153,0.2)' : '#FCE7F3',
      alignItems: 'center',
      justifyContent: 'center',
    },
    profilePlaceholderText: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.colors.primary,
    },
    premiumBadgeOverlay: {
      position: 'absolute',
      bottom: -3,
      right: -3,
    },
    brandCenter: {
      flex: 1,
      alignItems: 'center',
    },
    appTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.text,
      letterSpacing: -0.3,
    },
    appTitleAccent: {
      color: theme.colors.primary,
    },
    topRightActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    streakMiniPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    streakMiniText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: theme.colors.text,
    },
    notificationButton: {
      width: 38,
      height: 38,
      borderRadius: 13,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    bellBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 17,
      height: 17,
      borderRadius: 9,
      backgroundColor: '#EC4899',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    bellBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '800',
    },
    greetingCardContainer: {
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    greetingCard: {
      borderRadius: 26,
      padding: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      overflow: 'hidden',
      position: 'relative',
      minHeight: 152,
    },
    greetingCardLightBorder: {
      borderWidth: 1,
      borderColor: '#FBCFE8',
    },
    greetingOrbOne: {
      position: 'absolute',
      top: -32,
      right: -24,
      width: 130,
      height: 130,
      borderRadius: 65,
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
    },
    greetingOrbTwo: {
      position: 'absolute',
      bottom: -40,
      left: 20,
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: 'rgba(236, 72, 153, 0.08)',
    },
    greetingContent: {
      flex: 1,
      paddingRight: 10,
      zIndex: 1,
    },
    greetingDatePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      marginBottom: 8,
    },
    greetingDateText: {
      fontSize: 11.5,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
    greetingTitle: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.4,
      marginBottom: 4,
    },
    greetingQuestion: {
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 14,
      fontWeight: '500',
    },
    greetingCtaBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: 999,
    },
    greetingCtaBtnLight: {
      backgroundColor: '#EC4899',
    },
    greetingCtaBtnDark: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.25)',
    },
    greetingCtaText: {
      color: '#FFFFFF',
      fontSize: 12.5,
      fontWeight: '700',
    },
    mascotFrame: {
      width: 106,
      height: 114,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    mascotHalo: {
      position: 'absolute',
      width: 94,
      height: 94,
      borderRadius: 47,
    },
    mascotImage: {
      width: 104,
      height: 112,
    },
    maintenanceWrapper: {
      paddingHorizontal: 20,
      marginBottom: 14,
    },
    maintenanceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: 16,
      backgroundColor: theme.isDark ? 'rgba(180, 83, 9, 0.18)' : '#FFFBEB',
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A',
    },
    maintenanceIconBox: {
      width: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor: theme.isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    maintenanceBody: {
      flex: 1,
    },
    maintenanceTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.text,
    },
    maintenanceDesc: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 1,
    },
    contextStrip: {
      paddingHorizontal: 20,
      marginBottom: 14,
    },
    contextPill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    contextPillText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.text,
    },
    headerMiniLinks: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    miniLinkChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: theme.isDark ? 'rgba(236,72,153,0.12)' : '#FDF2F8',
    },
    miniLinkText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    proCardWrap: {
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    proCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 13,
      borderRadius: 18,
      backgroundColor: theme.isDark ? 'rgba(236,72,153,0.1)' : '#FFF5F9',
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(236,72,153,0.28)' : '#FBCFE8',
    },
    proIconBox: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.isDark ? 'rgba(236,72,153,0.2)' : '#FCE7F3',
      alignItems: 'center',
      justifyContent: 'center',
    },
    proTextCol: {
      flex: 1,
    },
    proTitle: {
      fontSize: 13.5,
      fontWeight: '800',
      color: theme.colors.text,
    },
    proSubtitle: {
      fontSize: 11.5,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    proBadgePill: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: '#DB2777',
    },
    proBadgeText: {
      color: '#FFFFFF',
      fontSize: 10.5,
      fontWeight: '800',
    },
    section: {
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 17.5,
      fontWeight: '800',
      color: theme.colors.text,
      letterSpacing: -0.2,
    },
    sectionSubtitle: {
      fontSize: 12.5,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    seeAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    seeAllText: {
      fontSize: 13.5,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    tilesGrid: {
      gap: 12,
    },
    tilesRow: {
      flexDirection: 'row',
      gap: 12,
    },
    tileWrapper: {
      flex: 1,
    },
    discoverSection: {
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    discoverCardsGrid: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    discoverPortalCard: {
      flex: 1,
      borderRadius: 22,
      overflow: 'hidden',
    },
    discoverPortalGradient: {
      padding: 13,
      minHeight: 118,
      justifyContent: 'space-between',
      position: 'relative',
    },
    discoverOrbTopRight: {
      position: 'absolute',
      top: -20,
      right: -20,
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: 'rgba(255, 255, 255, 0.16)',
    },
    discoverCardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    discoverIconBadge: {
      width: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor: 'rgba(255, 255, 255, 0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    discoverTagPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    discoverTagText: {
      color: '#FFFFFF',
      fontSize: 9.5,
      fontWeight: '800',
      letterSpacing: 0.6,
    },
    discoverCardBody: {
      marginBottom: 10,
    },
    discoverPortalTitle: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 3,
    },
    discoverPortalSubtitle: {
      color: 'rgba(255, 255, 255, 0.88)',
      fontSize: 12,
      lineHeight: 16,
    },
    discoverCardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    discoverActionText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    shortcutScroll: {
      gap: 8,
      paddingBottom: 14,
    },
    shortcutChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    shortcutText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: theme.colors.text,
    },
    articlesBlock: {
      gap: 10,
      marginTop: 4,
    },
    articlesSubHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    articlesSubTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.text,
    },
    lowerSegmentWrap: {
      paddingHorizontal: 20,
      marginBottom: 14,
    },
    lowerSegmentTrack: {
      flexDirection: 'row',
      padding: 4,
      borderRadius: 16,
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6',
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 4,
    },
    lowerSegmentBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 12,
    },
    lowerSegmentBtnActive: {
      backgroundColor: theme.colors.primary,
    },
    lowerSegmentText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    lowerSegmentTextActive: {
      color: '#FFFFFF',
    },
    bottomSpacer: {
      height: 12,
    },
  });
