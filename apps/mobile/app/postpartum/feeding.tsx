import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { postpartumService } from '@/services/api';

type FeedingType = 'BREAST_LEFT' | 'BREAST_RIGHT' | 'PUMP' | 'FORMULA';

const TYPE_LABELS: Record<FeedingType, string> = {
  BREAST_LEFT: 'Sol Göğüs',
  BREAST_RIGHT: 'Sağ Göğüs',
  PUMP: 'Sağım',
  FORMULA: 'Mama / Biberon',
};

export default function FeedingTrackerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeType, setActiveType] = useState<FeedingType>('BREAST_LEFT');
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [amountMl, setAmountMl] = useState('');

  const { data: overview, isLoading } = useQuery({
    queryKey: ['postpartumOverview'],
    queryFn: () => postpartumService.getOverview(),
  });

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  const logMutation = useMutation({
    mutationFn: (payload: {
      type: FeedingType;
      durationSec?: number;
      amountMl?: number;
    }) => postpartumService.logFeeding(payload),
    onSuccess: () => {
      setRunning(false);
      setSeconds(0);
      setAmountMl('');
      queryClient.invalidateQueries({ queryKey: ['postpartumOverview'] });
      Alert.alert('Kaydedildi', 'Beslenme kaydı eklendi.');
    },
    onError: (err: any) => {
      Alert.alert('Hata', err?.message || 'Kayıt eklenemedi.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => postpartumService.deleteFeeding(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postpartumOverview'] });
    },
  });

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleSave = () => {
    const ml = amountMl ? Number(amountMl) : undefined;
    if ((activeType === 'PUMP' || activeType === 'FORMULA') && !ml && seconds === 0) {
      Alert.alert('Bilgi', 'Lütfen miktar (ml) veya süre giriniz.');
      return;
    }
    logMutation.mutate({
      type: activeType,
      durationSec: seconds > 0 ? seconds : undefined,
      amountMl: ml,
    });
  };

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emzirme & Mama</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.typeGrid}>
            {(['BREAST_LEFT', 'BREAST_RIGHT', 'PUMP', 'FORMULA'] as FeedingType[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeChip, activeType === t && styles.typeChipActive]}
                onPress={() => setActiveType(t)}
              >
                <Text style={[styles.typeText, activeType === t && styles.typeTextActive]}>
                  {TYPE_LABELS[t]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.timerBox}>
            <Text style={styles.timerText}>{formatTimer(seconds)}</Text>
            <View style={styles.timerBtns}>
              <TouchableOpacity
                style={[styles.timerBtn, running && styles.timerBtnPause]}
                onPress={() => setRunning((r) => !r)}
              >
                <Ionicons name={running ? 'pause' : 'play'} size={18} color="#FFFFFF" />
                <Text style={styles.timerBtnText}>
                  {running ? 'Duraklat' : seconds > 0 ? 'Devam Et' : 'Başlat'}
                </Text>
              </TouchableOpacity>
              {seconds > 0 && (
                <TouchableOpacity
                  style={styles.resetBtn}
                  onPress={() => {
                    setRunning(false);
                    setSeconds(0);
                  }}
                >
                  <Text style={styles.resetBtnText}>Sıfırla</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {(activeType === 'PUMP' || activeType === 'FORMULA') && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.label}>Miktar (ml)</Text>
              <TextInput
                style={styles.input}
                value={amountMl}
                onChangeText={setAmountMl}
                keyboardType="numeric"
                placeholder="Örn. 90"
                placeholderTextColor={theme.colors.textLight}
              />
            </View>
          )}

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={logMutation.isPending}
          >
            {logMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Kaydı Tamamla</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Son Kayıtlar</Text>
        {isLoading ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (overview?.feedings || []).length === 0 ? (
          <Text style={styles.emptyText}>Henüz beslenme kaydı yok.</Text>
        ) : (
          overview?.feedings.map((item) => (
            <View key={item.id} style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyTitle}>
                  {TYPE_LABELS[item.type as FeedingType] || item.type}
                </Text>
                <Text style={styles.historySub}>
                  {new Date(item.startedAt).toLocaleString('tr-TR', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {item.durationSec ? ` · ${Math.max(1, Math.round(item.durationSec / 60))} dk` : ''}
                  {item.amountMl ? ` · ${item.amountMl} ml` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => deleteMutation.mutate(item.id)}>
                <Ionicons name="trash-outline" size={18} color={theme.colors.textLight} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text },
    content: { padding: 20, gap: 14, paddingBottom: 40 },
    card: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
    typeChip: {
      width: '48.5%',
      paddingVertical: 11,
      borderRadius: 12,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    typeChipActive: { borderColor: theme.colors.primary, backgroundColor: 'rgba(236,72,153,0.1)' },
    typeText: { fontSize: 13.5, fontWeight: '700', color: theme.colors.textSecondary },
    typeTextActive: { color: theme.colors.primary },
    timerBox: { alignItems: 'center', paddingVertical: 12 },
    timerText: { fontSize: 44, fontWeight: '800', color: theme.colors.text, letterSpacing: 1 },
    timerBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
    timerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#EC4899',
      paddingHorizontal: 22,
      paddingVertical: 11,
      borderRadius: 999,
    },
    timerBtnPause: { backgroundColor: '#F59E0B' },
    timerBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
    resetBtn: {
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 999,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    resetBtnText: { color: theme.colors.textSecondary, fontSize: 13.5, fontWeight: '700' },
    label: { fontSize: 12.5, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 6 },
    input: {
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14.5,
      color: theme.colors.text,
    },
    saveBtn: {
      marginTop: 18,
      backgroundColor: theme.colors.primary,
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: 'center',
    },
    saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.text, marginTop: 6 },
    emptyText: { fontSize: 13, color: theme.colors.textSecondary },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    historyTitle: { fontSize: 14.5, fontWeight: '700', color: theme.colors.text },
    historySub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  });
