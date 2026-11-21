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

export default function GrowthVaccinesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [headCm, setHeadCm] = useState('');

  const { data: overview, isLoading } = useQuery({
    queryKey: ['postpartumOverview'],
    queryFn: () => postpartumService.getOverview(),
  });

  const growthMutation = useMutation({
    mutationFn: () =>
      postpartumService.logGrowth({
        weightKg: weightKg ? Number(weightKg.replace(',', '.')) : undefined,
        heightCm: heightCm ? Number(heightCm.replace(',', '.')) : undefined,
        headCm: headCm ? Number(headCm.replace(',', '.')) : undefined,
      }),
    onSuccess: () => {
      setWeightKg('');
      setHeightCm('');
      setHeadCm('');
      queryClient.invalidateQueries({ queryKey: ['postpartumOverview'] });
      Alert.alert('Kaydedildi', 'Büyüme ölçümü kaydedildi.');
    },
    onError: (err: any) => Alert.alert('Hata', err?.message || 'Ölçüm kaydedilemedi.'),
  });

  const vaccineMutation = useMutation({
    mutationFn: ({ id, administered }: { id: string; administered: boolean }) =>
      postpartumService.toggleVaccine(id, { administered }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['postpartumOverview'] }),
  });

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Büyüme & Aşı Takvimi</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Yeni Büyüme Ölçümü</Text>
          <View style={styles.inputsRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Kilo (kg)</Text>
              <TextInput
                style={styles.input}
                value={weightKg}
                onChangeText={setWeightKg}
                keyboardType="decimal-pad"
                placeholder="4.2"
                placeholderTextColor={theme.colors.textLight}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Boy (cm)</Text>
              <TextInput
                style={styles.input}
                value={heightCm}
                onChangeText={setHeightCm}
                keyboardType="decimal-pad"
                placeholder="54"
                placeholderTextColor={theme.colors.textLight}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Baş (cm)</Text>
              <TextInput
                style={styles.input}
                value={headCm}
                onChangeText={setHeadCm}
                keyboardType="decimal-pad"
                placeholder="36.5"
                placeholderTextColor={theme.colors.textLight}
              />
            </View>
          </View>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => growthMutation.mutate()}
            disabled={growthMutation.isPending}
          >
            {growthMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Ölçümü Kaydet</Text>
            )}
          </TouchableOpacity>
        </View>

        {(overview?.growthLogs || []).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Ölçüm Geçmişi</Text>
            {overview?.growthLogs.slice(0, 6).map((g) => (
              <View key={g.id} style={styles.growthRow}>
                <Text style={styles.growthDate}>
                  {new Date(g.measuredAt).toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
                <Text style={styles.growthVals}>
                  {[
                    g.weightKg != null ? `${g.weightKg} kg` : null,
                    g.heightCm != null ? `${g.heightCm} cm` : null,
                    g.headCm != null ? `Baş ${g.headCm} cm` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>T.C. Sağlık Bakanlığı Aşı Takvimi</Text>
        {isLoading ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          overview?.vaccines.map((v) => {
            const done = Boolean(v.administeredAt);
            return (
              <TouchableOpacity
                key={v.id}
                style={[styles.vaccineRow, done && styles.vaccineRowDone]}
                onPress={() => vaccineMutation.mutate({ id: v.id, administered: !done })}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={done ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={done ? '#10B981' : theme.colors.textSecondary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.vaccineTitle, done && styles.vaccineTitleDone]}>
                    {v.title}
                  </Text>
                  <Text style={styles.vaccineSub}>
                    {v.dueMonth === 0 ? 'Doğumda' : `${v.dueMonth}. Ay`}
                    {done && v.administeredAt
                      ? ` · Yapıldı (${new Date(v.administeredAt).toLocaleDateString('tr-TR')})`
                      : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
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
    content: { padding: 20, gap: 12, paddingBottom: 40 },
    card: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cardTitle: { fontSize: 15.5, fontWeight: '800', color: theme.colors.text, marginBottom: 12 },
    inputsRow: { flexDirection: 'row', gap: 8 },
    label: { fontSize: 11.5, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 4 },
    input: {
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 11,
      paddingHorizontal: 10,
      paddingVertical: 9,
      fontSize: 14,
      color: theme.colors.text,
    },
    saveBtn: {
      marginTop: 14,
      backgroundColor: '#10B981',
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    saveBtnText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '800' },
    sectionTitle: { fontSize: 15.5, fontWeight: '800', color: theme.colors.text, marginTop: 6 },
    growthRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    growthDate: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
    growthVals: { fontSize: 13.5, fontWeight: '700', color: theme.colors.text },
    vaccineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    vaccineRowDone: { opacity: 0.85 },
    vaccineTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
    vaccineTitleDone: { textDecorationLine: 'line-through', color: theme.colors.textSecondary },
    vaccineSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  });
