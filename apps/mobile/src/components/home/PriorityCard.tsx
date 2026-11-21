import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cyclesService, waterService } from '@/services/api';

interface PriorityCardProps {
  card: {
    id: string;
    type: string;
    data: any;
  };
  onDismiss?: () => void;
  onPin?: () => void;
}

export function PriorityCard({ card, onDismiss }: PriorityCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const styles = createStyles(theme);

  const logWaterMutation = useMutation({
    mutationFn: (amountMl: number) => waterService.logWater({ amountMl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });
      queryClient.invalidateQueries({ queryKey: ['waterToday'] });
      queryClient.invalidateQueries({ queryKey: ['dailyTasks'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
    },
    onError: (error: any) => {
      Alert.alert('Hata', error.message || 'Su eklenemedi.');
    },
  });

  const logMoodMutation = useMutation({
    mutationFn: (mood: string[]) => {
      const today = new Date().toISOString().split('T')[0];
      return cyclesService.upsertDailyLog({ date: today, mood });
    },
    onSuccess: () => {
      Alert.alert('Kaydedildi', 'Ruh halin güncellendi.');
      queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });
      queryClient.invalidateQueries({ queryKey: ['dailyTasks'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
      onDismiss?.();
    },
    onError: (error: any) => {
      Alert.alert('Hata', error.message || 'Ruh halin kaydedilemedi.');
    },
  });

  const renderCardHeader = (
    iconName: keyof typeof Ionicons.glyphMap,
    iconColor: string,
    iconBg: string,
    title: string,
    allowDismiss = true,
  ) => (
    <View style={styles.headerRow}>
      <View style={styles.headerLeft}>
        <View style={[styles.iconBadge, { backgroundColor: iconBg }]}>
          <Ionicons name={iconName} size={17} color={iconColor} />
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {allowDismiss && onDismiss && (
        <TouchableOpacity
          style={styles.dismissBtn}
          onPress={onDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={16} color={theme.colors.textLight} />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderCardContent = () => {
    switch (card.type) {
      case 'hydration': {
        const progress = Math.min(
          100,
          Math.round(((card.data.current || 0) / Math.max(1, card.data.target || 2000)) * 100),
        );
        return (
          <View>
            {renderCardHeader(
              'water-outline',
              '#0EA5E9',
              'rgba(14,165,233,0.12)',
              'Hidrasyon Takibi',
              false,
            )}
            <View style={styles.progressRow}>
              <Text style={styles.bodyText}>
                {(card.data.current / 1000).toFixed(1)} L / {(card.data.target / 1000).toFixed(1)} L
              </Text>
              <Text style={styles.pctText}>%{progress}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: '#0EA5E9' }]} />
            </View>
            <View style={styles.pillActionsRow}>
              <TouchableOpacity
                style={styles.pillBtn}
                onPress={() => logWaterMutation.mutate(200)}
                disabled={logWaterMutation.isPending}
                activeOpacity={0.8}
              >
                <Text style={styles.pillBtnText}>+200 ml</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pillBtn}
                onPress={() => logWaterMutation.mutate(500)}
                disabled={logWaterMutation.isPending}
                activeOpacity={0.8}
              >
                <Text style={styles.pillBtnText}>+500 ml</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      case 'cycle_insight': {
        const confLabel =
          card.data.estimate?.confidence === 'high'
            ? 'Yüksek Güven'
            : card.data.estimate?.confidence === 'medium'
            ? 'Orta Güven'
            : 'Düşük Güven';
        return (
          <View>
            {renderCardHeader(
              'calendar-outline',
              '#EC4899',
              'rgba(236,72,153,0.12)',
              'Döngü Tahmini',
            )}
            <Text style={styles.bodyText}>
              Döngü {card.data.cycleDay}. gün ·{' '}
              {card.data.daysUntil > 0
                ? `Sonraki regl ${card.data.daysUntil} gün sonra`
                : 'Regl dönemi yaklaştı'}
            </Text>
            <View style={styles.footerRow}>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>{confLabel}</Text>
              </View>
              <TouchableOpacity
                style={styles.inlineLinkBtn}
                onPress={() => router.push('/(tabs)/calendar')}
              >
                <Text style={styles.inlineLinkText}>Takvime Git</Text>
                <Ionicons name="chevron-forward" size={14} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      case 'symptom_log':
        return (
          <View>
            {renderCardHeader(
              'happy-outline',
              '#8B5CF6',
              'rgba(139,92,246,0.12)',
              'Hızlı Ruh Hali Kaydı',
            )}
            <Text style={styles.bodyText}>Bugün kendini nasıl hissediyorsun?</Text>
            <View style={styles.pillActionsRow}>
              <TouchableOpacity
                style={styles.moodChip}
                onPress={() => logMoodMutation.mutate(['Mutlu'])}
                disabled={logMoodMutation.isPending}
              >
                <Text style={styles.moodChipText}>😊 Mutlu</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.moodChip}
                onPress={() => logMoodMutation.mutate(['Sakin'])}
                disabled={logMoodMutation.isPending}
              >
                <Text style={styles.moodChipText}>😌 Sakin</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.moodChip}
                onPress={() => logMoodMutation.mutate(['Üzgün'])}
                disabled={logMoodMutation.isPending}
              >
                <Text style={styles.moodChipText}>😔 Hassas</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'reminder':
        return (
          <View>
            {renderCardHeader(
              'alarm-outline',
              '#6366F1',
              'rgba(99,102,241,0.12)',
              'Günün Hatırlatıcıları',
            )}
            <Text style={styles.bodyText}>
              Bugün {card.data.count} aktif hatırlatıcı var
              {card.data.next
                ? ` · Sonraki ${new Date(card.data.next.nextRunAt).toLocaleTimeString('tr-TR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : ''}
            </Text>
            <View style={styles.footerRow}>
              <View />
              <TouchableOpacity
                style={styles.inlineLinkBtn}
                onPress={() => router.push('/(tabs)/reminders')}
              >
                <Text style={styles.inlineLinkText}>Tümünü Gör</Text>
                <Ionicons name="chevron-forward" size={14} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'nova_prompt':
        return (
          <View>
            {renderCardHeader(
              'sparkles',
              '#EC4899',
              'rgba(236,72,153,0.12)',
              'NOVA Önerisi',
            )}
            <Text style={styles.bodyText} numberOfLines={3}>
              {card.data.prompt}
            </Text>
            <View style={styles.footerRow}>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>Kişisel Asistan</Text>
              </View>
              <TouchableOpacity
                style={styles.novaCtaBtn}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/chat',
                    params: { prompt: card.data.prompt },
                  } as any)
                }
                activeOpacity={0.85}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={13} color="#FFFFFF" />
                <Text style={styles.novaCtaText}>NOVA&apos;ya Sor</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  const content = renderCardContent();
  if (!content) return null;

  return <View style={styles.container}>{content}</View>;
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.backgroundCard,
      marginBottom: 10,
      borderRadius: 18,
      padding: 15,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    iconBadge: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 14.5,
      fontWeight: '700',
      color: theme.colors.text,
      flex: 1,
    },
    dismissBtn: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bodyText: {
      fontSize: 13,
      lineHeight: 19,
      color: theme.colors.textSecondary,
      marginBottom: 10,
    },
    progressRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    pctText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: '#0EA5E9',
    },
    progressTrack: {
      height: 6,
      borderRadius: 999,
      backgroundColor: theme.colors.background,
      overflow: 'hidden',
      marginBottom: 12,
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
    },
    pillActionsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    pillBtn: {
      flex: 1,
      backgroundColor: theme.isDark ? 'rgba(14,165,233,0.16)' : '#F0F9FF',
      paddingVertical: 8,
      borderRadius: 11,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(14,165,233,0.3)' : '#BAE6FD',
    },
    pillBtnText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: '#0284C7',
    },
    moodChip: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingVertical: 8,
      borderRadius: 11,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    moodChipText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: theme.colors.text,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 2,
    },
    metaPill: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: theme.colors.background,
    },
    metaPillText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    inlineLinkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    inlineLinkText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    novaCtaBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
    },
    novaCtaText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
  });
