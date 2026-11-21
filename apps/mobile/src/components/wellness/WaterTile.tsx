import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useRouter } from 'expo-router';
import { waterService } from '@/services/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface WaterTileProps {
  data: {
    current: number;
    target: number;
    logs: number;
  };
}

export const WaterTile: React.FC<WaterTileProps> = ({ data }) => {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [optimisticCurrent, setOptimisticCurrent] = useState(data.current);
  const [addedAmount, setAddedAmount] = useState<number | null>(null);

  const fillAnim = useRef(
    new Animated.Value(Math.min((data.current / (data.target || 2000)) * 100, 100))
  ).current;
  const dropBounceAnim = useRef(new Animated.Value(1)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const badgeTranslateY = useRef(new Animated.Value(10)).current;
  const badgeScale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    setOptimisticCurrent(data.current);
    const pct = Math.min((data.current / (data.target || 2000)) * 100, 100);
    Animated.spring(fillAnim, {
      toValue: pct,
      friction: 7,
      tension: 50,
      useNativeDriver: false,
    }).start();
  }, [data.current, data.target]);

  const triggerSplashAnimation = (amountMl: number, nextTotal: number) => {
    setAddedAmount(amountMl);
    const nextPct = Math.min((nextTotal / (data.target || 2000)) * 100, 100);

    // Animate progress bar fill
    Animated.spring(fillAnim, {
      toValue: nextPct,
      friction: 6,
      tension: 60,
      useNativeDriver: false,
    }).start();

    // Bounce droplet icon
    Animated.sequence([
      Animated.timing(dropBounceAnim, {
        toValue: 1.45,
        duration: 180,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }),
      Animated.spring(dropBounceAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    // Floating "+250 ml 💧" badge animation
    badgeOpacity.setValue(1);
    badgeTranslateY.setValue(8);
    badgeScale.setValue(0.6);

    Animated.parallel([
      Animated.spring(badgeScale, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(badgeTranslateY, {
        toValue: -18,
        duration: 750,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(450),
        Animated.timing(badgeOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setAddedAmount(null);
    });
  };

  const logWaterMutation = useMutation({
    mutationFn: (amountMl: number) => waterService.logWater({ amountMl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });
      queryClient.invalidateQueries({ queryKey: ['waterToday'] });
      queryClient.invalidateQueries({ queryKey: ['dailyTasks'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
    },
    onError: (error: any) => {
      setOptimisticCurrent(data.current);
      Alert.alert('Hata', error.message || 'Su kaydedilemedi');
    },
  });

  const handleQuickAdd = (amountMl: number) => {
    const nextTotal = optimisticCurrent + amountMl;
    setOptimisticCurrent(nextTotal);
    triggerSplashAnimation(amountMl, nextTotal);
    logWaterMutation.mutate(amountMl);
  };

  const formatWater = (ml: number) => {
    if (ml >= 1000) {
      return `${(ml / 1000).toFixed(1)} L`;
    }
    return `${ml} ml`;
  };

  const percentage = Math.round((optimisticCurrent / (data.target || 2000)) * 100);
  const isEmpty = optimisticCurrent === 0;
  const s = styles(theme);

  const animatedWidth = fillAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <TouchableOpacity
      style={s.tile}
      onPress={() => router.push('/water')}
      activeOpacity={0.8}
    >
      {/* Floating Splash Badge */}
      {addedAmount !== null && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.floatingBadge,
            {
              opacity: badgeOpacity,
              transform: [{ translateY: badgeTranslateY }, { scale: badgeScale }],
            },
          ]}
        >
          <Text style={s.floatingBadgeText}>+{addedAmount} ml 💧</Text>
        </Animated.View>
      )}

      <View style={s.header}>
        <View style={s.titleRow}>
          <Animated.Text
            style={[s.icon, { transform: [{ scale: dropBounceAnim }] }]}
          >
            💧
          </Animated.Text>
          <View style={s.titleContainer}>
            <Text style={s.title}>Su</Text>
            <Text style={s.subtitle}>%{Math.min(percentage, 100)} tamamlandı</Text>
          </View>
        </View>
      </View>

      <View style={s.content}>
        {/* Animated Water Progress Bar */}
        <View style={s.progressContainer}>
          <View style={s.progressBar}>
            <Animated.View
              style={[
                s.progressFill,
                {
                  width: animatedWidth,
                  backgroundColor:
                    percentage >= 100 ? '#10B981' : '#0EA5E9',
                },
              ]}
            />
          </View>
        </View>

        {isEmpty ? (
          <Text style={s.emptyText}>Henüz kayıt yok – hemen ekle!</Text>
        ) : (
          <View style={s.valueRow}>
            <Text style={s.value}>{formatWater(optimisticCurrent)}</Text>
            <Text style={s.target}>Hedef {formatWater(data.target || 2000)}</Text>
          </View>
        )}

        <View style={s.actionsRow}>
          <TouchableOpacity
            style={s.quickButton}
            onPress={() => handleQuickAdd(200)}
            activeOpacity={0.7}
          >
            <Text style={s.quickButtonText}>+200 ml</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.quickButton}
            onPress={() => handleQuickAdd(500)}
            activeOpacity={0.7}
          >
            <Text style={s.quickButtonText}>+500 ml</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    tile: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 16,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minHeight: 160,
      flex: 1,
      position: 'relative',
      overflow: 'visible',
    },
    floatingBadge: {
      position: 'absolute',
      top: 8,
      right: 10,
      backgroundColor: '#0EA5E9',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      zIndex: 20,
      shadowColor: '#0EA5E9',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 6,
    },
    floatingBadgeText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '800',
    },
    header: {
      marginBottom: theme.spacing.sm,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    icon: {
      fontSize: 24,
      marginRight: theme.spacing.sm,
    },
    titleContainer: {
      flex: 1,
    },
    title: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: 11,
      fontWeight: '600',
      color: '#0EA5E9',
      marginTop: 1,
    },
    content: {
      flex: 1,
      justifyContent: 'space-between',
    },
    progressContainer: {
      marginBottom: theme.spacing.xs,
    },
    progressBar: {
      height: 8,
      backgroundColor: '#E0F2FE',
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
    },
    valueRow: {
      marginBottom: theme.spacing.xs,
    },
    value: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 2,
    },
    target: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.textSecondary,
    },
    emptyText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginVertical: 6,
      lineHeight: 16,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 4,
    },
    quickButton: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: '#0EA5E918',
      paddingVertical: 7,
      paddingHorizontal: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#0EA5E945',
    },
    quickButtonText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#0284C7',
    },
  });
