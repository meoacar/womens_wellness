import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { gamificationService } from '@/services/gamification';
import type { DailyTasksResponse } from '@/types/gamification';

interface CyclePhaseInfo {
  phase: 'MENSTRUAL' | 'FOLLICULAR' | 'OVULATION' | 'LUTEAL';
  title: string;
  summary: string;
  nutritionTip: string;
  exerciseTip: string;
  novaPrompt: string;
  color: string;
}

interface DailyHabitSectionProps {
  cyclePhase?: CyclePhaseInfo;
  isAuthenticated: boolean;
}

const MOOD_OPTIONS = [
  { key: 'happy', emoji: '😊', label: 'Harika' },
  { key: 'calm', emoji: '😌', label: 'Sakin' },
  { key: 'tired', emoji: '😴', label: 'Yorgun' },
  { key: 'pain', emoji: '😣', label: 'Ağrılı' },
  { key: 'stressed', emoji: '🤯', label: 'Stresli' },
];

const SYMPTOM_CHIPS = ['Kramp', 'Baş Ağrısı', 'Şişkinlik', 'Yorgunluk', 'Hassasiyet', 'İyi Hissediyorum'];

export function DailyHabitSection({ cyclePhase, isAuthenticated }: DailyHabitSectionProps) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: dailyTasks, refetch: refetchDailyTasks } = useQuery<DailyTasksResponse>({
    queryKey: ['dailyTasks'],
    queryFn: () => gamificationService.getDailyTasks(),
    enabled: isAuthenticated,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        refetchDailyTasks();
      }
    }, [isAuthenticated, refetchDailyTasks]),
  );

  const [mood, setMood] = useState<string>('happy');
  const [energy, setEnergy] = useState<number>(3);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [addWater250, setAddWater250] = useState<boolean>(true);
  const [expandedForm, setExpandedForm] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'checkin' | 'phase'>('tasks');

  useEffect(() => {
    if (dailyTasks?.todayCheckin) {
      if (dailyTasks.todayCheckin.mood) setMood(dailyTasks.todayCheckin.mood);
      if (dailyTasks.todayCheckin.energy) setEnergy(dailyTasks.todayCheckin.energy);
      if (Array.isArray(dailyTasks.todayCheckin.symptoms)) {
        setSymptoms(dailyTasks.todayCheckin.symptoms);
      }
      setExpandedForm(false);
    } else if (dailyTasks && !dailyTasks.todayCheckin) {
      setExpandedForm(true);
    }
  }, [dailyTasks?.todayCheckin?.mood, dailyTasks?.dateKey]);

  const checkinMutation = useMutation({
    mutationFn: () =>
      gamificationService.submitDailyCheckin({
        mood,
        energy,
        symptoms,
        water250: addWater250 && !dailyTasks?.todayCheckin,
      }),
    onSuccess: (res) => {
      queryClient.setQueryData(['dailyTasks'], res);
      queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
      queryClient.invalidateQueries({ queryKey: ['water'] });
      setExpandedForm(false);
      Alert.alert(
        'Check-in Kaydedildi ✨',
        res.allCompleted
          ? 'Bugünün 3 mini görevini de tamamladın! +20 XP bonus kazandın.'
          : 'Günlük durumun kaydedildi ve serin güncellendi.',
      );
    },
    onError: (err: any) => {
      Alert.alert('Hata', err?.message || 'Check-in kaydedilemedi.');
    },
  });

  const toggleSymptom = (chip: string) => {
    setSymptoms((prev) =>
      prev.includes(chip) ? prev.filter((item) => item !== chip) : [...prev, chip],
    );
  };

  const styles = createStyles(theme);
  const checkedIn = Boolean(dailyTasks?.todayCheckin);
  const completedCount = dailyTasks?.completedCount ?? 0;
  const totalCount = dailyTasks?.totalCount ?? 3;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Compact Segmented Tab Switcher */}
        <View style={styles.segmentBar}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'tasks' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('tasks')}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, activeTab === 'tasks' && styles.segmentTextActive]}>
              Görevler ({completedCount}/{totalCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'checkin' && styles.segmentBtnActive]}
            onPress={() => {
              setActiveTab('checkin');
              setExpandedForm(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, activeTab === 'checkin' && styles.segmentTextActive]}>
              {checkedIn ? 'Check-in ✓' : 'Check-in'}
            </Text>
          </TouchableOpacity>

          {cyclePhase && (
            <TouchableOpacity
              style={[styles.segmentBtn, activeTab === 'phase' && styles.segmentBtnActive]}
              onPress={() => setActiveTab('phase')}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, activeTab === 'phase' && styles.segmentTextActive]}>
                Faz Rehberi
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tab 1: Today's 3 Mini Tasks */}
        {activeTab === 'tasks' && dailyTasks && (
          <View style={styles.tabBody}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.titleRow}>
                <View>
                  <Text style={styles.cardTitle}>Bugünün 3 Mini Görevi</Text>
                  <Text style={styles.cardSubtitle}>
                    {dailyTasks.allCompleted
                      ? 'Tebrikler! +20 XP günlük bonus kazandın'
                      : `3/3 tamamlayınca +${dailyTasks.bonusXp} XP ekstra bonus`}
                  </Text>
                </View>
              </View>
              <View style={styles.progressPill}>
                <Text style={styles.progressPillText}>
                  {completedCount}/{totalCount}
                </Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round((completedCount / Math.max(1, totalCount)) * 100)}%` },
                ]}
              />
            </View>

            <View style={styles.tasksList}>
              {dailyTasks.tasks.map((task) => (
                <TouchableOpacity
                  key={task.id}
                  style={[styles.taskRow, task.completed && styles.taskRowDone]}
                  onPress={() => {
                    if (task.id === 'checkin') {
                      setExpandedForm(true);
                      setActiveTab('checkin');
                    } else {
                      router.push(task.actionRoute as any);
                    }
                  }}
                >
                  <Ionicons
                    name={task.completed ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={task.completed ? '#10B981' : theme.colors.textSecondary}
                  />
                  <View style={styles.taskContent}>
                    <Text style={[styles.taskTitle, task.completed && styles.taskTitleDone]}>
                      {task.title}
                    </Text>
                    <Text style={styles.taskDesc} numberOfLines={1}>
                      {task.description}
                    </Text>
                  </View>
                  <View style={styles.xpBadge}>
                    <Text style={styles.xpBadgeText}>+{task.xp} XP</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Tab 2: 5-Second Daily Check-in */}
        {activeTab === 'checkin' && (
          <View style={styles.tabBody}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.titleRow}>
                <View>
                  <Text style={styles.cardTitle}>5 Saniyelik Check-in</Text>
                  <Text style={styles.cardSubtitle}>
                    {checkedIn
                      ? 'Bugünkü check-in tamamlandı ✓'
                      : 'Bugün nasıl hissediyorsun? (+15 XP)'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.formBody}>
            <Text style={styles.fieldLabel}>Ruh Halin</Text>
            <View style={styles.moodRow}>
              {MOOD_OPTIONS.map((opt) => {
                const active = mood === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.moodChip, active && styles.moodChipActive]}
                    onPress={() => setMood(opt.key)}
                  >
                    <Text style={styles.moodEmoji}>{opt.emoji}</Text>
                    <Text style={[styles.moodLabel, active && styles.moodLabelActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Enerji Seviyen ({energy}/5)</Text>
            <View style={styles.energyRow}>
              {[1, 2, 3, 4, 5].map((lvl) => (
                <TouchableOpacity
                  key={lvl}
                  style={[styles.energyPill, energy >= lvl && styles.energyPillActive]}
                  onPress={() => setEnergy(lvl)}
                >
                  <Text style={[styles.energyText, energy >= lvl && styles.energyTextActive]}>
                    {lvl}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Belirtiler</Text>
            <View style={styles.chipsWrap}>
              {SYMPTOM_CHIPS.map((chip) => {
                const active = symptoms.includes(chip);
                return (
                  <TouchableOpacity
                    key={chip}
                    style={[styles.symptomChip, active && styles.symptomChipActive]}
                    onPress={() => toggleSymptom(chip)}
                  >
                    <Text style={[styles.symptomText, active && styles.symptomTextActive]}>
                      {chip}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {!checkedIn && (
              <TouchableOpacity
                style={styles.waterToggle}
                onPress={() => setAddWater250((prev) => !prev)}
              >
                <Ionicons
                  name={addWater250 ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={theme.colors.primary}
                />
                <Text style={styles.waterToggleText}>
                  Check-in ile +200 ml su bardağı da ekle 💧
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => checkinMutation.mutate()}
              disabled={checkinMutation.isPending}
            >
              {checkinMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {checkedIn ? 'Check-in Güncelle' : 'Kaydet ve +15 XP Kazan'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          </View>
        )}

        {/* Tab 3: Cycle Phase Guidance */}
        {activeTab === 'phase' && cyclePhase && (
          <View style={styles.tabBody}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.titleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Döngü Fazı Rehberi</Text>
                  <Text style={[styles.phaseTitle, { color: cyclePhase.color }]}>
                    {cyclePhase.title}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={styles.phaseSummary}>{cyclePhase.summary}</Text>

            <View style={styles.tipBox}>
              <Text style={styles.tipLabel}>Beslenme İpucu</Text>
              <Text style={styles.tipText}>{cyclePhase.nutritionTip}</Text>
            </View>
            <View style={styles.tipBox}>
              <Text style={styles.tipLabel}>Egzersiz & Bakım</Text>
              <Text style={styles.tipText}>{cyclePhase.exerciseTip}</Text>
            </View>

            <TouchableOpacity
              style={styles.novaButton}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/chat',
                  params: { prompt: cyclePhase.novaPrompt },
                } as any)
              }
            >
              <Ionicons name="sparkles" size={16} color="#FFFFFF" />
              <Text style={styles.novaButtonText}>Bu Faz İçin NOVA&apos;ya Sor</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    card: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 20,
      padding: 15,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    segmentBar: {
      flexDirection: 'row',
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      padding: 3,
      gap: 4,
      marginBottom: 12,
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: 7,
      paddingHorizontal: 8,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentBtnActive: {
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    segmentText: {
      fontSize: 11.5,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    segmentTextActive: {
      color: theme.colors.primary,
      fontWeight: '800',
    },
    tabBody: {
      gap: 4,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    cardEmoji: {
      fontSize: 22,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
    },
    cardSubtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    toggleBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    toggleBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    formBody: {
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      marginBottom: 8,
      marginTop: 6,
    },
    moodRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 6,
      marginBottom: 8,
    },
    moodChip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    moodChipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}15`,
    },
    moodEmoji: {
      fontSize: 20,
    },
    moodLabel: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 3,
      fontWeight: '600',
    },
    moodLabelActive: {
      color: theme.colors.primary,
    },
    energyRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
    },
    energyPill: {
      flex: 1,
      paddingVertical: 7,
      alignItems: 'center',
      borderRadius: 10,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    energyPillActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    energyText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    energyTextActive: {
      color: '#FFFFFF',
    },
    chipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 10,
    },
    symptomChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    symptomChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    symptomText: {
      fontSize: 12,
      color: theme.colors.text,
      fontWeight: '500',
    },
    symptomTextActive: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    waterToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
      marginTop: 2,
    },
    waterToggleText: {
      fontSize: 13,
      color: theme.colors.text,
      fontWeight: '500',
    },
    submitBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    submitBtnText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
    progressPill: {
      backgroundColor: `${theme.colors.primary}20`,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    progressPillText: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    progressTrack: {
      height: 6,
      borderRadius: 4,
      backgroundColor: theme.colors.background,
      overflow: 'hidden',
      marginTop: 12,
      marginBottom: 12,
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#10B981',
      borderRadius: 4,
    },
    tasksList: {
      gap: 8,
    },
    taskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 10,
      borderRadius: 12,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    taskRowDone: {
      opacity: 0.8,
    },
    taskContent: {
      flex: 1,
    },
    taskTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    taskTitleDone: {
      textDecorationLine: 'line-through',
      color: theme.colors.textSecondary,
    },
    taskDesc: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    xpBadge: {
      backgroundColor: '#FEF3C7',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    xpBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#B45309',
    },
    phaseTitle: {
      fontSize: 13,
      fontWeight: '700',
      marginTop: 2,
    },
    phaseSummary: {
      fontSize: 13,
      color: theme.colors.text,
      lineHeight: 19,
      marginTop: 8,
      marginBottom: 10,
    },
    tipBox: {
      backgroundColor: theme.colors.background,
      borderRadius: 10,
      padding: 10,
      marginBottom: 8,
    },
    tipLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 3,
    },
    tipText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 17,
    },
    novaButton: {
      marginTop: 4,
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    novaButtonText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },
  });
