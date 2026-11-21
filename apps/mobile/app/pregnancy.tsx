import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { pregnancyService } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { usePregnancyStore } from '@/store/pregnancyStore';
import { useTheme } from '@/hooks/useTheme';

const TOOLS: Array<{
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  route: string;
}> = [
  {
    id: 'kicks',
    title: 'Tekme Sayacı',
    subtitle: 'Bebek hareketleri',
    icon: 'footsteps-outline',
    color: '#EC4899',
    bg: 'rgba(236,72,153,0.12)',
    route: '/pregnancy/kick-counter',
  },
  {
    id: 'contractions',
    title: 'Kasılma Sayacı',
    subtitle: 'Süre & sıklık takibi',
    icon: 'timer-outline',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
    route: '/pregnancy/contractions',
  },
  {
    id: 'appointments',
    title: 'Randevular',
    subtitle: 'Doktor & ölçümler',
    icon: 'calendar-outline',
    color: '#6366F1',
    bg: 'rgba(99,102,241,0.12)',
    route: '/pregnancy/appointments',
  },
  {
    id: 'medications',
    title: 'İlaçlar',
    subtitle: 'Vitamin & takviye',
    icon: 'medkit-outline',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.12)',
    route: '/pregnancy/medications',
  },
  {
    id: 'birthplan',
    title: 'Doğum Planı',
    subtitle: 'Tercihlerini kaydet',
    icon: 'document-text-outline',
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.12)',
    route: '/pregnancy/birth-plan',
  },
  {
    id: 'hospitalbag',
    title: 'Hastane Çantası',
    subtitle: 'Anne & bebek listesi',
    icon: 'bag-handle-outline',
    color: '#0EA5E9',
    bg: 'rgba(14,165,233,0.12)',
    route: '/pregnancy/hospital-bag',
  },
  {
    id: 'notes',
    title: 'Gebelik Notları',
    subtitle: 'Anılar & sorular',
    icon: 'create-outline',
    color: '#F43F5E',
    bg: 'rgba(244,63,94,0.12)',
    route: '/pregnancy/notes',
  },
];

export default function PregnancyScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { clearPregnancy } = usePregnancyStore();
  const [refreshing, setRefreshing] = useState(false);

  const { data: pregnancy, isLoading, refetch } = useQuery({
    queryKey: ['pregnancy'],
    queryFn: () => pregnancyService.get(),
    enabled: isAuthenticated,
  });

  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ['pregnancy', 'summary'],
    queryFn: () => pregnancyService.getSummary(),
    enabled: isAuthenticated && !!pregnancy,
  });

  const { data: weeklyContent, refetch: refetchWeekly } = useQuery({
    queryKey: ['pregnancy', 'weekly'],
    queryFn: () => pregnancyService.getWeeklyContent(),
    enabled: isAuthenticated && !!pregnancy,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchSummary(), refetchWeekly()]);
    setRefreshing(false);
  };

  const handleEditPregnancy = () => {
    router.push('/pregnancy/setup');
  };

  const handleDeletePregnancy = () => {
    Alert.alert(
      'Hamilelik Kaydını Sil',
      'Hamilelik kaydınızı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await pregnancyService.delete();
              clearPregnancy();
              queryClient.invalidateQueries({ queryKey: ['pregnancy'] });
              queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });
              router.back();
              Alert.alert('Başarılı', 'Hamilelik kaydı silindi.');
            } catch (error: any) {
              Alert.alert('Hata', error.message || 'Silinemedi.');
            }
          },
        },
      ],
    );
  };

  const styles = createStyles(theme);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Gebelik verilerin yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!pregnancy) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Hamilelik Takibi</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={styles.emptyWrap} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={theme.isDark ? ['#3B1D4A', '#26183D'] : ['#FDF2F8', '#F3E8FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.emptyCard}
          >
            <View style={styles.emptyIconCircle}>
              <Ionicons name="heart" size={30} color="#EC4899" />
            </View>
            <Text style={styles.emptyTitle}>Hamilelik Yolculuğuna Başla</Text>
            <Text style={styles.emptyText}>
              Haftalık bebek gelişimi, tekme & kasılma sayacı, doktor randevuları ve hastane çantan tek yerde.
            </Text>

            <View style={styles.emptyFeatures}>
              <View style={styles.emptyFeatureRow}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={styles.emptyFeatureText}>40 haftalık gelişim & trimester takibi</Text>
              </View>
              <View style={styles.emptyFeatureRow}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={styles.emptyFeatureText}>Tekme sayacı ve doğum sancısı zamanlayıcı</Text>
              </View>
              <View style={styles.emptyFeatureRow}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={styles.emptyFeatureText}>Hazır hastane çantası & doğum planı</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.setupButtonWrap}
              onPress={() => router.push('/pregnancy/setup')}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#EC4899', '#9333EA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.setupButton}
              >
                <Text style={styles.setupButtonText}>Kurulumu Başlat</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const weeks = summary?.gestationalAge?.weeks ?? 0;
  const days = summary?.gestationalAge?.days ?? 0;
  const progressPct = Math.min(100, Math.max(2, Math.round(((weeks * 7 + days) / 280) * 100)));
  const remainingDays = summary?.dueDate
    ? Math.max(0, Math.ceil((new Date(summary.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hamilelik Takibi</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleEditPregnancy}>
            <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleDeletePregnancy}>
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Signature Pregnancy Hero */}
        {summary && (
          <LinearGradient
            colors={theme.isDark ? ['#4A1D4D', '#3B1D6A'] : ['#FDF2F8', '#F3E8FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.heroOverline}>GEBELİK HAFTASI</Text>
                <Text style={styles.heroWeekText}>
                  {weeks}. Hafta {days}. Gün
                </Text>
              </View>
              <View style={styles.trimesterPill}>
                <Text style={styles.trimesterPillText}>{summary.trimester}. Trimester</Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <LinearGradient
                colors={['#EC4899', '#9333EA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${progressPct}%` }]}
              />
            </View>

            <View style={styles.heroMetaRow}>
              <Text style={styles.heroMetaText}>İlerleme: %{progressPct}</Text>
              {remainingDays !== null && (
                <Text style={styles.heroMetaText}>Doğuma ~{remainingDays} gün</Text>
              )}
            </View>

            {summary.dueDate && (
              <View style={styles.dueDateRow}>
                <Ionicons name="calendar-outline" size={15} color={theme.colors.primary} />
                <Text style={styles.dueDateLabel}>Tahmini Doğum:</Text>
                <Text style={styles.dueDateValue}>
                  {new Date(summary.dueDate).toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            )}

            {summary.weeklyTip && (
              <View style={styles.tipBox}>
                <View style={styles.tipHeader}>
                  <Ionicons name="sparkles" size={14} color="#EC4899" />
                  <Text style={styles.tipLabel}>BUGÜNÜN İPUCU</Text>
                </View>
                <Text style={styles.tipText}>{summary.weeklyTip}</Text>
              </View>
            )}
          </LinearGradient>
        )}

        {/* Weekly Content */}
        {weeklyContent && (
          <View style={styles.weeklyCard}>
            <View style={styles.weeklyHeader}>
              <View style={styles.weeklyBadge}>
                <Ionicons name="leaf-outline" size={16} color="#EC4899" />
              </View>
              <Text style={styles.weeklyTitle}>{weeklyContent.week}. Hafta Gelişimi</Text>
            </View>
            <Text style={styles.weeklyBody}>{weeklyContent.content}</Text>
            {weeklyContent.developmentSummary && (
              <View style={styles.devBox}>
                <Text style={styles.devText}>{weeklyContent.developmentSummary}</Text>
              </View>
            )}
          </View>
        )}

        {/* Tools Grid */}
        <Text style={styles.sectionTitle}>Takip Araçları</Text>
        <View style={styles.toolsGrid}>
          {TOOLS.map((tool) => (
            <TouchableOpacity
              key={tool.id}
              style={styles.toolCard}
              onPress={() => router.push(tool.route as any)}
              activeOpacity={0.85}
            >
              <View style={[styles.toolIconCircle, { backgroundColor: tool.bg }]}>
                <Ionicons name={tool.icon} size={22} color={tool.color} />
              </View>
              <Text style={styles.toolTitle}>{tool.title}</Text>
              <Text style={styles.toolSubtitle}>{tool.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* NOVA Pregnancy Assistant CTA */}
        <TouchableOpacity
          style={styles.novaCard}
          onPress={() =>
            router.push({
              pathname: '/(tabs)/chat',
              params: {
                prompt: `Hamileliğimin ${weeks}. haftasındayım. Bu hafta dikkat etmem gereken beslenme ve sağlık önerilerini paylaşır mısın?`,
              },
            } as any)
          }
          activeOpacity={0.86}
        >
          <View style={styles.novaIconBox}>
            <Ionicons name="sparkles" size={20} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.novaTitle}>NOVA’ya {weeks}. Haftayı Sor</Text>
            <Text style={styles.novaSub}>Kişisel gebelik ve beslenme önerileri al</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
        </TouchableOpacity>
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
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
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
    headerTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.text,
      flex: 1,
      textAlign: 'center',
    },
    headerActions: {
      flexDirection: 'row',
      gap: 8,
    },
    scrollContainer: {
      padding: 20,
      paddingBottom: 40,
      gap: 16,
    },
    emptyWrap: {
      padding: 20,
      flexGrow: 1,
      justifyContent: 'center',
    },
    emptyCard: {
      borderRadius: 26,
      padding: 24,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(236,72,153,0.3)' : '#FBCFE8',
      alignItems: 'center',
    },
    emptyIconCircle: {
      width: 64,
      height: 64,
      borderRadius: 22,
      backgroundColor: 'rgba(236,72,153,0.14)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 21,
      fontWeight: '800',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 13.5,
      lineHeight: 20,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 18,
    },
    emptyFeatures: {
      width: '100%',
      gap: 10,
      marginBottom: 22,
    },
    emptyFeatureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    emptyFeatureText: {
      fontSize: 13.5,
      fontWeight: '600',
      color: theme.colors.text,
      flex: 1,
    },
    setupButtonWrap: {
      width: '100%',
      borderRadius: 16,
      overflow: 'hidden',
    },
    setupButton: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    setupButtonText: {
      color: '#FFFFFF',
      fontSize: 15.5,
      fontWeight: '800',
    },
    heroCard: {
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(236,72,153,0.3)' : '#FBCFE8',
    },
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 14,
    },
    heroOverline: {
      fontSize: 10.5,
      fontWeight: '800',
      color: theme.colors.primary,
      letterSpacing: 0.7,
      marginBottom: 4,
    },
    heroWeekText: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.colors.text,
      letterSpacing: -0.4,
    },
    trimesterPill: {
      paddingHorizontal: 11,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    trimesterPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    progressTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(236,72,153,0.14)',
      overflow: 'hidden',
      marginBottom: 8,
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
    },
    heroMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    heroMetaText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    dueDateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.isDark ? 'rgba(15,23,42,0.35)' : 'rgba(255,255,255,0.85)',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
    },
    dueDateLabel: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    dueDateValue: {
      fontSize: 13.5,
      color: theme.colors.text,
      fontWeight: '800',
    },
    tipBox: {
      marginTop: 12,
      backgroundColor: theme.isDark ? 'rgba(15,23,42,0.35)' : 'rgba(255,255,255,0.85)',
      padding: 12,
      borderRadius: 14,
    },
    tipHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 4,
    },
    tipLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: '#EC4899',
      letterSpacing: 0.5,
    },
    tipText: {
      fontSize: 13,
      lineHeight: 19,
      color: theme.colors.text,
    },
    weeklyCard: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    weeklyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    weeklyBadge: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: 'rgba(236,72,153,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    weeklyTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.text,
    },
    weeklyBody: {
      fontSize: 13.5,
      lineHeight: 20,
      color: theme.colors.textSecondary,
    },
    devBox: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    devText: {
      fontSize: 12.5,
      lineHeight: 18,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.colors.text,
      marginTop: 4,
    },
    toolsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    toolCard: {
      width: '48%',
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    toolIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    toolTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: 2,
    },
    toolSubtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    novaCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 18,
      padding: 15,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(236,72,153,0.3)' : '#FBCFE8',
    },
    novaIconBox: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: '#EC4899',
      alignItems: 'center',
      justifyContent: 'center',
    },
    novaTitle: {
      fontSize: 14.5,
      fontWeight: '800',
      color: theme.colors.text,
    },
    novaSub: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
  });
