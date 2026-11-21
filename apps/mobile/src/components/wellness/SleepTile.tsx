import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { WellnessTile } from './WellnessTile';
import { useTheme } from '@/hooks/useTheme';
import { wellnessService } from '@/services/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

interface SleepTileProps {
  data: {
    lastNightMin: number;
    goalHours: number;
    percentage: number;
    quality?: string;
  } | null;
}

const SLEEP_ACCENT = '#6366F1';

export const SleepTile: React.FC<SleepTileProps> = ({ data }) => {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [hoursInput, setHoursInput] = useState('');
  const [selectedQuality, setSelectedQuality] = useState<'good' | 'medium' | 'poor' | undefined>();

  const logSleepMutation = useMutation({
    mutationFn: (params: { durationMin: number; quality?: 'good' | 'medium' | 'poor' }) => {
      const now = new Date();
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);

      return wellnessService.logSleep({
        sleepDate: yesterday.toISOString(),
        durationMin: params.durationMin,
        quality: params.quality,
        isManual: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });
      queryClient.invalidateQueries({ queryKey: ['sleep'] });
      queryClient.invalidateQueries({ queryKey: ['dailyTasks'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
      setModalVisible(false);
      setHoursInput('');
      setSelectedQuality(undefined);
    },
    onError: (error: any) => {
      Alert.alert('Hata', error.message || 'Uyku kaydedilemedi');
    },
  });

  const handleQuickLog = (hours: number) => {
    logSleepMutation.mutate({ durationMin: Math.round(hours * 60) });
  };

  const handleManualSave = () => {
    const hours = parseFloat(hoursInput.replace(',', '.'));
    if (isNaN(hours) || hours <= 0 || hours > 24) {
      Alert.alert('Hata', 'Lütfen geçerli bir uyku süresi girin (0-24 saat)');
      return;
    }
    logSleepMutation.mutate({ durationMin: Math.round(hours * 60), quality: selectedQuality });
  };

  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} sa`;
    return `${hours} sa ${mins} dk`;
  };

  const getQualityLabel = (quality?: string) => {
    if (!quality) return 'Dün gece';
    const labels = { good: 'İyi uyku 😊', medium: 'Orta uyku 😐', poor: 'Zayıf uyku 😴' };
    return labels[quality as keyof typeof labels] || 'Dün gece';
  };

  const s = styles(theme);
  const gradient: readonly [string, string] = theme.isDark
    ? ['rgba(99,102,241,0.16)', 'rgba(139,92,246,0.08)']
    : ['#EEF2FF', '#FFFFFF'];

  const renderModal = () => (
    <Modal
      visible={modalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={s.modalOverlay}>
        <View style={s.modalContent}>
          <Text style={s.modalTitle}>Dün Gece Uykusu</Text>
          <Text style={s.modalSubtitle}>Hızlı seç veya süreyi gir</Text>

          <View style={s.presetsContainer}>
            {[6, 7, 7.5, 8].map((h) => (
              <TouchableOpacity
                key={h}
                style={s.presetButton}
                onPress={() => handleQuickLog(h)}
              >
                <Text style={s.presetButtonText}>{h} s</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.inputContainer}>
            <Text style={s.inputLabel}>veya manuel girin (saat)</Text>
            <TextInput
              style={s.input}
              value={hoursInput}
              onChangeText={setHoursInput}
              placeholder="Örn: 7.5"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={s.qualityContainer}>
            <Text style={s.inputLabel}>Uyku Kalitesi (opsiyonel)</Text>
            <View style={s.qualityButtons}>
              {(
                [
                  { key: 'good', label: '😊 İyi' },
                  { key: 'medium', label: '😐 Orta' },
                  { key: 'poor', label: '😴 Zayıf' },
                ] as const
              ).map((q) => (
                <TouchableOpacity
                  key={q.key}
                  style={[
                    s.qualityButton,
                    selectedQuality === q.key && s.qualityButtonSelected,
                  ]}
                  onPress={() => setSelectedQuality(q.key)}
                >
                  <Text
                    style={[
                      s.qualityButtonText,
                      selectedQuality === q.key && { color: SLEEP_ACCENT },
                    ]}
                  >
                    {q.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.modalButtons}>
            <TouchableOpacity
              style={[s.modalButton, s.cancelButton]}
              onPress={() => {
                setModalVisible(false);
                setHoursInput('');
                setSelectedQuality(undefined);
              }}
            >
              <Text style={s.cancelButtonText}>İptal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.modalButton, s.saveButton]}
              onPress={handleManualSave}
              disabled={logSleepMutation.isPending || !hoursInput}
            >
              <Text style={s.saveButtonText}>
                {logSleepMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (!data) {
    return (
      <>
        <WellnessTile
          ionicon="moon-outline"
          title="Uyku"
          value="-"
          isEmpty
          emptyState="Dün gece uyku kaydı yok"
          accentColor={SLEEP_ACCENT}
          gradientColors={gradient}
          onPress={() => router.push('/wellness/sleep')}
          actions={
            <View style={s.actionsRow}>
              <TouchableOpacity
                style={s.quickButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleQuickLog(7);
                }}
              >
                <Text style={s.quickButtonText}>7 s</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.quickButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleQuickLog(8);
                }}
              >
                <Text style={s.quickButtonText}>8 s</Text>
              </TouchableOpacity>
            </View>
          }
        />
        {renderModal()}
      </>
    );
  }

  return (
    <>
      <WellnessTile
        ionicon="moon-outline"
        title="Uyku"
        subtitle={getQualityLabel(data.quality)}
        value={formatHours(data.lastNightMin)}
        target={`Hedef ${data.goalHours} saat`}
        percentage={data.percentage}
        accentColor={SLEEP_ACCENT}
        gradientColors={gradient}
        onPress={() => router.push('/wellness/sleep')}
        actions={
          <View style={s.actionsRow}>
            <TouchableOpacity
              style={s.quickButton}
              onPress={(e) => {
                e.stopPropagation();
                setModalVisible(true);
              }}
            >
              <Text style={s.quickButtonText}>Düzenle / Ekle</Text>
            </TouchableOpacity>
          </View>
        }
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
      backgroundColor: 'rgba(99, 102, 241, 0.14)',
      paddingVertical: 7,
      paddingHorizontal: 10,
      borderRadius: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(99, 102, 241, 0.3)',
    },
    quickButtonText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: SLEEP_ACCENT,
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
      marginBottom: 4,
    },
    modalSubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginBottom: 14,
    },
    presetsContainer: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    presetButton: {
      flex: 1,
      backgroundColor: 'rgba(99, 102, 241, 0.12)',
      paddingVertical: 11,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(99, 102, 241, 0.3)',
    },
    presetButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: SLEEP_ACCENT,
    },
    inputContainer: {
      marginBottom: 16,
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
    qualityContainer: {
      marginBottom: 18,
    },
    qualityButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    qualityButton: {
      flex: 1,
      backgroundColor: theme.colors.backgroundSecondary,
      paddingVertical: 10,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    qualityButtonSelected: {
      backgroundColor: 'rgba(99, 102, 241, 0.14)',
      borderColor: SLEEP_ACCENT,
    },
    qualityButtonText: {
      fontSize: 12.5,
      fontWeight: '600',
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
      backgroundColor: SLEEP_ACCENT,
    },
    saveButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
