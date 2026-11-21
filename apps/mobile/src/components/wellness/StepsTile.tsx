import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { WellnessTile } from './WellnessTile';
import { useTheme } from '@/hooks/useTheme';
import { usePedometer } from '@/hooks/usePedometer';
import { wellnessService } from '@/services/api';
import { pedometerSyncService } from '@/services/pedometerSync';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

interface StepsTileProps {
  data: {
    today: number;
    goal: number;
    percentage: number;
    source: string;
  } | null;
}

const STEP_ACCENT = '#10B981';

export const StepsTile: React.FC<StepsTileProps> = ({ data }) => {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [stepsInput, setStepsInput] = useState('');
  const {
    isPedometerAvailable,
    hasPermission,
    isAutoActive,
    totalSteps: autoSteps,
    enableAndStart,
  } = usePedometer();

  const logStepsMutation = useMutation({
    mutationFn: (count: number) =>
      wellnessService.logSteps({
        date: new Date().toISOString(),
        count,
        isManual: true,
      }),
    onSuccess: async (_res, count) => {
      await pedometerSyncService.recordManualSteps(count);
      queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });
      queryClient.invalidateQueries({ queryKey: ['steps'] });
      queryClient.invalidateQueries({ queryKey: ['dailyTasks'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
      setModalVisible(false);
      setStepsInput('');
    },
    onError: (error: any) => {
      Alert.alert('Hata', error.message || 'Adım kaydedilemedi');
    },
  });

  const handleManualAdd = () => {
    const count = parseInt(stepsInput, 10);
    if (isNaN(count) || count <= 0) {
      Alert.alert('Hata', 'Lütfen geçerli bir adım sayısı girin');
      return;
    }
    logStepsMutation.mutate(count);
  };

  const formatNumber = (num: number) => new Intl.NumberFormat('tr-TR').format(num);

  const s = styles(theme);
  const gradient: readonly [string, string] = theme.isDark
    ? ['rgba(16,185,129,0.14)', 'rgba(6,182,212,0.06)']
    : ['#ECFDF5', '#FFFFFF'];

  const effectiveToday = Math.max(data?.today || 0, isAutoActive ? autoSteps : 0);
  const effectiveGoal = data?.goal || 7000;
  const effectivePct =
    effectiveGoal > 0 ? Math.round((effectiveToday / effectiveGoal) * 100) : 0;

  const quickActions = (
    <View style={s.actionsRow}>
      {isPedometerAvailable && hasPermission === false ? (
        <TouchableOpacity
          style={s.quickButton}
          onPress={(e) => {
            e.stopPropagation();
            enableAndStart();
          }}
        >
          <Text style={s.quickButtonText}>Oto Sayaç Aç</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={s.quickButton}
          disabled={logStepsMutation.isPending}
          onPress={(e) => {
            e.stopPropagation();
            logStepsMutation.mutate(effectiveToday + 2000);
          }}
        >
          <Text style={s.quickButtonText}>+2.000</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={s.quickButton}
        onPress={(e) => {
          e.stopPropagation();
          setModalVisible(true);
        }}
      >
        <Text style={s.quickButtonText}>Ekle</Text>
      </TouchableOpacity>
    </View>
  );

  if (!data && effectiveToday <= 0) {
    return (
      <>
        <WellnessTile
          ionicon="footsteps-outline"
          title="Adım"
          value="-"
          isEmpty
          emptyState={
            isAutoActive
              ? 'Otomatik sayaç aktif'
              : 'Bugün adım kaydı yok'
          }
          accentColor={STEP_ACCENT}
          gradientColors={gradient}
          onPress={() => router.push('/wellness/steps')}
          actions={quickActions}
        />
        {renderModal()}
      </>
    );
  }

  const isGoalReached = effectivePct >= 100;

  function renderModal() {
    return (
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Bugünkü Adım Sayısı</Text>

            <View style={s.presetsRow}>
              {[3000, 5000, 7500, 10000].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={s.presetChip}
                  onPress={() => logStepsMutation.mutate(val)}
                >
                  <Text style={s.presetChipText}>{formatNumber(val)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.inputContainer}>
              <Text style={s.inputLabel}>veya toplam adım girin</Text>
              <TextInput
                style={s.input}
                value={stepsInput}
                onChangeText={setStepsInput}
                placeholder="Örn: 6500"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="number-pad"
                autoFocus
              />
            </View>

            <View style={s.modalButtons}>
              <TouchableOpacity
                style={[s.modalButton, s.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setStepsInput('');
                }}
              >
                <Text style={s.cancelButtonText}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.modalButton, s.saveButton]}
                onPress={handleManualAdd}
                disabled={logStepsMutation.isPending}
              >
                <Text style={s.saveButtonText}>
                  {logStepsMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <>
      <WellnessTile
        ionicon="footsteps-outline"
        title="Adım"
        subtitle={
          isGoalReached
            ? '✓ Hedefe ulaştın!'
            : `${isAutoActive ? 'Oto • ' : ''}~${((effectiveToday * 0.75) / 1000).toFixed(1)} km`
        }
        value={`${formatNumber(effectiveToday)}`}
        target={`Hedef ${formatNumber(effectiveGoal)} adım`}
        percentage={effectivePct}
        accentColor={STEP_ACCENT}
        gradientColors={gradient}
        onPress={() => router.push('/wellness/steps')}
        actions={quickActions}
      />
      {renderModal()}
    </>
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
      backgroundColor: 'rgba(16, 185, 129, 0.14)',
      paddingVertical: 7,
      paddingHorizontal: 8,
      borderRadius: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    quickButtonText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: '#059669',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(15, 10, 25, 0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 24,
      padding: 22,
      width: '100%',
      maxWidth: 400,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: 19,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: 14,
    },
    presetsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 14,
    },
    presetChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: 'rgba(16, 185, 129, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    presetChipText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: '#059669',
    },
    inputContainer: {
      marginBottom: 18,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginBottom: 8,
    },
    input: {
      backgroundColor: theme.isDark ? '#141418' : '#F9FAFB',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      color: theme.colors.text,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 10,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 12,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: theme.colors.backgroundSecondary,
    },
    cancelButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
    },
    saveButton: {
      backgroundColor: STEP_ACCENT,
    },
    saveButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
