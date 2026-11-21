import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { pregnancyService } from '@/services/api';
import { useTheme } from '@/hooks/useTheme';
import { router } from 'expo-router';
// import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { usePregnancyStore } from '@/store/pregnancyStore';

export default function PregnancySetupScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const setPregnancyMode = usePregnancyStore((state) => state.setPregnancyMode);

  const [lmpDate, setLmpDate] = useState<Date | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showLmpPicker, setShowLmpPicker] = useState(false);
  const [showDuePicker, setShowDuePicker] = useState(false);
  const [calculationMethod, setCalculationMethod] = useState<'lmp' | 'due'>('lmp');
  const [lmpDateConfirmed, setLmpDateConfirmed] = useState(false);
  const [dueDateConfirmed, setDueDateConfirmed] = useState(false);

  // Fetch existing pregnancy data if editing
  const { data: existingPregnancy } = useQuery<any>({
    queryKey: ['pregnancy'],
    queryFn: () => pregnancyService.get(),
  });

  // Pre-populate form with existing data when editing
  useEffect(() => {
    if (existingPregnancy) {
      if (existingPregnancy.lmpDate) {
        setLmpDate(new Date(existingPregnancy.lmpDate));
        setLmpDateConfirmed(true);
      }
      if (existingPregnancy.dueDate) {
        setDueDate(new Date(existingPregnancy.dueDate));
        setDueDateConfirmed(true);
      }
    }
  }, [existingPregnancy]);

  const createPregnancyMutation = useMutation({
    mutationFn: (data: any) => pregnancyService.createOrUpdate(data),
    onSuccess: async () => {
      await setPregnancyMode(true);
      queryClient.invalidateQueries({ queryKey: ['pregnancy'] });
      queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });
      Alert.alert(
        'Başarılı',
        'Hamilelik kaydınız oluşturuldu!',
        [
          {
            text: 'Tamam',
            onPress: () => router.replace('/pregnancy'),
          },
        ]
      );
    },
    onError: (error: any) => {
      Alert.alert('Hata', error.message || 'Hamilelik kaydı oluşturulamadı');
    },
  });

  const calculateDueDate = (lmp: Date): Date => {
    // Naegele's rule: LMP + 280 days
    const due = new Date(lmp);
    due.setDate(due.getDate() + 280);
    return due;
  };

  const calculateLmpDate = (due: Date): Date => {
    // Reverse calculation
    const lmp = new Date(due);
    lmp.setDate(lmp.getDate() - 280);
    return lmp;
  };

  const [tempLmpDate, setTempLmpDate] = useState<Date | null>(null);
  const [tempDueDate, setTempDueDate] = useState<Date | null>(null);

  const handleLmpDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowLmpPicker(false);
      if (event?.type === 'dismissed' || !selectedDate) return;
      setTempLmpDate(selectedDate);
      setLmpDate(selectedDate);
      setDueDate(calculateDueDate(selectedDate));
      setLmpDateConfirmed(true);
      return;
    }
    if (selectedDate) {
      setTempLmpDate(selectedDate);
    }
  };

  const handleDueDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDuePicker(false);
      if (event?.type === 'dismissed' || !selectedDate) return;
      setTempDueDate(selectedDate);
      setDueDate(selectedDate);
      setLmpDate(calculateLmpDate(selectedDate));
      setDueDateConfirmed(true);
      return;
    }
    if (selectedDate) {
      setTempDueDate(selectedDate);
    }
  };

  const confirmLmpDate = () => {
    if (tempLmpDate) {
      setLmpDate(tempLmpDate);
      setDueDate(calculateDueDate(tempLmpDate));
      setLmpDateConfirmed(true);
      setShowLmpPicker(false);
    }
  };

  const confirmDueDate = () => {
    if (tempDueDate) {
      setDueDate(tempDueDate);
      setLmpDate(calculateLmpDate(tempDueDate));
      setDueDateConfirmed(true);
      setShowDuePicker(false);
    }
  };

  const editLmpDate = () => {
    setLmpDateConfirmed(false);
    setTempLmpDate(lmpDate);
    setShowLmpPicker(true);
  };

  const editDueDate = () => {
    setDueDateConfirmed(false);
    setTempDueDate(dueDate);
    setShowDuePicker(true);
  };

  const handleSubmit = () => {
    if (!lmpDate && !dueDate) {
      Alert.alert('Uyarı', 'Lütfen son adet tarihinizi veya tahmini doğum tarihini giriniz');
      return;
    }

    const data: any = {};
    if (lmpDate) {
      data.lmpDate = lmpDate.toISOString();
    }
    if (dueDate) {
      data.dueDate = dueDate.toISOString();
    }

    createPregnancyMutation.mutate(data);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      padding: theme.spacing.lg,
    },
    header: {
      alignItems: 'center',
      marginBottom: theme.spacing.xl,
    },
    icon: {
      marginBottom: theme.spacing.md,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    section: {
      marginBottom: theme.spacing.xl,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    methodSelector: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
    },
    methodButton: {
      flex: 1,
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: theme.card.borderRadius,
      padding: theme.spacing.md,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    methodButtonActive: {
      backgroundColor: theme.colors.overlay,
      borderColor: theme.colors.primary,
    },
    methodButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    methodButtonTextActive: {
      color: theme.colors.primary,
    },
    dateCard: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: theme.card.borderRadius,
      padding: theme.card.padding,
      marginBottom: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    dateLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
    },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.background,
      borderRadius: theme.button.borderRadius,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    dateButtonText: {
      fontSize: 16,
      color: theme.colors.text,
    },
    datePlaceholder: {
      color: theme.colors.textSecondary,
    },
    infoCard: {
      backgroundColor: theme.colors.overlay,
      borderRadius: theme.card.borderRadius,
      padding: theme.spacing.md,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    infoText: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.text,
      lineHeight: 20,
    },
    calculatedSection: {
      marginBottom: theme.spacing.lg,
    },
    calculatedCard: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: theme.card.borderRadius,
      padding: theme.card.padding,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    calculatedRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    calculatedLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    calculatedValue: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    submitButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.button.borderRadius,
      padding: theme.button.padding,
      alignItems: 'center',
      marginTop: theme.spacing.lg,
      shadowColor: theme.button.shadowColor,
      shadowOffset: theme.button.shadowOffset,
      shadowOpacity: theme.button.shadowOpacity,
      shadowRadius: theme.button.shadowRadius,
      elevation: theme.button.elevation,
    },
    submitButtonDisabled: {
      backgroundColor: theme.colors.backgroundCard,
      opacity: 0.5,
    },
    submitButtonText: {
      color: theme.colors.textOnPrimary,
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: 1,
    },
    cancelButton: {
      backgroundColor: 'transparent',
      borderRadius: theme.button.borderRadius,
      padding: theme.spacing.md,
      alignItems: 'center',
      marginTop: theme.spacing.sm,
    },
    cancelButtonText: {
      color: theme.colors.textSecondary,
      fontSize: 16,
      fontWeight: '600',
    },
    saveButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.button.borderRadius,
      padding: theme.spacing.md,
      alignItems: 'center',
      marginTop: theme.spacing.md,
      shadowColor: theme.button.shadowColor,
      shadowOffset: theme.button.shadowOffset,
      shadowOpacity: theme.button.shadowOpacity,
      shadowRadius: theme.button.shadowRadius,
      elevation: theme.button.elevation,
    },
    saveButtonText: {
      color: theme.colors.textOnPrimary,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    confirmedDateContainer: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.card.borderRadius,
      padding: theme.spacing.md,
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    confirmedDateContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.sm,
    },
    confirmedDateText: {
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: '600',
      flex: 1,
    },
    confirmedDateIcon: {
      fontSize: 24,
      color: theme.colors.primary,
      marginLeft: theme.spacing.sm,
    },
    editButton: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: theme.colors.primary,
      borderRadius: theme.button.borderRadius,
      padding: theme.spacing.sm,
      alignItems: 'center',
    },
    editButtonText: {
      color: theme.colors.primary,
      fontSize: 15,
      fontWeight: '600',
    },
  });

  const canSubmit = lmpDate !== null || dueDate !== null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.icon, { fontSize: 64 }]}>
            💝
          </Text>
          <Text style={styles.title}>Hamilelik Takibine Başlayın</Text>
          <Text style={styles.subtitle}>
            Hamilelik yolculuğunuzu takip etmek için birkaç bilgiye ihtiyacımız var
          </Text>
        </View>

        {/* Method Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hesaplama Yöntemi</Text>
          <View style={styles.methodSelector}>
            <TouchableOpacity
              style={[
                styles.methodButton,
                calculationMethod === 'lmp' && styles.methodButtonActive,
              ]}
              onPress={() => setCalculationMethod('lmp')}
            >
              <Text
                style={[
                  styles.methodButtonText,
                  calculationMethod === 'lmp' && styles.methodButtonTextActive,
                ]}
              >
                Son Adet Tarihi
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.methodButton,
                calculationMethod === 'due' && styles.methodButtonActive,
              ]}
              onPress={() => setCalculationMethod('due')}
            >
              <Text
                style={[
                  styles.methodButtonText,
                  calculationMethod === 'due' && styles.methodButtonTextActive,
                ]}
              >
                Tahmini Doğum Tarihi
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date Input */}
        <View style={styles.section}>
          {calculationMethod === 'lmp' ? (
            <View style={styles.dateCard}>
              <Text style={styles.dateLabel}>Son Adet Tarihi (LMP)</Text>

              {!lmpDateConfirmed ? (
                <>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => {
                      setShowLmpPicker(true);
                      setTempLmpDate(lmpDate || new Date());
                    }}
                  >
                    <Text
                      style={[
                        styles.dateButtonText,
                        !tempLmpDate && !lmpDate && styles.datePlaceholder,
                      ]}
                    >
                      {(tempLmpDate || lmpDate)
                        ? (tempLmpDate || lmpDate)!.toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })
                        : 'Tarih seçiniz'}
                    </Text>
                    <Text style={{ fontSize: 20 }}>📅</Text>
                  </TouchableOpacity>

                  {showLmpPicker && (
                    <>
                      <DateTimePicker
                        value={tempLmpDate || lmpDate || new Date()}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleLmpDateChange}
                        maximumDate={new Date()}
                      />
                      {tempLmpDate && (
                        <TouchableOpacity
                          style={styles.saveButton}
                          onPress={confirmLmpDate}
                        >
                          <Text style={styles.saveButtonText}>Kaydet</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </>
              ) : (
                <View style={styles.confirmedDateContainer}>
                  <View style={styles.confirmedDateContent}>
                    <Text style={styles.confirmedDateText}>
                      {lmpDate?.toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </Text>
                    <Text style={styles.confirmedDateIcon}>✓</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={editLmpDate}
                  >
                    <Text style={styles.editButtonText}>Düzenle</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.dateCard}>
              <Text style={styles.dateLabel}>Tahmini Doğum Tarihi</Text>

              {!dueDateConfirmed ? (
                <>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => {
                      setShowDuePicker(true);
                      setTempDueDate(dueDate || new Date());
                    }}
                  >
                    <Text
                      style={[
                        styles.dateButtonText,
                        !tempDueDate && !dueDate && styles.datePlaceholder,
                      ]}
                    >
                      {(tempDueDate || dueDate)
                        ? (tempDueDate || dueDate)!.toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })
                        : 'Tarih seçiniz'}
                    </Text>
                    <Text style={{ fontSize: 20 }}>📅</Text>
                  </TouchableOpacity>

                  {showDuePicker && (
                    <>
                      <DateTimePicker
                        value={tempDueDate || dueDate || new Date()}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleDueDateChange}
                        minimumDate={new Date()}
                      />
                      {tempDueDate && (
                        <TouchableOpacity
                          style={styles.saveButton}
                          onPress={confirmDueDate}
                        >
                          <Text style={styles.saveButtonText}>Kaydet</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </>
              ) : (
                <View style={styles.confirmedDateContainer}>
                  <View style={styles.confirmedDateContent}>
                    <Text style={styles.confirmedDateText}>
                      {dueDate?.toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </Text>
                    <Text style={styles.confirmedDateIcon}>✓</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={editDueDate}
                  >
                    <Text style={styles.editButtonText}>Düzenle</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Calculated Values */}
        {(lmpDate || dueDate) && (
          <View style={styles.calculatedSection}>
            <Text style={styles.sectionTitle}>Hesaplanan Tarihler</Text>
            <View style={styles.calculatedCard}>
              {lmpDate && (
                <View style={styles.calculatedRow}>
                  <Text style={styles.calculatedLabel}>Son Adet Tarihi</Text>
                  <Text style={styles.calculatedValue}>
                    {lmpDate.toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              )}
              {dueDate && (
                <View style={[styles.calculatedRow, { marginBottom: 0 }]}>
                  <Text style={styles.calculatedLabel}>Tahmini Doğum Tarihi</Text>
                  <Text style={styles.calculatedValue}>
                    {dueDate.toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={{ fontSize: 24 }}>ℹ️</Text>
          <Text style={styles.infoText}>
            Bu bilgiler gebelik yaşınızı ve tahmini doğum tarihinizi hesaplamak için
            kullanılacaktır. Daha sonra ayarlardan değiştirebilirsiniz.
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!canSubmit || createPregnancyMutation.isPending) &&
              styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit || createPregnancyMutation.isPending}
        >
          <Text style={styles.submitButtonText}>
            {createPregnancyMutation.isPending ? 'Kaydediliyor...' : 'Devam Et'}
          </Text>
        </TouchableOpacity>

        {/* Cancel Button */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
        >
          <Text style={styles.cancelButtonText}>İptal</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
