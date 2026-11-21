import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { cyclesService } from '@/services/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface DayDetailsSheetProps {
  visible: boolean;
  onClose: () => void;
  date: Date;
  dayData?: any;
  isPeriod?: boolean;
  isFertile?: boolean;
  isPredicted?: boolean;
  isOvulation?: boolean;
  isCycleEnd?: boolean;
  onLogPeriodStart?: () => void;
  onMarkPeriodEnd?: () => void;
  onEditPeriod?: () => void;
}

const commonSymptoms = [
  'Kramp',
  'Baş ağrısı',
  'Sırt ağrısı',
  'Şişkinlik',
  'Yorgunluk',
  'Meme hassasiyeti',
  'Akıntı',
];

const commonMoods: Array<{ label: string; emoji: string }> = [
  { label: 'Mutlu', emoji: '😊' },
  { label: 'Sakin', emoji: '😌' },
  { label: 'Enerjik', emoji: '⚡' },
  { label: 'Üzgün', emoji: '😔' },
  { label: 'Sinirli', emoji: '😠' },
  { label: 'Anksiyetli', emoji: '😰' },
  { label: 'Huzursuz', emoji: '😣' },
];

const contraceptionTypes = [
  'Kondom',
  'Doğum kontrol hapı',
  'Rahim içi araç',
  'Diğer',
];

export function DayDetailsSheet({
  visible,
  onClose,
  date,
  dayData,
  isPeriod,
  isFertile,
  isPredicted,
  isOvulation,
  isCycleEnd,
  onLogPeriodStart,
  onMarkPeriodEnd,
  onEditPeriod,
}: DayDetailsSheetProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const styles = createStyles(theme);

  const [flow, setFlow] = useState<'light' | 'moderate' | 'heavy' | undefined>();
  const [cramps, setCramps] = useState<number>(0);
  const [isPeriodSectionOpen, setIsPeriodSectionOpen] = useState<boolean>(false);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [mood, setMood] = useState<string[]>([]);
  const [hadSex, setHadSex] = useState(false);
  const [contraception, setContraception] = useState<string[]>([]);
  const [sexNotes, setSexNotes] = useState('');
  const [medications, setMedications] = useState<string[]>([]);
  const [healthNotes, setHealthNotes] = useState('');

  useEffect(() => {
    if (visible && dayData?.dailyLog) {
      const log = dayData.dailyLog;
      setFlow(log.flow);
      setCramps(log.cramps || 0);
      setIsPeriodSectionOpen(Boolean(isPeriod || log.flow || (log.cramps && log.cramps > 0)));
      setSymptoms(log.symptoms || []);
      setMood(log.mood || []);
      setHadSex(log.hadSex || false);
      setContraception(log.contraception || []);
      setSexNotes(log.sexNotes || '');
      setMedications(log.medications || []);
      setHealthNotes(log.healthNotes || '');
    } else if (visible) {
      setFlow(isPeriod ? 'moderate' : undefined);
      setCramps(0);
      setIsPeriodSectionOpen(Boolean(isPeriod));
      setSymptoms([]);
      setMood([]);
      setHadSex(false);
      setContraception([]);
      setSexNotes('');
      setMedications([]);
      setHealthNotes('');
    }
  }, [visible, dayData, isPeriod]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => cyclesService.upsertDailyLog(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });
      onClose();
    },
    onError: (error: any) => {
      Alert.alert('Hata', error.message || 'Kayıt güncellenemedi');
    },
  });

  const handleSave = () => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    const data = {
      date: dateString,
      flow,
      cramps: cramps > 0 ? cramps : undefined,
      symptoms,
      mood,
      hadSex,
      contraception,
      sexNotes: sexNotes.trim() || undefined,
      medications,
      healthNotes: healthNotes.trim() || undefined,
    };

    saveMutation.mutate(data);
  };

  const toggleArrayItem = (array: string[], item: string, setter: (arr: string[]) => void) => {
    if (array.includes(item)) {
      setter(array.filter((i) => i !== item));
    } else {
      setter([...array, item]);
    }
  };

  const formatDate = (d: Date): string => {
    return d.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      weekday: 'long',
    });
  };

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

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Vazgeç</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {formatDate(date)}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saveMutation.isPending}
            style={[
              styles.savePill,
              saveMutation.isPending && styles.saveButtonDisabled,
            ]}
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
          {/* Status Chips */}
          {(isPeriod || isFertile || isOvulation || isPredicted) && (
            <View style={styles.statusChips}>
              {isPeriod && (
                <View style={[styles.chip, { backgroundColor: 'rgba(255, 77, 141, 0.14)' }]}>
                  <Ionicons name="water" size={13} color="#FF4D8D" />
                  <Text style={[styles.chipText, { color: '#FF4D8D' }]}>Regl Günü</Text>
                </View>
              )}
              {isFertile && (
                <View style={[styles.chip, { backgroundColor: 'rgba(168, 85, 247, 0.14)' }]}>
                  <Ionicons name="flower-outline" size={13} color="#A855F7" />
                  <Text style={[styles.chipText, { color: '#A855F7' }]}>Verimli Gün</Text>
                </View>
              )}
              {isOvulation && (
                <View style={[styles.chip, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                  <Ionicons name="sparkles" size={13} color="#D97706" />
                  <Text style={[styles.chipText, { color: '#D97706' }]}>Yumurtlama</Text>
                </View>
              )}
              {isPredicted && (
                <View style={[styles.chip, { backgroundColor: 'rgba(255, 77, 141, 0.12)' }]}>
                  <Ionicons name="calendar-outline" size={13} color="#FF4D8D" />
                  <Text style={[styles.chipText, { color: '#FF4D8D' }]}>Tahmini Başlangıç</Text>
                </View>
              )}
            </View>
          )}

          {/* Quick Period Log Action */}
          {!isPeriod && onLogPeriodStart && (
            <TouchableOpacity
              style={styles.periodBanner}
              onPress={onLogPeriodStart}
              activeOpacity={0.85}
            >
              <View style={styles.periodBannerLeft}>
                <View style={styles.periodBannerIcon}>
                  <Ionicons name="water" size={18} color="#FF4D8D" />
                </View>
                <View>
                  <Text style={styles.periodBannerTitle}>Regl Başlat</Text>
                  <Text style={styles.periodBannerSub}>Başlangıç veya bitiş tarihini seçerek kaydet</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#FF4D8D" />
            </TouchableOpacity>
          )}

          {isPeriod && (onMarkPeriodEnd || onEditPeriod) && (
            <View style={styles.periodBanner}>
              <View style={styles.periodBannerLeft}>
                <View style={styles.periodBannerIcon}>
                  <Ionicons name="calendar-outline" size={18} color="#FF4D8D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.periodBannerTitle}>
                    {isCycleEnd ? 'Adet Bitiş Günü İşaretlendi' : 'Regl Dönemi Yönetimi'}
                  </Text>
                  <Text style={styles.periodBannerSub}>
                    {isCycleEnd
                      ? 'Başlangıç veya bitiş tarihini dilediğin gibi düzenleyebilirsin'
                      : 'Reglin bu günde bittiyse işaretleyebilir veya tarihleri düzenleyebilirsin'}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {!isCycleEnd && onMarkPeriodEnd && (
                      <TouchableOpacity
                        style={{
                          backgroundColor: '#FF4D8D',
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 10,
                        }}
                        onPress={onMarkPeriodEnd}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                          Adet Bitişi İşaretle
                        </Text>
                      </TouchableOpacity>
                    )}
                    {onEditPeriod && (
                      <TouchableOpacity
                        style={{
                          backgroundColor: 'rgba(255, 77, 141, 0.14)',
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 10,
                        }}
                        onPress={onEditPeriod}
                      >
                        <Text style={{ color: '#FF4D8D', fontSize: 12, fontWeight: '700' }}>
                          Tarihleri Düzenle
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Period Details Card (Collapsible) */}
          <View style={styles.card}>
            <TouchableOpacity
              style={[
                styles.switchRow,
                isPeriodSectionOpen && { marginBottom: 12 },
              ]}
              onPress={() => setIsPeriodSectionOpen((prev) => !prev)}
              activeOpacity={0.75}
            >
              <View style={styles.sectionHeaderInline}>
                <Ionicons name="water-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.sectionTitle}>Regl & Kramp</Text>
                {(flow || cramps > 0) && !isPeriodSectionOpen && (
                  <Text style={{ fontSize: 12, color: theme.colors.primary, fontWeight: '600' }}>
                    • Seçili
                  </Text>
                )}
              </View>
              <Ionicons
                name={isPeriodSectionOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>

            {isPeriodSectionOpen && (
              <>
                <Text style={styles.label}>Akış Yoğunluğu</Text>
                <View style={styles.flowButtons}>
                  {(['light', 'moderate', 'heavy'] as const).map((level) => {
                    const isActive = flow === level;
                    return (
                      <TouchableOpacity
                        key={level}
                        style={[styles.flowButton, isActive && styles.flowButtonActive]}
                        onPress={() => setFlow(isActive ? undefined : level)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.flowButtonText,
                            isActive && styles.flowButtonTextActive,
                          ]}
                        >
                          {level === 'light' ? 'Hafif' : level === 'moderate' ? 'Orta' : 'Yoğun'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>Kramp Şiddeti (0 – 5)</Text>
                <View style={styles.crampsSlider}>
                  {[0, 1, 2, 3, 4, 5].map((level) => {
                    const isActive = cramps === level;
                    return (
                      <TouchableOpacity
                        key={level}
                        style={[styles.crampsButton, isActive && styles.crampsButtonActive]}
                        onPress={() => setCramps(level)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.crampsButtonText,
                            isActive && styles.crampsButtonTextActive,
                          ]}
                        >
                          {level}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>

          {/* Symptoms Card */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="medkit-outline" size={18} color="#F59E0B" />
              <Text style={styles.sectionTitle}>Semptomlar</Text>
            </View>
            <View style={styles.chipGroup}>
              {commonSymptoms.map((symptom) => {
                const isActive = symptoms.includes(symptom);
                return (
                  <TouchableOpacity
                    key={symptom}
                    style={[
                      styles.selectableChip,
                      isActive && styles.selectableChipActive,
                    ]}
                    onPress={() => toggleArrayItem(symptoms, symptom, setSymptoms)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.selectableChipText,
                        isActive && styles.selectableChipTextActive,
                      ]}
                    >
                      {symptom}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Mood Card */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="happy-outline" size={18} color="#8B5CF6" />
              <Text style={styles.sectionTitle}>Ruh Hali & Enerji</Text>
            </View>
            <View style={styles.chipGroup}>
              {commonMoods.map((moodItem) => {
                const isActive = mood.includes(moodItem.label);
                return (
                  <TouchableOpacity
                    key={moodItem.label}
                    style={[
                      styles.selectableChip,
                      isActive && styles.selectableChipActive,
                    ]}
                    onPress={() => toggleArrayItem(mood, moodItem.label, setMood)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.selectableChipText,
                        isActive && styles.selectableChipTextActive,
                      ]}
                    >
                      {moodItem.emoji} {moodItem.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Sex & Protection Card */}
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.sectionHeaderInline}>
                <Ionicons name="heart-outline" size={18} color="#F43F5E" />
                <Text style={styles.sectionTitle}>Cinsel İlişki</Text>
              </View>
              <Switch
                value={hadSex}
                onValueChange={setHadSex}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor="#fff"
              />
            </View>

            {hadSex && (
              <>
                <Text style={styles.label}>Korunma Yöntemi</Text>
                <View style={styles.chipGroup}>
                  {contraceptionTypes.map((type) => {
                    const isActive = contraception.includes(type);
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.selectableChip,
                          isActive && styles.selectableChipActive,
                        ]}
                        onPress={() => toggleArrayItem(contraception, type, setContraception)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.selectableChipText,
                            isActive && styles.selectableChipTextActive,
                          ]}
                        >
                          {type}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>Notlar</Text>
                <TextInput
                  style={styles.textInput}
                  value={sexNotes}
                  onChangeText={setSexNotes}
                  placeholder="İsteğe bağlı notlar..."
                  placeholderTextColor={theme.colors.textLight}
                  multiline
                  numberOfLines={2}
                />
              </>
            )}
          </View>

          {/* Medications & Health Notes Card */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={18} color="#06B6D4" />
              <Text style={styles.sectionTitle}>İlaçlar & Notlar</Text>
            </View>

            <Text style={styles.label}>Aldığınız İlaçlar (virgülle ayırın)</Text>
            <TextInput
              style={styles.textInput}
              value={medications.join(', ')}
              onChangeText={(text) =>
                setMedications(
                  text
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                )
              }
              placeholder="Örn: Ağrı kesici, Vitamin D"
              placeholderTextColor={theme.colors.textLight}
            />

            <Text style={styles.label}>Sağlık Notları</Text>
            <TextInput
              style={[styles.textInput, styles.textInputMultiline]}
              value={healthNotes}
              onChangeText={setHealthNotes}
              placeholder="Genel sağlık durumu, bulgular vb."
              placeholderTextColor={theme.colors.textLight}
              multiline
              numberOfLines={3}
            />
          </View>
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
      paddingTop: 10,
      paddingBottom: 4,
      backgroundColor: theme.colors.backgroundCard,
    },
    grabber: {
      width: 38,
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
    title: {
      flex: 1,
      fontSize: 15.5,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
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
    savePill: {
      backgroundColor: theme.colors.primary,
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
    saveButtonDisabled: {
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
    statusChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 14,
    },
    chipText: {
      fontSize: 12.5,
      fontWeight: '700',
    },
    periodBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(255, 77, 141, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255, 77, 141, 0.3)',
      borderRadius: 16,
      padding: 14,
    },
    periodBannerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    periodBannerIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: 'rgba(255, 77, 141, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    periodBannerTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
    },
    periodBannerSub: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 1,
    },
    card: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    sectionHeaderInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionTitle: {
      fontSize: 15.5,
      fontWeight: '700',
      color: theme.colors.text,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginBottom: 8,
      marginTop: 6,
    },
    flowButtons: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
    },
    flowButton: {
      flex: 1,
      paddingVertical: 10,
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    flowButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    flowButtonText: {
      fontSize: 13.5,
      fontWeight: '600',
      color: theme.colors.text,
    },
    flowButtonTextActive: {
      color: '#FFFFFF',
    },
    crampsSlider: {
      flexDirection: 'row',
      gap: 6,
    },
    crampsButton: {
      flex: 1,
      paddingVertical: 10,
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    crampsButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    crampsButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
    },
    crampsButtonTextActive: {
      color: '#FFFFFF',
    },
    chipGroup: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    selectableChip: {
      paddingHorizontal: 13,
      paddingVertical: 8,
      backgroundColor: theme.colors.background,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    selectableChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    selectableChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.text,
    },
    selectableChipTextActive: {
      color: '#FFFFFF',
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    textInput: {
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 12,
      fontSize: 14,
      color: theme.colors.text,
      marginBottom: 8,
    },
    textInputMultiline: {
      minHeight: 76,
      textAlignVertical: 'top',
    },
  });
