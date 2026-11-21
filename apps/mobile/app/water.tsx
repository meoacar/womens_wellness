import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { waterService, userService } from '@/services/api';
import { useTheme } from '@/hooks/useTheme';

const DEFAULT_TARGET_ML = 2000;

interface WaterTodayData {
  totalMl: number;
  targetMl?: number;
  logs: Array<{ id: string; amountMl: number; loggedAt: string }>;
}

const QUICK_OPTIONS = [
  { ml: 200, label: '200 ml', subtitle: 'Su Bardağı', icon: '🥛' },
  { ml: 500, label: '500 ml', subtitle: 'Küçük Şişe', icon: '💧' },
  { ml: 750, label: '750 ml', subtitle: 'Spor Matarası', icon: '🫗' },
  { ml: 1000, label: '1000 ml', subtitle: '1 Litre Sürahi', icon: '🌊' },
];

export default function WaterScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<'ml' | 'L'>('ml');
  const [displayMl, setDisplayMl] = useState(0);
  const [lastAddedMl, setLastAddedMl] = useState<number | null>(null);

  const { data: todayData } = useQuery<WaterTodayData>({
    queryKey: ['waterToday'],
    queryFn: () => waterService.getTodayTotal() as Promise<WaterTodayData>,
  });

  const { data: meData } = useQuery<any>({
    queryKey: ['me'],
    queryFn: () => userService.getMe(),
    staleTime: 5 * 60 * 1000,
  });

  const weightKg = meData?.profile?.weightKg;
  const dailyTargetMl =
    todayData?.targetMl || (weightKg ? Math.round(weightKg * 30) : DEFAULT_TARGET_ML);

  // Animated values for water tank, pouring droplets, bubbles, and celebration toast
  const fillLevelAnim = useRef(new Animated.Value(0)).current;
  const tankScaleAnim = useRef(new Animated.Value(1)).current;
  const waveShiftAnim = useRef(new Animated.Value(0)).current;

  const pourStreamOpacity = useRef(new Animated.Value(0)).current;
  const pourDrop1Y = useRef(new Animated.Value(-40)).current;
  const pourDrop2Y = useRef(new Animated.Value(-60)).current;
  const pourDrop3Y = useRef(new Animated.Value(-80)).current;

  const bubble1Y = useRef(new Animated.Value(0)).current;
  const bubble2Y = useRef(new Animated.Value(0)).current;
  const bubble3Y = useRef(new Animated.Value(0)).current;

  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(20)).current;
  const toastScale = useRef(new Animated.Value(0.7)).current;

  // Continuous gentle wave & bubble loop
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(waveShiftAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(waveShiftAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    const animateBubble = (anim: Animated.Value, duration: number, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animateBubble(bubble1Y, 2400, 0);
    animateBubble(bubble2Y, 3000, 700);
    animateBubble(bubble3Y, 2700, 1400);
  }, []);

  // Sync water level when todayData loads
  useEffect(() => {
    if (todayData?.totalMl !== undefined) {
      setDisplayMl(todayData.totalMl);
      const pct = Math.min((todayData.totalMl / dailyTargetMl) * 100, 100);
      Animated.spring(fillLevelAnim, {
        toValue: pct,
        friction: 7,
        tension: 45,
        useNativeDriver: false,
      }).start();
    }
  }, [todayData?.totalMl, dailyTargetMl]);

  const playPourAnimation = (addedMl: number, nextTotalMl: number) => {
    setLastAddedMl(addedMl);
    const nextPct = Math.min((nextTotalMl / dailyTargetMl) * 100, 100);

    // Reset pouring drops
    pourStreamOpacity.setValue(1);
    pourDrop1Y.setValue(-30);
    pourDrop2Y.setValue(-55);
    pourDrop3Y.setValue(-80);

    // 1. Falling water droplets into the glass
    Animated.parallel([
      Animated.timing(pourDrop1Y, {
        toValue: 150,
        duration: 420,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(pourDrop2Y, {
        toValue: 165,
        duration: 520,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(pourDrop3Y, {
        toValue: 180,
        duration: 620,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(450),
        Animated.timing(pourStreamOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // 2. Glass elastic bounce + water level rising
    Animated.sequence([
      Animated.delay(220),
      Animated.parallel([
        Animated.spring(fillLevelAnim, {
          toValue: nextPct,
          friction: 6,
          tension: 55,
          useNativeDriver: false,
        }),
        Animated.sequence([
          Animated.timing(tankScaleAnim, {
            toValue: 1.06,
            duration: 160,
            easing: Easing.out(Easing.back(2)),
            useNativeDriver: true,
          }),
          Animated.spring(tankScaleAnim, {
            toValue: 1,
            friction: 4,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();

    // 3. Floating "+250 ml Eklendi! 💧" celebration pill
    toastOpacity.setValue(1);
    toastTranslateY.setValue(16);
    toastScale.setValue(0.6);

    Animated.parallel([
      Animated.spring(toastScale, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(toastTranslateY, {
        toValue: -10,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(950),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setLastAddedMl(null);
    });
  };

  const addWaterMutation = useMutation({
    mutationFn: (amountMl: number) => waterService.logWater({ amountMl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waterToday'] });
      queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });
      queryClient.invalidateQueries({ queryKey: ['dailyTasks'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
    },
    onError: (error: any) => {
      if (todayData?.totalMl !== undefined) {
        setDisplayMl(todayData.totalMl);
      }
      Alert.alert('Hata', error.message || 'Su eklenirken bir hata oluştu');
    },
  });

  const commitAddWater = (ml: number) => {
    const nextTotal = displayMl + ml;
    setDisplayMl(nextTotal);
    setAmount('');
    playPourAnimation(ml, nextTotal);
    addWaterMutation.mutate(ml);
  };

  const handleQuickAdd = (ml: number) => {
    commitAddWater(ml);
  };

  const normalizedInput = amount.trim().replace(',', '.');
  const parsedAmount = parseFloat(normalizedInput);
  const hasDecimal = normalizedInput.includes('.') && !Number.isNaN(parsedAmount);
  const computedPreviewMl =
    !Number.isNaN(parsedAmount) && parsedAmount > 0
      ? unit === 'L' || hasDecimal
        ? Math.round(parsedAmount * 1000)
        : Math.round(parsedAmount)
      : 0;

  const handleCustomAdd = () => {
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Hata', 'Lütfen geçerli bir miktar girin (örn: 200 ml veya 1.5 L)');
      return;
    }

    // In Litre mode or decimal entry (e.g. 1.5), convert to milliliters automatically
    if (unit === 'L' || hasDecimal) {
      const ml = Math.round(parsedAmount * 1000);
      if (ml <= 0 || ml > 15000) {
        Alert.alert('Hata', 'Lütfen geçerli bir miktar girin (en fazla 15 Litre)');
        return;
      }
      commitAddWater(ml);
      return;
    }

    const intMl = Math.round(parsedAmount);
    // If user entered a small integer (1..10) in ml mode, confirm whether they meant Liters
    if (intMl >= 1 && intMl <= 10) {
      Alert.alert(
        'Litre mi Girdiniz?',
        `${intMl} sayısı ${intMl} Litre (${intMl * 1000} ml) olarak eklensin mi?`,
        [
          {
            text: `Hayır (${intMl} ml)`,
            onPress: () => commitAddWater(intMl),
          },
          {
            text: `Evet (${intMl} Litre / ${intMl * 1000} ml)`,
            onPress: () => commitAddWater(intMl * 1000),
          },
        ],
      );
      return;
    }

    if (intMl > 15000) {
      Alert.alert('Hata', 'Tek seferde en fazla 15000 ml ekleyebilirsiniz');
      return;
    }

    commitAddWater(intMl);
  };

  const percentage = Math.min(Math.round((displayMl / dailyTargetMl) * 100), 100);
  const styles = createStyles(theme);

  const animatedFillHeight = fillLevelAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const waveTranslateX = waveShiftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-14, 14],
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Su Takibi 💧</Text>
            <Text style={styles.subtitle}>Günlük hedef: {dailyTargetMl} ml</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Animated Water Glass / Tank Card */}
        <View style={styles.tankCard}>
          {/* Celebration Floating Pill */}
          {lastAddedMl !== null && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.toastPill,
                {
                  opacity: toastOpacity,
                  transform: [{ translateY: toastTranslateY }, { scale: toastScale }],
                },
              ]}
            >
              <Text style={styles.toastPillText}>+{lastAddedMl} ml Eklendi! 💧</Text>
            </Animated.View>
          )}

          <Animated.View
            style={[
              styles.glassOuter,
              { transform: [{ scale: tankScaleAnim }] },
            ]}
          >
            {/* Falling Water Drops Animation */}
            <Animated.View
              pointerEvents="none"
              style={[styles.pourContainer, { opacity: pourStreamOpacity }]}
            >
              <Animated.Text
                style={[styles.pourDrop, { transform: [{ translateY: pourDrop1Y }] }]}
              >
                💧
              </Animated.Text>
              <Animated.Text
                style={[
                  styles.pourDrop,
                  { left: '56%', transform: [{ translateY: pourDrop2Y }] },
                ]}
              >
                💧
              </Animated.Text>
              <Animated.Text
                style={[
                  styles.pourDrop,
                  { left: '42%', transform: [{ translateY: pourDrop3Y }] },
                ]}
              >
                💧
              </Animated.Text>
            </Animated.View>

            {/* Animated Rising Water Fill */}
            <Animated.View
              style={[
                styles.waterFillWrapper,
                { height: animatedFillHeight },
              ]}
            >
              {/* Animated Surface Wave Crest */}
              <Animated.View
                style={[
                  styles.waveCrest,
                  { transform: [{ translateX: waveTranslateX }, { scaleX: 1.25 }] },
                ]}
              />

              <LinearGradient
                colors={['#38BDF8', '#0EA5E9', '#0284C7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.waterGradient}
              >
                {/* Rising Bubbles inside water */}
                <Animated.View
                  style={[
                    styles.bubble,
                    {
                      left: '25%',
                      width: 10,
                      height: 10,
                      opacity: bubble1Y.interpolate({
                        inputRange: [0, 0.8, 1],
                        outputRange: [0.2, 0.7, 0],
                      }),
                      transform: [
                        {
                          translateY: bubble1Y.interpolate({
                            inputRange: [0, 1],
                            outputRange: [140, -10],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.bubble,
                    {
                      left: '65%',
                      width: 14,
                      height: 14,
                      opacity: bubble2Y.interpolate({
                        inputRange: [0, 0.8, 1],
                        outputRange: [0.2, 0.65, 0],
                      }),
                      transform: [
                        {
                          translateY: bubble2Y.interpolate({
                            inputRange: [0, 1],
                            outputRange: [150, -15],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.bubble,
                    {
                      left: '48%',
                      width: 8,
                      height: 8,
                      opacity: bubble3Y.interpolate({
                        inputRange: [0, 0.8, 1],
                        outputRange: [0.2, 0.75, 0],
                      }),
                      transform: [
                        {
                          translateY: bubble3Y.interpolate({
                            inputRange: [0, 1],
                            outputRange: [130, -10],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              </LinearGradient>
            </Animated.View>

            {/* Overlay Text inside Glass */}
            <View style={styles.glassOverlay}>
              <Text
                style={[
                  styles.percentageText,
                  percentage > 55 && styles.percentageTextOnWater,
                ]}
              >
                %{percentage}
              </Text>
              <Text
                style={[
                  styles.mlCounterText,
                  percentage > 45 && styles.mlCounterTextOnWater,
                ]}
              >
                {displayMl} / {dailyTargetMl} ml
              </Text>
              {percentage >= 100 && (
                <View style={styles.goalBadge}>
                  <Text style={styles.goalBadgeText}>🎉 Günlük Hedef Tamamlandı!</Text>
                </View>
              )}
            </View>
          </Animated.View>
        </View>

        {/* Quick Add Buttons */}
        <View style={styles.quickButtons}>
          <Text style={styles.sectionTitle}>Hızlı Su Ekle</Text>
          <View style={styles.gridContainer}>
            {QUICK_OPTIONS.map((item) => (
              <TouchableOpacity
                key={item.ml}
                style={styles.quickButton}
                onPress={() => handleQuickAdd(item.ml)}
                activeOpacity={0.75}
              >
                <Text style={styles.quickButtonIcon}>{item.icon}</Text>
                <Text style={styles.quickButtonText}>+{item.label}</Text>
                <Text style={styles.quickButtonSubtext}>{item.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Custom Amount */}
        <View style={styles.customSection}>
          <View style={styles.customHeaderRow}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
              Özel Miktar ({unit === 'L' ? 'Litre' : 'ml'})
            </Text>
            <View style={styles.unitToggle}>
              <TouchableOpacity
                onPress={() => setUnit('ml')}
                style={[styles.unitBtn, unit === 'ml' && styles.unitBtnActive]}
              >
                <Text style={[styles.unitBtnText, unit === 'ml' && styles.unitBtnTextActive]}>
                  ml
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setUnit('L')}
                style={[styles.unitBtn, unit === 'L' && styles.unitBtnActive]}
              >
                <Text style={[styles.unitBtnText, unit === 'L' && styles.unitBtnTextActive]}>
                  Litre (L)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.customInputRow}>
            <TextInput
              style={styles.input}
              placeholder={unit === 'L' ? 'Örn: 1.5 veya 2' : 'Örn: 330 veya 1.5 (L)'}
              placeholderTextColor={theme.colors.textLight}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleCustomAdd}
              activeOpacity={0.8}
            >
              <Text style={styles.addButtonText}>+ Ekle</Text>
            </TouchableOpacity>
          </View>
          {computedPreviewMl > 0 && (
            <Text style={styles.previewHint}>
              = {computedPreviewMl} ml ({(computedPreviewMl / 1000).toFixed(2).replace(/\.?0+$/, '')} L) olarak eklenecek
            </Text>
          )}
        </View>

        {/* Today's Water Logs */}
        {todayData?.logs && todayData.logs.length > 0 && (
          <View style={styles.logsSection}>
            <Text style={styles.sectionTitle}>Bugünkü Kayıtlar</Text>
            {todayData.logs.slice(0, 6).map((log: any, index: number) => (
              <View key={log.id || index} style={styles.logItem}>
                <View style={styles.logLeft}>
                  <Text style={styles.logIcon}>💧</Text>
                  <Text style={styles.logAmount}>{log.amountMl} ml</Text>
                </View>
                <Text style={styles.logTime}>
                  {new Date(log.loggedAt).toLocaleTimeString('tr-TR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            ))}
          </View>
        )}
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
      padding: theme.spacing.lg,
      paddingBottom: 40,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
    },
    title: {
      ...theme.typography.title,
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    closeButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.colors.backgroundCard,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    closeButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    tankCard: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.xl,
      position: 'relative',
    },
    toastPill: {
      position: 'absolute',
      top: -10,
      zIndex: 30,
      backgroundColor: '#0284C7',
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 20,
      shadowColor: '#0284C7',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 6,
    },
    toastPillText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },
    glassOuter: {
      width: 210,
      height: 240,
      borderRadius: 36,
      backgroundColor: '#F0F9FF',
      borderWidth: 4,
      borderColor: '#BAE6FD',
      overflow: 'hidden',
      justifyContent: 'flex-end',
      position: 'relative',
      shadowColor: '#0EA5E9',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 6,
    },
    pourContainer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 15,
      alignItems: 'center',
    },
    pourDrop: {
      position: 'absolute',
      top: 0,
      fontSize: 22,
    },
    waterFillWrapper: {
      width: '100%',
      position: 'relative',
      overflow: 'visible',
    },
    waveCrest: {
      position: 'absolute',
      top: -10,
      left: -20,
      right: -20,
      height: 22,
      borderRadius: 16,
      backgroundColor: '#38BDF8',
      opacity: 0.75,
    },
    waterGradient: {
      flex: 1,
      width: '100%',
      position: 'relative',
      overflow: 'hidden',
    },
    bubble: {
      position: 'absolute',
      bottom: 0,
      borderRadius: 99,
      backgroundColor: '#FFFFFF',
    },
    glassOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 20,
      paddingHorizontal: 12,
    },
    percentageText: {
      fontSize: 40,
      fontWeight: '900',
      color: '#0369A1',
    },
    percentageTextOnWater: {
      color: '#FFFFFF',
      textShadowColor: 'rgba(0, 0, 0, 0.2)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    mlCounterText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#0284C7',
      marginTop: 4,
    },
    mlCounterTextOnWater: {
      color: '#E0F2FE',
    },
    goalBadge: {
      marginTop: 10,
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    goalBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#0284C7',
    },
    sectionTitle: {
      ...theme.typography.subtitle,
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    quickButtons: {
      marginBottom: theme.spacing.xl,
    },
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 12,
    },
    quickButton: {
      width: '48%',
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 18,
      paddingVertical: 16,
      paddingHorizontal: 12,
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: '#BAE6FD',
      shadowColor: '#0EA5E9',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 2,
    },
    quickButtonIcon: {
      fontSize: 28,
      marginBottom: 6,
    },
    quickButtonText: {
      fontSize: 18,
      fontWeight: '800',
      color: '#0284C7',
      marginBottom: 2,
    },
    quickButtonSubtext: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    customSection: {
      marginBottom: theme.spacing.xl,
    },
    customHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    unitToggle: {
      flexDirection: 'row',
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 10,
      padding: 3,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 4,
    },
    unitBtn: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
    },
    unitBtnActive: {
      backgroundColor: '#0284C7',
    },
    unitBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    unitBtnTextActive: {
      color: '#FFFFFF',
    },
    previewHint: {
      marginTop: 8,
      fontSize: 12.5,
      fontWeight: '600',
      color: '#0284C7',
    },
    customInputRow: {
      flexDirection: 'row',
      gap: 10,
    },
    input: {
      flex: 1,
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: theme.button.borderRadius,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 14,
      fontSize: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      color: theme.colors.text,
    },
    addButton: {
      backgroundColor: '#0284C7',
      borderRadius: theme.button.borderRadius,
      paddingHorizontal: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    logsSection: {
      marginTop: 4,
    },
    logItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.colors.backgroundCard,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    logLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    logIcon: {
      fontSize: 16,
    },
    logAmount: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
    },
    logTime: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
  });
