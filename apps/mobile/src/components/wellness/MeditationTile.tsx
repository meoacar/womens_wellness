import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { WellnessTile } from './WellnessTile';
import { useTheme } from '@/hooks/useTheme';
import { wellnessService } from '@/services/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

interface MeditationTileProps {
  data: {
    todayMin: number;
    goalMin: number;
    percentage: number;
    sessions: number;
  } | null;
}

const MED_ACCENT = '#8B5CF6';

export const MeditationTile: React.FC<MeditationTileProps> = ({ data }) => {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const logMeditationMutation = useMutation({
    mutationFn: (durationMin: number) =>
      wellnessService.logMeditation({
        date: new Date().toISOString(),
        durationMin,
        type: durationMin <= 3 ? 'breath' : 'guided',
        isManual: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });
      queryClient.invalidateQueries({ queryKey: ['meditation'] });
      queryClient.invalidateQueries({ queryKey: ['dailyTasks'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
    },
    onError: (error: any) => {
      Alert.alert('Hata', error.message || 'Meditasyon kaydedilemedi');
    },
  });

  const handleQuickLog = (minutes: number) => {
    logMeditationMutation.mutate(minutes);
  };

  const s = styles(theme);
  const gradient: readonly [string, string] = theme.isDark
    ? ['rgba(139,92,246,0.16)', 'rgba(236,72,153,0.08)']
    : ['#F5F3FF', '#FFFFFF'];

  const actionRow = (
    <View style={s.actionsRow}>
      <TouchableOpacity
        style={s.quickButton}
        disabled={logMeditationMutation.isPending}
        onPress={(e) => {
          e.stopPropagation();
          handleQuickLog(1);
        }}
      >
        <Text style={s.quickButtonText}>+1 dk</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={s.quickButton}
        disabled={logMeditationMutation.isPending}
        onPress={(e) => {
          e.stopPropagation();
          handleQuickLog(5);
        }}
      >
        <Text style={s.quickButtonText}>+5 dk</Text>
      </TouchableOpacity>
    </View>
  );

  if (!data) {
    return (
      <WellnessTile
        ionicon="sparkles-outline"
        title="Meditasyon"
        subtitle="Nefes & Odak"
        value="-"
        isEmpty
        emptyState="1 dk nefes ile zihnini sakinleştir"
        accentColor={MED_ACCENT}
        gradientColors={gradient}
        onPress={() => router.push('/wellness/meditation')}
        actions={actionRow}
      />
    );
  }

  const isGoalReached = data.percentage >= 100;

  return (
    <WellnessTile
      ionicon="sparkles-outline"
      title="Meditasyon"
      subtitle={isGoalReached ? '✓ Tebrikler!' : `${data.sessions} seans`}
      value={`${data.todayMin} dk`}
      target={`Hedef ${data.goalMin} dk`}
      percentage={data.percentage}
      accentColor={MED_ACCENT}
      gradientColors={gradient}
      onPress={() => router.push('/wellness/meditation')}
      actions={actionRow}
    />
  );
};

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    actionsRow: {
      flexDirection: 'row',
      gap: 6,
    },
    quickButton: {
      flex: 1,
      backgroundColor: 'rgba(139, 92, 246, 0.14)',
      paddingVertical: 7,
      paddingHorizontal: 8,
      borderRadius: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(139, 92, 246, 0.3)',
    },
    quickButtonText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: MED_ACCENT,
    },
  });
