import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { cyclesService } from '@/services/api';

export interface PeriodCycleRecord {
  id: string;
  startDate: string;
  endDate?: string | null;
  notes?: string | null;
}

interface PeriodCycleModalProps {
  visible: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  initialStartDate: Date;
  cycles?: PeriodCycleRecord[];
  initialCycleId?: string;
  assumedPeriodLength?: number;
}

const toDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const normalizeDay = (value: Date | string): Date => {
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
    }
    const parsed = new Date(value);
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
  }
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
};

const addDays = (date: Date, delta: number): Date => {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  next.setDate(next.getDate() + delta);
  return next;
};

const diffDaysInclusive = (start: Date, end: Date): number => {
  const s = normalizeDay(start).getTime();
  const e = normalizeDay(end).getTime();
  return Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
};

const formatLongTr = (date: Date): string =>
  date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'short',
  });

const formatShortTr = (date: Date): string =>
  date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
  });

export function PeriodCycleModal({
  visible,
  onClose,
  mode,
  initialStartDate,
  cycles = [],
  initialCycleId,
  assumedPeriodLength = 5,
}: PeriodCycleModalProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [activeMode, setActiveMode] = useState<'create' | 'edit'>(mode);
  const [selectedCycleId, setSelectedCycleId] = useState<string | undefined>(initialCycleId);
  const [startDate, setStartDate] = useState<Date>(() => normalizeDay(initialStartDate));
  const [hasExplicitEnd, setHasExplicitEnd] = useState<boolean>(false);
  const [endDate, setEndDate] = useState<Date>(() =>
    addDays(normalizeDay(initialStartDate), Math.max(0, assumedPeriodLength - 1)),
  );
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const selectedCycle = useMemo(
    () => cycles.find((c) => c.id === selectedCycleId) || cycles[0],
    [cycles, selectedCycleId],
  );

  useEffect(() => {
    if (!visible) {
      setShowStartPicker(false);
      setShowEndPicker(false);
      return;
    }

    const effectiveMode = mode === 'edit' && cycles.length > 0 ? 'edit' : 'create';
    setActiveMode(effectiveMode);

    if (effectiveMode === 'edit') {
      const target =
        cycles.find((c) => c.id === initialCycleId) || cycles[0];
      if (target) {
        setSelectedCycleId(target.id);
        const s = normalizeDay(target.startDate);
        setStartDate(s);
        if (target.endDate) {
          setHasExplicitEnd(true);
          setEndDate(normalizeDay(target.endDate));
        } else {
          setHasExplicitEnd(false);
          setEndDate(addDays(s, Math.max(0, assumedPeriodLength - 1)));
        }
        return;
      }
    }

    const s = normalizeDay(initialStartDate);
    setSelectedCycleId(undefined);
    setStartDate(s);
    setHasExplicitEnd(false);
    setEndDate(addDays(s, Math.max(0, assumedPeriodLength - 1)));
  }, [visible, mode, initialStartDate, initialCycleId, cycles, assumedPeriodLength]);

  const handleSelectCycle = (cycle: PeriodCycleRecord) => {
    setActiveMode('edit');
    setSelectedCycleId(cycle.id);
    const s = normalizeDay(cycle.startDate);
    setStartDate(s);
    if (cycle.endDate) {
      setHasExplicitEnd(true);
      setEndDate(normalizeDay(cycle.endDate));
    } else {
      setHasExplicitEnd(false);
      setEndDate(addDays(s, Math.max(0, assumedPeriodLength - 1)));
    }
    setShowStartPicker(false);
    setShowEndPicker(false);
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['calendar'] });
    queryClient.invalidateQueries({ queryKey: ['cycles'] });
    queryClient.invalidateQueries({ queryKey: ['prediction'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
    queryClient.invalidateQueries({ queryKey: ['patternInsights'] });
    queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const startKey = toDateKey(startDate);
      const endKey = hasExplicitEnd ? toDateKey(endDate) : null;

      if (hasExplicitEnd && endDate < startDate) {
        throw new Error('Bitiş tarihi başlangıç tarihinden önce olamaz.');
      }

      if (activeMode === 'edit' && selectedCycle?.id) {
        return cyclesService.updateCycle(selectedCycle.id, {
          startDate: startKey,
          endDate: endKey,
        });
      }

      return cyclesService.createCycle({
        startDate: startKey,
        ...(endKey ? { endDate: endKey } : {}),
      });
    },
    onSuccess: () => {
      invalidateAll();
      onClose();
    },
    onError: (err: any) => {
      Alert.alert('Hata', err?.message || 'Regl kaydı kaydedilemedi.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (cycleId: string) => cyclesService.deleteCycle(cycleId),
    onSuccess: () => {
      invalidateAll();
      onClose();
    },
    onError: (err: any) => {
      Alert.alert('Hata', err?.message || 'Regl kaydı silinemedi.');
    },
  });

  const handleDeleteCycle = () => {
    if (!selectedCycle?.id) return;
    Alert.alert(
      'Regl Kaydını Sil',
      `${formatShortTr(normalizeDay(selectedCycle.startDate))} başlangıçlı regl kaydını silmek istiyor musunuz? Diğer kayıtlarınız korunur.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(selectedCycle.id),
        },
      ],
    );
  };

  const updateStartDateSafe = (nextStart: Date) => {
    const normalized = normalizeDay(nextStart);
    const currentDuration = Math.max(1, diffDaysInclusive(startDate, endDate));
    setStartDate(normalized);
    if (hasExplicitEnd) {
      if (endDate < normalized) {
        setEndDate(addDays(normalized, Math.max(0, currentDuration - 1)));
      }
    } else {
      setEndDate(addDays(normalized, Math.max(0, assumedPeriodLength - 1)));
    }
  };

  const todayNormalized = useMemo(() => normalizeDay(new Date()), []);
  const selectedDurationDays = hasExplicitEnd
    ? Math.max(1, diffDaysInclusive(startDate, endDate))
    : assumedPeriodLength;

  const isBusy = saveMutation.isPending || deleteMutation.isPending;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.grabberRow}>
          <View style={styles.grabber} />
        </View>

        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelButton} disabled={isBusy}>
            <Text style={styles.cancelButtonText}>Vazgeç</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {activeMode === 'edit' ? 'Regl Tarihini Düzenle' : 'Regl Başlat'}
          </Text>
          <TouchableOpacity
            onPress={() => saveMutation.mutate()}
            disabled={isBusy}
            style={[styles.savePill, isBusy && styles.disabledBtn]}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.savePillText}>Kaydet</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Cycle Selector when editing existing records */}
          {cycles.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                <Text style={styles.cardLabel}>Kayıtlı Regl Dönemlerin</Text>
                {activeMode === 'edit' && (
                  <TouchableOpacity
                    onPress={() => {
                      setActiveMode('create');
                      const s = normalizeDay(initialStartDate);
                      setStartDate(s);
                      setHasExplicitEnd(false);
                      setEndDate(addDays(s, Math.max(0, assumedPeriodLength - 1)));
                    }}
                    style={styles.newCycleLink}
                  >
                    <Ionicons name="add-circle-outline" size={14} color="#FF4D8D" />
                    <Text style={styles.newCycleLinkText}>Yeni Başlat</Text>
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cycleChipList}
              >
                {cycles.slice(0, 8).map((cycle) => {
                  const s = normalizeDay(cycle.startDate);
                  const e = cycle.endDate ? normalizeDay(cycle.endDate) : null;
                  const isActive =
                    activeMode === 'edit' && selectedCycle?.id === cycle.id;
                  const daysCount = e ? diffDaysInclusive(s, e) : null;
                  return (
                    <TouchableOpacity
                      key={cycle.id}
                      style={[styles.cycleChip, isActive && styles.cycleChipActive]}
                      onPress={() => handleSelectCycle(cycle)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.cycleChipText,
                          isActive && styles.cycleChipTextActive,
                        ]}
                      >
                        {formatShortTr(s)}
                        {e ? ` – ${formatShortTr(e)} (${daysCount}g)` : ' (Otomatik)'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Start Date Card */}
          <View style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="water" size={18} color="#FF4D8D" />
              <Text style={styles.sectionTitle}>Adet Başlangıç Tarihi</Text>
            </View>
            <Text style={styles.sectionHint}>
              İşaretlemeyi unuttuysan önceki günlerden birini seçebilirsin.
            </Text>

            <TouchableOpacity
              style={styles.dateBox}
              onPress={() => setShowStartPicker((prev) => !prev)}
              activeOpacity={0.8}
            >
              <View style={styles.dateBoxLeft}>
                <Ionicons name="calendar-outline" size={18} color="#FF4D8D" />
                <Text style={styles.dateBoxText}>{formatLongTr(startDate)}</Text>
              </View>
              <Ionicons
                name={showStartPicker ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>

            {showStartPicker && (
              <View style={styles.pickerWrapper}>
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  locale="tr-TR"
                  maximumDate={addDays(todayNormalized, 1)}
                  onChange={(_, date) => {
                    if (Platform.OS !== 'ios') {
                      setShowStartPicker(false);
                    }
                    if (date) {
                      updateStartDateSafe(date);
                    }
                  }}
                />
              </View>
            )}

            {/* Quick Start Date Helpers */}
            <View style={styles.quickRow}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => updateStartDateSafe(addDays(startDate, -1))}
              >
                <Text style={styles.stepBtnText}>-1 Gün</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => updateStartDateSafe(addDays(startDate, 1))}
                disabled={startDate >= todayNormalized}
              >
                <Text
                  style={[
                    styles.stepBtnText,
                    startDate >= todayNormalized && styles.stepBtnTextDisabled,
                  ]}
                >
                  +1 Gün
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickChip}
                onPress={() => updateStartDateSafe(todayNormalized)}
              >
                <Text style={styles.quickChipText}>Bugün</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickChip}
                onPress={() => updateStartDateSafe(addDays(todayNormalized, -1))}
              >
                <Text style={styles.quickChipText}>Dün</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickChip}
                onPress={() => updateStartDateSafe(addDays(todayNormalized, -2))}
              >
                <Text style={styles.quickChipText}>2 Gün Önce</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickChip}
                onPress={() => updateStartDateSafe(addDays(todayNormalized, -3))}
              >
                <Text style={styles.quickChipText}>3 Gün Önce</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* End Date / Duration Card */}
          <View style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#FF4D8D" />
              <Text style={styles.sectionTitle}>Adet Bitiş Tarihi</Text>
            </View>
            <Text style={styles.sectionHint}>
              Otomatik bırakırsan sistem ortalamana göre ({assumedPeriodLength} gün) işaretler;
              bittiği günü seçtiğinde tam süren kaydedilir.
            </Text>

            <View style={styles.modeToggleRow}>
              <TouchableOpacity
                style={[styles.modeBtn, !hasExplicitEnd && styles.modeBtnActive]}
                onPress={() => {
                  setHasExplicitEnd(false);
                  setShowEndPicker(false);
                }}
              >
                <Text style={[styles.modeBtnText, !hasExplicitEnd && styles.modeBtnTextActive]}>
                  Otomatik ({assumedPeriodLength} gün)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, hasExplicitEnd && styles.modeBtnActive]}
                onPress={() => {
                  setHasExplicitEnd(true);
                  if (endDate < startDate) {
                    setEndDate(addDays(startDate, Math.max(0, assumedPeriodLength - 1)));
                  }
                }}
              >
                <Text style={[styles.modeBtnText, hasExplicitEnd && styles.modeBtnTextActive]}>
                  Bitiş Günü Seç
                </Text>
              </TouchableOpacity>
            </View>

            {hasExplicitEnd && (
              <>
                <TouchableOpacity
                  style={styles.dateBox}
                  onPress={() => setShowEndPicker((prev) => !prev)}
                  activeOpacity={0.8}
                >
                  <View style={styles.dateBoxLeft}>
                    <Ionicons name="calendar" size={18} color="#FF4D8D" />
                    <Text style={styles.dateBoxText}>{formatLongTr(endDate)}</Text>
                  </View>
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationBadgeText}>{selectedDurationDays} gün</Text>
                  </View>
                </TouchableOpacity>

                {showEndPicker && (
                  <View style={styles.pickerWrapper}>
                    <DateTimePicker
                      value={endDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      locale="tr-TR"
                      minimumDate={startDate}
                      maximumDate={addDays(startDate, 14)}
                      onChange={(_, date) => {
                        if (Platform.OS !== 'ios') {
                          setShowEndPicker(false);
                        }
                        if (date) {
                          const normalized = normalizeDay(date);
                          setEndDate(normalized < startDate ? startDate : normalized);
                        }
                      }}
                    />
                  </View>
                )}
              </>
            )}

            <Text style={styles.quickDurationTitle}>Hızlı Süre Seçimi (Başlangıçtan itibaren)</Text>
            <View style={styles.durationRow}>
              {[2, 3, 4, 5, 6, 7, 8].map((days) => {
                const isSelected = hasExplicitEnd && selectedDurationDays === days;
                return (
                  <TouchableOpacity
                    key={days}
                    style={[styles.durationChip, isSelected && styles.durationChipActive]}
                    onPress={() => {
                      setHasExplicitEnd(true);
                      setEndDate(addDays(startDate, days - 1));
                      setShowEndPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.durationChipText,
                        isSelected && styles.durationChipTextActive,
                      ]}
                    >
                      {days} gün
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Live Range Summary */}
            <View style={styles.summaryBox}>
              <Ionicons name="information-circle-outline" size={16} color="#FF4D8D" />
              <Text style={styles.summaryText}>
                {hasExplicitEnd
                  ? `${formatShortTr(startDate)} – ${formatShortTr(endDate)} (${selectedDurationDays} gün) regl dönemi olarak işaretlenecek.`
                  : `${formatShortTr(startDate)} başlangıçlı dönem otomatik olarak ${assumedPeriodLength} gün (${formatShortTr(startDate)} – ${formatShortTr(addDays(startDate, assumedPeriodLength - 1))}) işaretlenecek.`}
              </Text>
            </View>
          </View>

          {/* Delete Single Cycle Button in Edit Mode */}
          {activeMode === 'edit' && selectedCycle?.id && (
            <TouchableOpacity
              style={styles.deleteCycleButton}
              onPress={handleDeleteCycle}
              disabled={isBusy}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
              <Text style={styles.deleteCycleText}>Sadece Bu Regl Kaydını Sil</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    grabberRow: {
      alignItems: 'center',
      paddingTop: 8,
      paddingBottom: 2,
      backgroundColor: theme.colors.backgroundCard,
    },
    grabber: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.border,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundCard,
      gap: 8,
    },
    cancelButton: {
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    cancelButtonText: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    title: {
      flex: 1,
      fontSize: 15.5,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
    },
    savePill: {
      backgroundColor: '#FF4D8D',
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 16,
      minWidth: 72,
      alignItems: 'center',
    },
    savePillText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    disabledBtn: {
      opacity: 0.6,
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      gap: 12,
      paddingBottom: 40,
    },
    card: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 10,
    },
    cardTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    newCycleLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    newCycleLinkText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FF4D8D',
    },
    cycleChipList: {
      gap: 8,
      paddingVertical: 2,
    },
    cycleChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 12,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cycleChipActive: {
      backgroundColor: 'rgba(255, 77, 141, 0.14)',
      borderColor: '#FF4D8D',
    },
    cycleChipText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    cycleChipTextActive: {
      color: '#FF4D8D',
      fontWeight: '700',
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
    },
    sectionHint: {
      fontSize: 12.5,
      color: theme.colors.textSecondary,
      lineHeight: 17,
    },
    dateBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    dateBoxLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    dateBoxText: {
      fontSize: 14.5,
      fontWeight: '700',
      color: theme.colors.text,
    },
    durationBadge: {
      backgroundColor: 'rgba(255, 77, 141, 0.14)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    durationBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FF4D8D',
    },
    pickerWrapper: {
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      overflow: 'hidden',
    },
    quickRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    stepBtn: {
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: 'rgba(255, 77, 141, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255, 77, 141, 0.3)',
    },
    stepBtnText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: '#FF4D8D',
    },
    stepBtnTextDisabled: {
      opacity: 0.4,
    },
    quickChip: {
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    quickChipText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: theme.colors.text,
    },
    modeToggleRow: {
      flexDirection: 'row',
      gap: 8,
    },
    modeBtn: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    modeBtnActive: {
      backgroundColor: 'rgba(255, 77, 141, 0.14)',
      borderColor: '#FF4D8D',
    },
    modeBtnText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    modeBtnTextActive: {
      color: '#FF4D8D',
      fontWeight: '700',
    },
    quickDurationTitle: {
      fontSize: 12.5,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    durationRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    durationChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    durationChipActive: {
      backgroundColor: '#FF4D8D',
      borderColor: '#FF4D8D',
    },
    durationChipText: {
      fontSize: 12.5,
      fontWeight: '600',
      color: theme.colors.text,
    },
    durationChipTextActive: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    summaryBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: 'rgba(255, 77, 141, 0.08)',
      borderRadius: 12,
      padding: 11,
      marginTop: 2,
    },
    summaryText: {
      flex: 1,
      fontSize: 12.5,
      color: theme.colors.text,
      lineHeight: 17,
    },
    deleteCycleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.3)',
      backgroundColor: theme.colors.backgroundCard,
    },
    deleteCycleText: {
      fontSize: 13.5,
      fontWeight: '600',
      color: theme.colors.error,
    },
  });
