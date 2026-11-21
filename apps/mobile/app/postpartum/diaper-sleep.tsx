import { useState } from 'react';
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

const DIAPER_LABELS: Record<string, string> = {
  WET: 'Islak',
  DIRTY: 'Kirli',
  BOTH: 'İkisi Birden',
};

export default function DiaperSleepScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sleepMinutes, setSleepMinutes] = useState('45');

  const { data: overview, isLoading } = useQuery({
    queryKey: ['postpartumOverview'],
    queryFn: () => postpartumService.getOverview(),
  });

  const diaperMutation = useMutation({
    mutationFn: (type: 'WET' | 'DIRTY' | 'BOTH') => postpartumService.logDiaper({ type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postpartumOverview'] });
      Alert.alert('Kaydedildi', 'Bez değişimi kaydedildi.');
    },
    onError: (err: any) => Alert.alert('Hata', err?.message || 'Bez kaydedilemedi.'),
  });

  const sleepMutation = useMutation({
    mutationFn: (durationMin: number) => postpartumService.logSleep({ durationMin }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postpartumOverview'] });
      Alert.alert('Kaydedildi', 'Bebek uykusu kaydedildi.');
    },
    onError: (err: any) => Alert.alert('Hata', err?.message || 'Uyku kaydedilemedi.'),
  });

  const deleteDiaperMutation = useMutation({
    mutationFn: (id: string) => postpartumService.deleteDiaper(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['postpartumOverview'] }),
  });

  const deleteSleepMutation = useMutation({
    mutationFn: (id: string) => postpartumService.deleteSleep(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['postpartumOverview'] }),
  });

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bez & Uyku Takibi</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hızlı Bez Kaydı</Text>
          <View style={styles.btnRow}>
            {(['WET', 'DIRTY', 'BOTH'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={styles.diaperBtn}
                onPress={() => diaperMutation.mutate(t)}
                disabled={diaperMutation.isPending}
              >
                <Ionicons name="water-outline" size={18} color="#0EA5E9" />
                <Text style={styles.diaperBtnText}>{DIAPER_LABELS[t]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bebek Uykusu Ekle (dk)</Text>
          <View style={styles.sleepRow}>
            <TextInput
              style={styles.input}
              value={sleepMinutes}
              onChangeText={setSleepMinutes}
              keyboardType="numeric"
              placeholder="45"
              placeholderTextColor={theme.colors.textLight}
            />
            <TouchableOpacity
              style={styles.sleepBtn}
              onPress={() => {
                const mins = Number(sleepMinutes);
                if (!mins || mins < 1) {
                  Alert.alert('Bilgi', 'Geçerli bir dakika giriniz.');
                  return;
                }
                sleepMutation.mutate(mins);
              }}
              disabled={sleepMutation.isPending}
            >
              {sleepMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.sleepBtnText}>Uyku Ekle</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Son Bez Kayıtları</Text>
        {isLoading ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (overview?.diapers || []).length === 0 ? (
          <Text style={styles.emptyText}>Henüz bez kaydı yok.</Text>
        ) : (
          overview?.diapers.slice(0, 10).map((d) => (
            <View key={d.id} style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyTitle}>{DIAPER_LABELS[d.type] || d.type}</Text>
                <Text style={styles.historySub}>
                  {new Date(d.loggedAt).toLocaleString('tr-TR', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <TouchableOpacity onPress={() => deleteDiaperMutation.mutate(d.id)}>
                <Ionicons name="trash-outline" size={18} color={theme.colors.textLight} />
              </TouchableOpacity>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Son Uyku Kayıtları</Text>
        {(overview?.sleeps || []).length === 0 ? (
          <Text style={styles.emptyText}>Henüz uyku kaydı yok.</Text>
        ) : (
          overview?.sleeps.slice(0, 10).map((s) => (
            <View key={s.id} style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyTitle}>{s.durationMin} dakika uyku</Text>
                <Text style={styles.historySub}>
                  {new Date(s.endedAt).toLocaleString('tr-TR', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <TouchableOpacity onPress={() => deleteSleepMutation.mutate(s.id)}>
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
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cardTitle: { fontSize: 15.5, fontWeight: '800', color: theme.colors.text, marginBottom: 12 },
    btnRow: { flexDirection: 'row', gap: 8 },
    diaperBtn: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    diaperBtnText: { fontSize: 12.5, fontWeight: '700', color: theme.colors.text },
    sleepRow: { flexDirection: 'row', gap: 10 },
    input: {
      flex: 1,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.colors.text,
    },
    sleepBtn: {
      backgroundColor: '#6366F1',
      paddingHorizontal: 18,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sleepBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
    sectionTitle: { fontSize: 15.5, fontWeight: '800', color: theme.colors.text, marginTop: 4 },
    emptyText: { fontSize: 13, color: theme.colors.textSecondary },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 14,
      padding: 13,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    historyTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
    historySub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  });
