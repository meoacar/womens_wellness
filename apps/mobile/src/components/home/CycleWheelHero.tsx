import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { cyclesService } from '@/services/api';

interface CycleWheelHeroProps {
  cycleDay?: number;
  cyclePhase?: {
    phase: 'MENSTRUAL' | 'FOLLICULAR' | 'OVULATION' | 'LUTEAL';
    title: string;
    summary: string;
    color: string;
  };
  nextPeriodEstimate?: {
    date: Date | string;
    confidence: string;
  };
  isAuthenticated: boolean;
  isPregnant?: boolean;
}

const QUICK_SYMPTOMS = [
  { id: 'Kramp', label: 'Kramp', emoji: '😣', kind: 'symptom' as const },
  { id: 'Şişkinlik', label: 'Şişkinlik', emoji: '🫧', kind: 'symptom' as const },
  { id: 'Baş ağrısı', label: 'Baş ağrısı', emoji: '🤕', kind: 'symptom' as const },
  { id: 'Yorgunluk', label: 'Yorgun', emoji: '😴', kind: 'symptom' as const },
  { id: 'Mutlu', label: 'Mutlu', emoji: '😊', kind: 'mood' as const },
  { id: 'Enerjik', label: 'Enerjik', emoji: '⚡', kind: 'mood' as const },
  { id: 'Huzursuz', label: 'Hassas', emoji: '🥺', kind: 'mood' as const },
];

export function CycleWheelHero({
  cycleDay,
  cyclePhase,
  nextPeriodEstimate,
  isAuthenticated,
  isPregnant,
}: CycleWheelHeroProps) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const todayStr = new Date().toISOString().slice(0, 10);

  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [savedNotice, setSavedNotice] = useState(false);

  const { data: todayLog } = useQuery<any>({
    queryKey: ['dailyLog', todayStr],
    queryFn: () => cyclesService.getDailyLog(todayStr),
    enabled: isAuthenticated && !isPregnant,
  });

  useEffect(() => {
    if (todayLog) {
      if (Array.isArray(todayLog.symptoms)) setSelectedSymptoms(todayLog.symptoms);
      if (Array.isArray(todayLog.mood)) setSelectedMoods(todayLog.mood);
    }
  }, [todayLog]);

  const upsertMutation = useMutation({
    mutationFn: (payload: { symptoms: string[]; mood: string[] }) =>
      cyclesService.upsertDailyLog({
        date: todayStr,
        symptoms: payload.symptoms,
        mood: payload.mood,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyLog', todayStr] });
      queryClient.invalidateQueries({ queryKey: ['patternInsights'] });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 1800);
    },
  });

  if (!isAuthenticated || isPregnant) {
    return null;
  }

  const toggleChip = (chip: (typeof QUICK_SYMPTOMS)[number]) => {
    Haptics.selectionAsync().catch(() => {});
    let nextSymptoms = [...selectedSymptoms];
    let nextMoods = [...selectedMoods];

    if (chip.kind === 'symptom') {
      nextSymptoms = nextSymptoms.includes(chip.id)
        ? nextSymptoms.filter((x) => x !== chip.id)
        : [...nextSymptoms, chip.id];
      setSelectedSymptoms(nextSymptoms);
    } else {
      nextMoods = nextMoods.includes(chip.id)
        ? nextMoods.filter((x) => x !== chip.id)
        : [...nextMoods, chip.id];
      setSelectedMoods(nextMoods);
    }

    upsertMutation.mutate({ symptoms: nextSymptoms, mood: nextMoods });
  };

  const daysUntilPeriod = nextPeriodEstimate?.date
    ? (() => {
        const target = new Date(nextPeriodEstimate.date);
        target.setHours(0, 0, 0, 0);
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);
        return Math.max(
          0,
          Math.round((target.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)),
        );
      })()
    : null;

  const phaseColor = cyclePhase?.color || theme.colors.primary;
  const gradientColors =
    cyclePhase?.phase === 'MENSTRUAL'
      ? (['#BE185D', '#EC4899'] as const)
      : cyclePhase?.phase === 'OVULATION'
      ? (['#059669', '#10B981'] as const)
      : cyclePhase?.phase === 'FOLLICULAR'
      ? (['#6D28D9', '#8B5CF6'] as const)
      : (['#D97706', '#F59E0B'] as const);

  const progressRatio = cycleDay ? Math.min(1, Math.max(0.08, cycleDay / 28)) : 0.12;
  const styles = createStyles(theme, phaseColor);

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={cycleDay ? gradientColors : (['#EC4899', '#8B5CF6'] as const)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.topRow}>
          <View style={styles.ringOuter}>
            <View
              style={[
                styles.ringProgress,
                {
                  borderColor: 'rgba(255,255,255,0.9)',
                  transform: [{ rotate: `${Math.round(progressRatio * 360)}deg` }],
                },
              ]}
            />
            <View style={styles.ringInner}>
              {cycleDay ? (
                <>
                  <Text style={styles.ringDayNum}>{cycleDay}</Text>
                  <Text style={styles.ringDayLabel}>GÜN</Text>
                </>
              ) : (
                <Ionicons name="calendar-outline" size={28} color="#FFFFFF" />
              )}
            </View>
          </View>

          <View style={styles.infoCol}>
            <View style={styles.phasePill}>
              <Text style={styles.phasePillText}>
                {cyclePhase ? cyclePhase.title.split('(')[0].trim() : 'Döngü Takibi'}
              </Text>
            </View>

            <Text style={styles.headline}>
              {!cycleDay
                ? 'İlk döngünü kaydet'
                : cycleDay <= 5
                ? 'Regl dönemindesin — kendine nazik ol'
                : daysUntilPeriod === 0
                ? 'Regl bugün bekleniyor'
                : daysUntilPeriod !== null
                ? `Sonraki regline ${daysUntilPeriod} gün kaldı`
                : `Döngünün ${cycleDay}. günü`}
            </Text>

            <Text style={styles.subline} numberOfLines={2}>
              {cyclePhase?.summary ||
                'Takvimden başlangıç tarihi eklediğinde faz rehberin ve tahminlerin burada görünür.'}
            </Text>
          </View>
        </View>

        <View style={styles.actionsFooter}>
          <TouchableOpacity
            style={styles.footerBtn}
            onPress={() => router.push('/(tabs)/calendar?openToday=true' as any)}
          >
            <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" />
            <Text style={styles.footerBtnText}>
              {cycleDay ? 'Detaylı Kayıt' : 'Tarih Ekle'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerBtn}
            onPress={() =>
              router.push(
                `/(tabs)/chat?prompt=${encodeURIComponent(
                  cycleDay
                    ? `Döngümün ${cycleDay}. günündeyim (${cyclePhase?.title || ''}). Bugün bana özel önerilerin neler?`
                    : 'Döngümü düzenli takip etmeye başlamak istiyorum, nereden başlamalıyım?',
                )}` as any,
              )
            }
          >
            <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" />
            <Text style={styles.footerBtnText}>Nova'ya Sor</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* 1-Tap Symptom & Mood Check-In */}
      <View style={styles.checkInCard}>
        <View style={styles.checkInHeader}>
          <Text style={styles.checkInTitle}>⚡ 1 Saniyelik Bugün Kaydı</Text>
          {upsertMutation.isPending ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : savedNotice ? (
            <Text style={styles.savedBadge}>✓ Kaydedildi</Text>
          ) : (
            <Text style={styles.checkInHint}>Dokun & kaydet</Text>
          )}
        </View>

        <View style={styles.chipsWrap}>
          {QUICK_SYMPTOMS.map((chip) => {
            const active =
              chip.kind === 'symptom'
                ? selectedSymptoms.includes(chip.id)
                : selectedMoods.includes(chip.id);
            return (
              <TouchableOpacity
                key={chip.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleChip(chip)}
                activeOpacity={0.75}
              >
                <Text style={styles.chipEmoji}>{chip.emoji}</Text>
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: any, accentColor: string) =>
  StyleSheet.create({
    wrapper: {
      marginHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      gap: 10,
    },
    heroCard: {
      borderRadius: 24,
      padding: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.16,
      shadowRadius: 12,
      elevation: 6,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    ringOuter: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: 'rgba(255,255,255,0.16)',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    ringProgress: {
      position: 'absolute',
      width: 84,
      height: 84,
      borderRadius: 42,
      borderWidth: 4,
      borderTopColor: '#FFFFFF',
      borderRightColor: 'rgba(255,255,255,0.45)',
      borderBottomColor: 'rgba(255,255,255,0.2)',
      borderLeftColor: 'rgba(255,255,255,0.2)',
    },
    ringInner: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringDayNum: {
      fontSize: 26,
      fontWeight: '800',
      color: '#FFFFFF',
      lineHeight: 28,
    },
    ringDayLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: 'rgba(255,255,255,0.9)',
      letterSpacing: 0.6,
    },
    infoCol: {
      flex: 1,
      gap: 4,
    },
    phasePill: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.22)',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
    },
    phasePillText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    headline: {
      fontSize: 16,
      fontWeight: '800',
      color: '#FFFFFF',
      marginTop: 2,
    },
    subline: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.9)',
      lineHeight: 16,
    },
    actionsFooter: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
    },
    footerBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingVertical: 9,
      borderRadius: 12,
    },
    footerBtnText: {
      color: '#FFFFFF',
      fontSize: 12.5,
      fontWeight: '700',
    },
    checkInCard: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    checkInHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    checkInTitle: {
      fontSize: 13.5,
      fontWeight: '700',
      color: theme.colors.text,
    },
    checkInHint: {
      fontSize: 11.5,
      color: theme.colors.textSecondary,
    },
    savedBadge: {
      fontSize: 12,
      fontWeight: '700',
      color: '#10B981',
    },
    chipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    chipActive: {
      backgroundColor: `${accentColor}20`,
      borderColor: accentColor,
    },
    chipEmoji: {
      fontSize: 14,
    },
    chipLabel: {
      fontSize: 12.5,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    chipLabelActive: {
      color: accentColor,
      fontWeight: '700',
    },
  });
