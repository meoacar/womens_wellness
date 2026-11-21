import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  RefreshControl,
  Vibration,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { wellnessService } from '@/services/api';
import {
  MEDITATION_TRACKS,
  meditationAudioService,
  type MeditationTrackId,
} from '@/services/meditationAudio';
import { useAuthStore } from '@/store/authStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function MeditationScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [refreshing, setRefreshing] = useState(false);
  const [timerModalVisible, setTimerModalVisible] = useState(false);
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  // Timer states
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [selectedDuration, setSelectedDuration] = useState(60); // 1 minute default
  const [sessionType, setSessionType] = useState<'breath' | 'guided' | 'custom'>('breath');
  const [breathingPresetTitle, setBreathingPresetTitle] = useState<string | null>(null);
  const [breathingMode, setBreathingMode] = useState<boolean>(false);
  const [selectedTrack, setSelectedTrack] = useState<MeditationTrackId>('432hz');
  const [isMusicPlaying, setIsMusicPlaying] = useState<boolean>(false);
  const [musicVolume, setMusicVolume] = useState<number>(0.65);
  const [autoPlayMusicInTimer, setAutoPlayMusicInTimer] = useState<boolean>(true);
  const breathAnim = useRef(new Animated.Value(0.85)).current;
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      meditationAudioService.stop();
    };
  }, []);

  const handleToggleTrack = (trackId: MeditationTrackId) => {
    if (isMusicPlaying && selectedTrack === trackId) {
      meditationAudioService.stop();
      setIsMusicPlaying(false);
      return;
    }
    setSelectedTrack(trackId);
    meditationAudioService.play(trackId, musicVolume);
    setIsMusicPlaying(true);
  };

  const handleVolumeChange = (vol: number) => {
    setMusicVolume(vol);
    if (isMusicPlaying) {
      meditationAudioService.setVolume(vol);
    }
  };

  const handleStopMusic = () => {
    meditationAudioService.stop();
    setIsMusicPlaying(false);
  };

  const styles = createStyles(theme);

  // Fetch meditation data - use stable date-only strings for query keys
  const dateRange = React.useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);

    // Format as date-only strings for stable query keys
    const toDateStr = to.toISOString().split('T')[0];
    const fromDateStr = from.toISOString().split('T')[0];

    return {
      fromDateStr,
      toDateStr,
      fromISO: from.toISOString(),
      toISO: to.toISOString(),
    };
  }, []);

  const { data: sessions, isLoading, refetch, error: sessionsError } = useQuery<any[]>({
    queryKey: ['meditation', dateRange.fromDateStr, dateRange.toDateStr],
    queryFn: () => wellnessService.getMeditation(dateRange.fromISO, dateRange.toISO),
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: preferences, error: prefsError } = useQuery<any>({
    queryKey: ['wellnessPreferences'],
    queryFn: () => wellnessService.getPreferences(),
    enabled: isAuthenticated,
    retry: false,
  });

  // Show error state (only for actual errors, not loading states)
  useEffect(() => {
    if ((sessionsError || prefsError) && !isLoading) {
      const errorMsg = (sessionsError as any)?.message || (prefsError as any)?.message || 'Bilinmeyen hata';
      console.error('Meditation screen error:', { sessionsError, prefsError });

      // Don't show alert immediately, wait a bit to see if it resolves
      const timer = setTimeout(() => {
        Alert.alert(
          'Veri Yüklenemedi',
          `Bir sorun oluştu: ${errorMsg}\n\nLütfen internet bağlantınızı kontrol edin.`,
          [
            {
              text: 'Geri Dön',
              onPress: () => router.back(),
            },
            {
              text: 'Tekrar Dene',
              onPress: () => refetch(),
            },
          ]
        );
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [sessionsError, prefsError, isLoading]);

  const logMeditationMutation = useMutation({
    mutationFn: (data: { durationMin: number; type: 'breath' | 'guided' | 'custom' }) =>
      wellnessService.logMeditation({
        date: new Date().toISOString(),
        durationMin: data.durationMin,
        type: data.type,
        isManual: true,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['meditation'] });
      await queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });
      await queryClient.invalidateQueries({ queryKey: ['dailyTasks'] });
      await queryClient.invalidateQueries({ queryKey: ['gamification'] });
      await refetch();
    },
    onError: (error: any) => {
      Alert.alert('Hata', error.message || 'Meditasyon kaydedilemedi');
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: (goalMin: number) =>
      wellnessService.updatePreferences({ meditationGoalMin: goalMin }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wellnessPreferences'] });
      queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });
      setGoalModalVisible(false);
      setGoalInput('');
    },
    onError: (error: any) => {
      Alert.alert('Hata', error.message || 'Hedef güncellenemedi');
    },
  });

  // Timer logic
  useEffect(() => {
    if (isTimerRunning && timerSeconds < selectedDuration) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev + 1 >= selectedDuration) {
            handleTimerComplete();
            return selectedDuration;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isTimerRunning, timerSeconds, selectedDuration]);

  const handleTimerComplete = () => {
    setIsTimerRunning(false);
    meditationAudioService.stop();
    setIsMusicPlaying(false);
    Vibration.vibrate([0, 200, 100, 200]); // Haptic feedback

    const durationMin = Math.ceil(selectedDuration / 60);
    logMeditationMutation.mutate({ durationMin, type: sessionType });

    Alert.alert(
      'Harika! 🎉',
      `${durationMin} dakikalık meditasyon tamamlandı!`,
      [
        {
          text: 'Tamam',
          onPress: () => {
            setTimerModalVisible(false);
            resetTimer();
          },
        },
      ]
    );
  };

  // 4-7-8 Breathing Phase Calculation (19s loop: 4s inhale, 7s hold, 8s exhale)
  const getBreathPhase = (sec: number) => {
    const cycleSec = sec % 19;
    if (cycleSec < 4) {
      return { phase: 'inhale', label: 'Nefes Al (4 sn)', remaining: 4 - cycleSec, color: '#10B981' };
    }
    if (cycleSec < 11) {
      return { phase: 'hold', label: 'Tut (7 sn)', remaining: 11 - cycleSec, color: '#F59E0B' };
    }
    return { phase: 'exhale', label: 'Yavaşça Ver (8 sn)', remaining: 19 - cycleSec, color: '#8B5CF6' };
  };

  const breathPhaseInfo = breathingMode ? getBreathPhase(timerSeconds) : null;

  useEffect(() => {
    if (!breathingMode || !isTimerRunning) return;
    const cycleSec = timerSeconds % 19;
    if (cycleSec === 0) {
      Animated.timing(breathAnim, {
        toValue: 1.25,
        duration: 3800,
        useNativeDriver: true,
      }).start();
    } else if (cycleSec === 11) {
      Animated.timing(breathAnim, {
        toValue: 0.85,
        duration: 7800,
        useNativeDriver: true,
      }).start();
    }
  }, [breathingMode, isTimerRunning, timerSeconds]);

  const startTimer = (
    duration: number,
    type: 'breath' | 'guided' | 'custom',
    presetTitle?: string,
    use478 = false,
  ) => {
    setSelectedDuration(duration);
    setSessionType(type);
    setBreathingPresetTitle(presetTitle || null);
    setBreathingMode(use478);
    breathAnim.setValue(0.85);
    setTimerSeconds(0);
    setIsTimerRunning(true);
    setTimerModalVisible(true);
    if (autoPlayMusicInTimer) {
      meditationAudioService.play(selectedTrack, musicVolume);
      setIsMusicPlaying(true);
    }
  };

  const pauseTimer = () => {
    setIsTimerRunning(false);
    if (isMusicPlaying) {
      meditationAudioService.stop();
      setIsMusicPlaying(false);
    }
  };

  const resumeTimer = () => {
    setIsTimerRunning(true);
    if (autoPlayMusicInTimer) {
      meditationAudioService.play(selectedTrack, musicVolume);
      setIsMusicPlaying(true);
    }
  };

  const stopTimer = () => {
    setIsTimerRunning(false);
    meditationAudioService.stop();
    setIsMusicPlaying(false);
    setTimerModalVisible(false);
    resetTimer();
  };

  const resetTimer = () => {
    setTimerSeconds(0);
    setSelectedDuration(60);
    setSessionType('breath');
    setBreathingMode(false);
    setBreathingPresetTitle(null);
    breathAnim.setValue(0.85);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleGoalSave = (preset?: number) => {
    const goal = preset || parseInt(goalInput, 10);
    if (isNaN(goal) || goal <= 0 || goal > 1440) {
      Alert.alert('Hata', 'Lütfen geçerli bir hedef girin (1-1440 dakika)');
      return;
    }
    updateGoalMutation.mutate(goal);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Default values if data hasn't loaded yet
  const safeSessions = sessions || [];
  const safePreferences = preferences || { stepsGoal: 7000, meditationGoalMin: 10, sleepGoalHours: 7 };

  // Calculate statistics
  const calculateStats = () => {
    if (!safeSessions || safeSessions.length === 0) {
      return { today: 0, todaySessions: 0, weeklyAvg: 0, totalSessions: 0, streak: 1 };
    }

    const today = new Date();
    const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

    const todaySessions = safeSessions.filter((s: any) => {
      const d = new Date(s.date);
      const dUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      return dUTC === todayUTC;
    });

    const todayMin = todaySessions.reduce((sum: number, s: any) => sum + s.durationMin, 0);

    // Last 7 days
    const last7Days = safeSessions.filter((s: any) => {
      const date = new Date(s.date);
      const dateUTC = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
      const diff = todayUTC - dateUTC;
      return diff >= 0 && diff < 7 * 24 * 60 * 60 * 1000;
    });

    const weeklyAvg = last7Days.length > 0
      ? Math.round(last7Days.reduce((sum: number, s: any) => sum + s.durationMin, 0) / 7)
      : 0;

    // Calculate streak - count consecutive days from today backwards
    const goal = safePreferences?.meditationGoalMin || 10;
    let streak = 0;

    // Group by date and sum
    const byDate = new Map<number, number>();
    safeSessions.forEach((s: any) => {
      const d = new Date(s.date);
      const dateUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      byDate.set(dateUTC, (byDate.get(dateUTC) || 0) + s.durationMin);
    });

    // Check consecutive days from today backwards
    let checkDate = new Date();
    for (let i = 0; i < 365; i++) {
      const checkDateUTC = Date.UTC(checkDate.getUTCFullYear(), checkDate.getUTCMonth(), checkDate.getUTCDate());
      const totalMin = byDate.get(checkDateUTC) || 0;

      if (totalMin >= goal) {
        streak++;
        checkDate.setUTCDate(checkDate.getUTCDate() - 1);
      } else {
        break;
      }
    }

    // If no streak from data but user just started, show 1
    if (streak === 0 && safeSessions.length > 0) {
      streak = 1;
    }

    return {
      today: todayMin,
      todaySessions: todaySessions.length,
      weeklyAvg,
      totalSessions: safeSessions.length,
      streak,
    };
  };

  const stats = calculateStats();
  const goal = safePreferences?.meditationGoalMin || 10;
  const percentage = Math.round((stats.today / goal) * 100);

  // Get recent sessions
  const recentSessions = safeSessions?.slice(0, 10) || [];

  const getTypeLabel = (type: string) => {
    const labels = { breath: 'Nefes', guided: 'Rehberli', custom: 'Özel' };
    return labels[type as keyof typeof labels] || type;
  };

  if (isLoading && !sessions && !preferences) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Modern Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerCircleBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Meditasyon & Nefes</Text>
          <Text style={styles.headerSubtitle}>
            {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setGoalModalVisible(true)} style={styles.headerCircleBtn}>
          <Ionicons name="options-outline" size={19} color="#8B5CF6" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#8B5CF6" />
        }
      >
        {/* Serene Plum-Lavender Gradient Hero Card */}
        <LinearGradient
          colors={['#6D28D9', '#8B5CF6', '#EC4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles" size={14} color="#FFFFFF" />
              <Text style={styles.heroBadgeText}>ZİHİN & NEFES DENGESİ</Text>
            </View>
            <View style={styles.heroPctPill}>
              <Text style={styles.heroPctText}>
                {stats.today >= goal ? '✓ Hedef Tamam' : `%${percentage}`}
              </Text>
            </View>
          </View>

          <View style={styles.heroMetricRow}>
            <Text style={styles.heroMetricValue}>{stats.today}</Text>
            <Text style={styles.heroMetricUnit}>dk bugün</Text>
          </View>

          <Text style={styles.heroGoalSub}>
            {stats.todaySessions} seans tamamlandı · Günlük hedef {goal} dk
          </Text>

          <View style={styles.heroProgressTrack}>
            <View
              style={[
                styles.heroProgressFill,
                { width: `${Math.min(percentage, 100)}%` },
              ]}
            />
          </View>

          <View style={styles.heroQuickRow}>
            <TouchableOpacity
              style={styles.heroQuickBtn}
              disabled={logMeditationMutation.isPending}
              onPress={() => logMeditationMutation.mutate({ durationMin: 2, type: 'breath' })}
            >
              <Text style={styles.heroQuickBtnText}>+2 dk Nefes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroQuickBtn}
              disabled={logMeditationMutation.isPending}
              onPress={() => logMeditationMutation.mutate({ durationMin: 5, type: 'guided' })}
            >
              <Text style={styles.heroQuickBtnText}>+5 dk Meditasyon</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.heroQuickBtn, styles.heroQuickBtnSolid]}
              onPress={() => startTimer(240, 'breath', '4-7-8 Nefes Egzersizi', true)}
            >
              <Text style={styles.heroQuickBtnSolidText}>Başlat</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* 4-7-8 Breathing & Relief Presets */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🫁 4-7-8 Nefes & Rahatlama</Text>
          <Text style={styles.breathCardSub}>
            4 sn nefes al • 7 sn tut • 8 sn ver tekniği ile sinir sistemini sakinleştir.
          </Text>
          <View style={styles.breathPresetRow}>
            <TouchableOpacity
              style={styles.breathPresetBtn}
              onPress={() => startTimer(240, 'breath', 'Kramp & Ağrı Rahatlatma', true)}
            >
              <Text style={styles.breathPresetEmoji}>🌸</Text>
              <Text style={styles.breathPresetTitle}>Kramp Rahatlatıcı</Text>
              <Text style={styles.breathPresetDuration}>4 dk</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.breathPresetBtn}
              onPress={() => startTimer(300, 'breath', 'Derin Uyku Hazırlığı', true)}
            >
              <Text style={styles.breathPresetEmoji}>🌙</Text>
              <Text style={styles.breathPresetTitle}>Uyku Hazırlığı</Text>
              <Text style={styles.breathPresetDuration}>5 dk</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.breathPresetBtn}
              onPress={() => startTimer(120, 'breath', 'Hızlı Stres Azaltma', true)}
            >
              <Text style={styles.breathPresetEmoji}>✨</Text>
              <Text style={styles.breathPresetTitle}>Hızlı Stres</Text>
              <Text style={styles.breathPresetDuration}>2 dk</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Ambient Meditation Music Player */}
        <View style={styles.card}>
          <View style={styles.musicHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>🎵 Meditasyon Müzikleri</Text>
              <Text style={styles.breathCardSub}>
                Cihazında yer kaplamadan internet gerekmeden dinleyebilirsin.
              </Text>
            </View>
            {isMusicPlaying && (
              <TouchableOpacity style={styles.musicStopBtn} onPress={handleStopMusic}>
                <Ionicons name="stop" size={14} color="#FFFFFF" />
                <Text style={styles.musicStopText}>Durdur</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.musicGrid}>
            {MEDITATION_TRACKS.map((track) => {
              const active = selectedTrack === track.id && isMusicPlaying;
              const selected = selectedTrack === track.id;
              return (
                <TouchableOpacity
                  key={track.id}
                  style={[
                    styles.musicCard,
                    selected && { borderColor: track.accent },
                    active && { backgroundColor: `${track.accent}18` },
                  ]}
                  onPress={() => handleToggleTrack(track.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.musicCardTop}>
                    <Text style={styles.musicIcon}>{track.icon}</Text>
                    <Ionicons
                      name={active ? 'pause-circle' : 'play-circle-outline'}
                      size={22}
                      color={active ? track.accent : theme.colors.textSecondary}
                    />
                  </View>
                  <Text style={styles.musicTitle} numberOfLines={1}>
                    {track.title}
                  </Text>
                  <Text style={styles.musicSub} numberOfLines={1}>
                    {active ? 'Çalıyor...' : track.subtitle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.musicControlsRow}>
            <Text style={styles.musicVolLabel}>Ses:</Text>
            {[
              { label: 'Kısık', val: 0.35 },
              { label: 'Orta', val: 0.65 },
              { label: 'Yüksek', val: 0.95 },
            ].map((opt) => {
              const active = Math.abs(musicVolume - opt.val) < 0.1;
              return (
                <TouchableOpacity
                  key={opt.label}
                  style={[styles.musicVolChip, active && styles.musicVolChipActive]}
                  onPress={() => handleVolumeChange(opt.val)}
                >
                  <Text style={[styles.musicVolText, active && styles.musicVolTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[
                styles.musicTimerToggle,
                autoPlayMusicInTimer && styles.musicTimerToggleActive,
              ]}
              onPress={() => setAutoPlayMusicInTimer((prev) => !prev)}
            >
              <Ionicons
                name={autoPlayMusicInTimer ? 'musical-notes' : 'volume-mute-outline'}
                size={13}
                color={autoPlayMusicInTimer ? '#8B5CF6' : theme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.musicTimerToggleText,
                  autoPlayMusicInTimer && { color: '#8B5CF6', fontWeight: '700' },
                ]}
              >
                Seansta çal
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Start */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hızlı Başlat</Text>

          <View style={styles.quickStartGrid}>
            <TouchableOpacity
              style={styles.quickStartButton}
              onPress={() => startTimer(60, 'breath')}
            >
              <Text style={styles.quickStartIcon}>🧘‍♀️</Text>
              <Text style={styles.quickStartLabel}>1 dk</Text>
              <Text style={styles.quickStartSublabel}>Nefes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickStartButton}
              onPress={() => startTimer(300, 'guided')}
            >
              <Text style={styles.quickStartIcon}>🎧</Text>
              <Text style={styles.quickStartLabel}>5 dk</Text>
              <Text style={styles.quickStartSublabel}>Rehberli</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickStartButton}
              onPress={() => startTimer(600, 'guided')}
            >
              <Text style={styles.quickStartIcon}>🌙</Text>
              <Text style={styles.quickStartLabel}>10 dk</Text>
              <Text style={styles.quickStartSublabel}>Meditasyon</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickStartButton}
              onPress={() => startTimer(1200, 'custom')}
            >
              <Text style={styles.quickStartIcon}>⏱️</Text>
              <Text style={styles.quickStartLabel}>20 dk</Text>
              <Text style={styles.quickStartSublabel}>Derin</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Statistics */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>İstatistikler</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.weeklyAvg}</Text>
              <Text style={styles.statLabel}>Haftalık Ort. (dk)</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalSessions}</Text>
              <Text style={styles.statLabel}>Toplam Seans</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.streak}</Text>
              <Text style={styles.statLabel}>Seri (gün)</Text>
            </View>
          </View>
        </View>

        {/* Recent Sessions */}
        {recentSessions.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Son Seanslar</Text>

            {recentSessions.map((session: any, index: number) => (
              <View key={session.id || index} style={styles.sessionItem}>
                <View style={styles.sessionLeft}>
                  <Text style={styles.sessionType}>{getTypeLabel(session.type)}</Text>
                  <Text style={styles.sessionDate}>
                    {new Date(session.date).toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <Text style={styles.sessionDuration}>{session.durationMin} dk</Text>
              </View>
            ))}
          </View>
        )}

        {/* Tips */}
        <View style={[styles.card, styles.tipsCard]}>
          <Text style={styles.tipsIcon}>💡</Text>
          <Text style={styles.tipsTitle}>İpucu</Text>
          <Text style={styles.tipsText}>
            Düzenli meditasyon, stresi azaltır, odaklanmayı artırır ve genel ruh sağlığını destekler.
            Her gün aynı saatte yaparak bir rutin oluşturun.
          </Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Timer Modal */}
      <Modal
        visible={timerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={stopTimer}
      >
        <View style={styles.timerModalOverlay}>
          <View style={styles.timerModalContent}>
            <Text style={styles.timerTitle}>
              {breathingPresetTitle || getTypeLabel(sessionType)}
            </Text>

            {breathingMode && breathPhaseInfo ? (
              <View style={styles.breathModalWrap}>
                <Animated.View
                  style={[
                    styles.breathOuterCircle,
                    {
                      borderColor: breathPhaseInfo.color,
                      backgroundColor: `${breathPhaseInfo.color}20`,
                      transform: [{ scale: breathAnim }],
                    },
                  ]}
                >
                  <Text style={[styles.breathPhaseLabel, { color: breathPhaseInfo.color }]}>
                    {breathPhaseInfo.label}
                  </Text>
                  <Text style={styles.breathCountdown}>{breathPhaseInfo.remaining} sn</Text>
                </Animated.View>
                <Text style={styles.timerGoal}>
                  {formatTime(timerSeconds)} / {formatTime(selectedDuration)}
                </Text>
              </View>
            ) : (
              <View style={styles.timerCircle}>
                <Text style={styles.timerTime}>{formatTime(timerSeconds)}</Text>
                <Text style={styles.timerGoal}>/ {formatTime(selectedDuration)}</Text>
              </View>
            )}

            <View style={styles.timerProgress}>
              <View style={styles.timerProgressBackground}>
                <View
                  style={[
                    styles.timerProgressFill,
                    { width: `${(timerSeconds / selectedDuration) * 100}%` },
                  ]}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalMusicPill}
              onPress={() => handleToggleTrack(selectedTrack)}
            >
              <Ionicons
                name={isMusicPlaying ? 'musical-notes' : 'volume-mute-outline'}
                size={15}
                color="#8B5CF6"
              />
              <Text style={styles.modalMusicPillText}>
                {isMusicPlaying
                  ? `${MEDITATION_TRACKS.find((t) => t.id === selectedTrack)?.title || 'Müzik'} çalıyor (Kapat)`
                  : `${MEDITATION_TRACKS.find((t) => t.id === selectedTrack)?.title || 'Müzik'} Başlat`}
              </Text>
            </TouchableOpacity>

            <View style={styles.timerControls}>
              {!isTimerRunning && timerSeconds === 0 && (
                <TouchableOpacity style={styles.timerButton} onPress={resumeTimer}>
                  <Ionicons name="play-sharp" size={32} color={theme.colors.textOnPrimary} />
                </TouchableOpacity>
              )}

              {isTimerRunning && (
                <TouchableOpacity style={styles.timerButton} onPress={pauseTimer}>
                  <Ionicons name="pause-sharp" size={32} color={theme.colors.textOnPrimary} />
                </TouchableOpacity>
              )}

              {!isTimerRunning && timerSeconds > 0 && (
                <>
                  <TouchableOpacity style={styles.timerButton} onPress={resumeTimer}>
                    <Ionicons name="play-sharp" size={32} color={theme.colors.textOnPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.timerButton, styles.timerButtonSecondary]} onPress={stopTimer}>
                    <Ionicons name="stop-sharp" size={32} color={theme.colors.text} />
                  </TouchableOpacity>
                </>
              )}
            </View>

            {!isTimerRunning && timerSeconds === 0 && (
              <TouchableOpacity style={styles.cancelTimerButton} onPress={stopTimer}>
                <Text style={styles.cancelTimerText}>İptal</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Goal Setting Modal */}
      <Modal
        visible={goalModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setGoalModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Günlük Hedef</Text>

            <Text style={styles.presetsLabel}>Hızlı Seçim</Text>
            <View style={styles.presetsContainer}>
              <TouchableOpacity style={styles.presetButton} onPress={() => handleGoalSave(5)}>
                <Text style={styles.presetButtonText}>5 dk</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetButton} onPress={() => handleGoalSave(10)}>
                <Text style={styles.presetButtonText}>10 dk</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetButton} onPress={() => handleGoalSave(20)}>
                <Text style={styles.presetButtonText}>20 dk</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setGoalModalVisible(false);
                  setGoalInput('');
                }}
              >
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    loadingText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      padding: 8,
      marginLeft: -8,
    },
    backButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    headerTitleContainer: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    headerSubtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    headerRight: {
      width: 40,
    },
    container: {
      flex: 1,
    },
    content: {
      padding: theme.spacing.lg,
      paddingBottom: 100,
    },
    card: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: theme.card.borderRadius,
      padding: theme.card.padding,
      marginBottom: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    chipSuccess: {
      backgroundColor: theme.colors.primary + '20',
    },
    chipText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    metricContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
      marginBottom: 4,
    },
    metricValue: {
      fontSize: 48,
      fontWeight: '700',
      color: theme.colors.text,
    },
    metricUnit: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginLeft: 8,
    },
    sessionsText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing.md,
    },
    progressBarContainer: {
      marginBottom: theme.spacing.lg,
    },
    progressBarBackground: {
      height: 8,
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 8,
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: 4,
    },
    progressText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    actions: {
      flexDirection: 'row',
      gap: 12,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: theme.colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    actionButtonPrimary: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    actionButtonTextPrimary: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textOnPrimary,
    },
    quickStartGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.md,
    },
    quickStartButton: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: 12,
      padding: theme.spacing.lg,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    quickStartIcon: {
      fontSize: 32,
      marginBottom: 8,
    },
    quickStartLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 2,
    },
    quickStartSublabel: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.textSecondary,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.md,
    },
    statItem: {
      flex: 1,
      minWidth: '30%',
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: 12,
      padding: theme.spacing.md,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    sessionItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    sessionLeft: {
      flex: 1,
    },
    sessionType: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 2,
    },
    sessionDate: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    sessionDuration: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    tipsCard: {
      backgroundColor: theme.colors.primary + '10',
      borderColor: theme.colors.primary + '30',
    },
    tipsIcon: {
      fontSize: 24,
      marginBottom: 8,
    },
    tipsTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
    },
    tipsText: {
      fontSize: 13,
      lineHeight: 20,
      color: theme.colors.textSecondary,
    },
    bottomSpacer: {
      height: 40,
    },
    timerModalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
    },
    timerModalContent: {
      width: '100%',
      alignItems: 'center',
    },
    timerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.spacing.xl,
    },
    timerCircle: {
      width: 280,
      height: 280,
      borderRadius: 140,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 8,
      borderColor: theme.colors.primary + '30',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.xl,
    },
    timerTime: {
      fontSize: 64,
      fontWeight: '700',
      color: theme.colors.text,
    },
    timerGoal: {
      fontSize: 18,
      fontWeight: '500',
      color: theme.colors.textSecondary,
      marginTop: 8,
    },
    timerProgress: {
      width: '100%',
      marginBottom: theme.spacing.xl,
    },
    timerProgressBackground: {
      height: 8,
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: 4,
      overflow: 'hidden',
    },
    timerProgressFill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: 4,
    },
    timerControls: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: theme.spacing.lg,
    },
    timerButton: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    timerButtonSecondary: {
      backgroundColor: theme.colors.backgroundSecondary,
    },
    cancelTimerButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
    },
    cancelTimerText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
    },
    modalContent: {
      backgroundColor: theme.colors.background,
      borderRadius: 16,
      padding: theme.spacing.lg,
      width: '100%',
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.spacing.lg,
    },
    presetsLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
    },
    presetsContainer: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: theme.spacing.lg,
    },
    presetButton: {
      flex: 1,
      backgroundColor: theme.colors.backgroundCard,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    presetButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: theme.colors.backgroundSecondary,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    breathCardSub: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginBottom: 12,
      lineHeight: 18,
    },
    breathPresetRow: {
      flexDirection: 'row',
      gap: 8,
    },
    breathPresetBtn: {
      flex: 1,
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      padding: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    breathPresetEmoji: {
      fontSize: 22,
      marginBottom: 4,
    },
    breathPresetTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
    },
    breathPresetDuration: {
      fontSize: 11,
      color: theme.colors.primary,
      fontWeight: '600',
      marginTop: 2,
    },
    breathModalWrap: {
      alignItems: 'center',
      marginVertical: 16,
    },
    breathOuterCircle: {
      width: 170,
      height: 170,
      borderRadius: 85,
      borderWidth: 4,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 22,
    },
    breathPhaseLabel: {
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
      paddingHorizontal: 10,
    },
    breathCountdown: {
      fontSize: 28,
      fontWeight: '800',
      color: theme.colors.text,
      marginTop: 4,
    },
    headerCircleBtn: {
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroCard: {
      borderRadius: 24,
      padding: 20,
      marginBottom: theme.spacing.lg,
      shadowColor: '#7C3AED',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 6,
    },
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    heroBadgeText: {
      color: '#FFFFFF',
      fontSize: 10.5,
      fontWeight: '800',
      letterSpacing: 0.7,
    },
    heroPctPill: {
      backgroundColor: '#FFFFFF',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    heroPctText: {
      color: '#7C3AED',
      fontSize: 12,
      fontWeight: '800',
    },
    heroMetricRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
      marginBottom: 4,
    },
    heroMetricValue: {
      fontSize: 44,
      fontWeight: '900',
      color: '#FFFFFF',
      letterSpacing: -1,
    },
    heroMetricUnit: {
      fontSize: 17,
      fontWeight: '700',
      color: 'rgba(255,255,255,0.88)',
    },
    heroGoalSub: {
      fontSize: 13,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.85)',
      marginBottom: 14,
    },
    heroProgressTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.25)',
      overflow: 'hidden',
      marginBottom: 16,
    },
    heroProgressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: '#FFFFFF',
    },
    heroQuickRow: {
      flexDirection: 'row',
      gap: 8,
    },
    heroQuickBtn: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.18)',
      paddingVertical: 9,
      paddingHorizontal: 6,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.28)',
    },
    heroQuickBtnText: {
      color: '#FFFFFF',
      fontSize: 11.5,
      fontWeight: '800',
    },
    heroQuickBtnSolid: {
      flex: 0.85,
      backgroundColor: '#FFFFFF',
      borderColor: '#FFFFFF',
    },
    heroQuickBtnSolidText: {
      color: '#7C3AED',
      fontSize: 12.5,
      fontWeight: '800',
    },
    musicHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    musicStopBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#EF4444',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
    },
    musicStopText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    musicGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 4,
    },
    musicCard: {
      width: '48%',
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      gap: 4,
    },
    musicCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    musicIcon: {
      fontSize: 22,
    },
    musicTitle: {
      fontSize: 13.5,
      fontWeight: '700',
      color: theme.colors.text,
    },
    musicSub: {
      fontSize: 11.5,
      color: theme.colors.textSecondary,
    },
    musicControlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    musicVolLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginRight: 2,
    },
    musicVolChip: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 9,
      backgroundColor: theme.colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    musicVolChipActive: {
      backgroundColor: 'rgba(139, 92, 246, 0.14)',
      borderColor: '#8B5CF6',
    },
    musicVolText: {
      fontSize: 11.5,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    musicVolTextActive: {
      color: '#8B5CF6',
      fontWeight: '700',
    },
    musicTimerToggle: {
      marginLeft: 'auto',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 9,
      backgroundColor: theme.colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    musicTimerToggleActive: {
      backgroundColor: 'rgba(139, 92, 246, 0.12)',
      borderColor: 'rgba(139, 92, 246, 0.4)',
    },
    musicTimerToggleText: {
      fontSize: 11.5,
      color: theme.colors.textSecondary,
    },
    modalMusicPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(139, 92, 246, 0.12)',
      marginBottom: 16,
    },
    modalMusicPillText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: '#8B5CF6',
    },
  });
