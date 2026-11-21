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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { postpartumService } from '@/services/api';

function formatBabyAge(birthDateIso: string): string {
  const birth = new Date(birthDateIso);
  const now = new Date();
  const diffDays = Math.max(0, Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24)));
  if (diffDays < 30) return `${diffDays} günlük`;
  const months = Math.floor(diffDays / 30);
  const remDays = diffDays % 30;
  return remDays > 0 ? `${months} ay ${remDays} gün` : `${months} aylık`;
}

export default function PostpartumHubScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: overview, isLoading } = useQuery({
    queryKey: ['postpartumOverview'],
    queryFn: () => postpartumService.getOverview(),
  });

  const [editingBaby, setEditingBaby] = useState(false);
  const [babyName, setBabyName] = useState('');
  const [birthDate, setBirthDate] = useState(new Date().toISOString().slice(0, 10));
  const [gender, setGender] = useState<'GIRL' | 'BOY'>('GIRL');
  const [birthWeightGr, setBirthWeightGr] = useState('');
  const [birthHeightCm, setBirthHeightCm] = useState('');

  const saveBabyMutation = useMutation({
    mutationFn: () =>
      postpartumService.upsertBaby({
        name: babyName.trim(),
        birthDate,
        gender,
        birthWeightGr: birthWeightGr ? Number(birthWeightGr) : undefined,
        birthHeightCm: birthHeightCm ? Number(birthHeightCm) : undefined,
      }),
    onSuccess: () => {
      setEditingBaby(false);
      queryClient.invalidateQueries({ queryKey: ['postpartumOverview'] });
      queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });
      Alert.alert('Kaydedildi', 'Bebek profili ve aşı takvimi hazırlandı.');
    },
    onError: (err: any) => {
      Alert.alert('Hata', err?.message || 'Bebek profili kaydedilemedi.');
    },
  });

  const openSetupForm = () => {
    if (overview?.baby) {
      setBabyName(overview.baby.name);
      setBirthDate(new Date(overview.baby.birthDate).toISOString().slice(0, 10));
      setGender((overview.baby.gender as any) === 'BOY' ? 'BOY' : 'GIRL');
      setBirthWeightGr(overview.baby.birthWeightGr ? String(overview.baby.birthWeightGr) : '');
      setBirthHeightCm(overview.baby.birthHeightCm ? String(overview.baby.birthHeightCm) : '');
    }
    setEditingBaby(true);
  };

  const styles = createStyles(theme);
  const baby = overview?.baby;
  const summary = overview?.todaySummary;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Anne & Bebek Merkezi</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : !baby || editingBaby ? (
          <View style={styles.setupCard}>
            <View style={styles.setupIcon}>
              <Ionicons name="heart" size={26} color="#EC4899" />
            </View>
            <Text style={styles.setupTitle}>
              {baby ? 'Bebek Profilini Düzenle' : 'Bebeğini Tanıyalım'}
            </Text>
            <Text style={styles.setupSub}>
              Emzirme zamanlayıcısı, bez/uyku günlüğü ve T.C. aşı takvimini başlatmak için bebeğinin bilgilerini gir.
            </Text>

            <Text style={styles.label}>Bebek Adı</Text>
            <TextInput
              style={styles.input}
              value={babyName}
              onChangeText={setBabyName}
              placeholder="Örn. Defne veya Poyraz"
              placeholderTextColor={theme.colors.textLight}
            />

            <Text style={styles.label}>Doğum Tarihi (YYYY-AA-GG)</Text>
            <TextInput
              style={styles.input}
              value={birthDate}
              onChangeText={setBirthDate}
              placeholder="2026-11-01"
              placeholderTextColor={theme.colors.textLight}
            />

            <Text style={styles.label}>Cinsiyet</Text>
            <View style={styles.genderRow}>
              <TouchableOpacity
                style={[styles.genderChip, gender === 'GIRL' && styles.genderChipActive]}
                onPress={() => setGender('GIRL')}
              >
                <Text style={[styles.genderText, gender === 'GIRL' && styles.genderTextActive]}>
                  Kız
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genderChip, gender === 'BOY' && styles.genderChipActive]}
                onPress={() => setGender('BOY')}
              >
                <Text style={[styles.genderText, gender === 'BOY' && styles.genderTextActive]}>
                  Erkek
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Doğum Kilosu (gram)</Text>
                <TextInput
                  style={styles.input}
                  value={birthWeightGr}
                  onChangeText={setBirthWeightGr}
                  keyboardType="numeric"
                  placeholder="3250"
                  placeholderTextColor={theme.colors.textLight}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Doğum Boyu (cm)</Text>
                <TextInput
                  style={styles.input}
                  value={birthHeightCm}
                  onChangeText={setBirthHeightCm}
                  keyboardType="numeric"
                  placeholder="50"
                  placeholderTextColor={theme.colors.textLight}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => saveBabyMutation.mutate()}
              disabled={saveBabyMutation.isPending || !babyName.trim()}
            >
              {saveBabyMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Kaydet ve Başlat</Text>
              )}
            </TouchableOpacity>

            {baby && (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditingBaby(false)}
              >
                <Text style={styles.cancelBtnText}>Vazgeç</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            <LinearGradient
              colors={theme.isDark ? ['#4A1D4D', '#6D28D9'] : ['#FDF2F8', '#F3E8FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroTop}>
                <View>
                  <Text style={styles.heroBadge}>ANNE & BEBEK MODU</Text>
                  <Text style={styles.heroName}>{baby.name}</Text>
                  <Text style={styles.heroAge}>{formatBabyAge(baby.birthDate)}</Text>
                </View>
                <TouchableOpacity style={styles.editPill} onPress={openSetupForm}>
                  <Ionicons name="create-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.editPillText}>Düzenle</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{summary?.feedingsCount ?? 0}</Text>
                  <Text style={styles.statLabel}>Beslenme</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{summary?.diapersCount ?? 0}</Text>
                  <Text style={styles.statLabel}>Bez</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{summary?.sleepMinutes ?? 0} dk</Text>
                  <Text style={styles.statLabel}>Uyku</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={styles.menuList}>
              <TouchableOpacity
                style={styles.menuCard}
                onPress={() => router.push('/postpartum/feeding' as any)}
                activeOpacity={0.85}
              >
                <View style={[styles.menuIcon, { backgroundColor: 'rgba(236,72,153,0.14)' }]}>
                  <Ionicons name="time-outline" size={22} color="#EC4899" />
                </View>
                <View style={styles.menuBody}>
                  <Text style={styles.menuTitle}>Emzirme, Sağım & Mama</Text>
                  <Text style={styles.menuSub}>
                    Bugün {summary?.feedingMinutes ?? 0} dk emzirme · {summary?.formulaMl ?? 0} ml mama
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textLight} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuCard}
                onPress={() => router.push('/postpartum/diaper-sleep' as any)}
                activeOpacity={0.85}
              >
                <View style={[styles.menuIcon, { backgroundColor: 'rgba(14,165,233,0.14)' }]}>
                  <Ionicons name="moon-outline" size={22} color="#0EA5E9" />
                </View>
                <View style={styles.menuBody}>
                  <Text style={styles.menuTitle}>Bez & Uyku Takibi</Text>
                  <Text style={styles.menuSub}>
                    Tek dokunuşla ıslak/kirli bez ve bebek uyku kaydı
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textLight} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuCard}
                onPress={() => router.push('/postpartum/growth-vaccines' as any)}
                activeOpacity={0.85}
              >
                <View style={[styles.menuIcon, { backgroundColor: 'rgba(16,185,129,0.14)' }]}>
                  <Ionicons name="medkit-outline" size={22} color="#10B981" />
                </View>
                <View style={styles.menuBody}>
                  <Text style={styles.menuTitle}>Büyüme & Aşı Takvimi</Text>
                  <Text style={styles.menuSub}>
                    Boy, kilo takibi ve T.C. çocukluk aşı takvimi
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textLight} />
              </TouchableOpacity>
            </View>
          </>
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
    content: { padding: 20, gap: 16, paddingBottom: 40 },
    centerBox: { paddingVertical: 60, alignItems: 'center' },
    setupCard: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 22,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    setupIcon: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: 'rgba(236,72,153,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    setupTitle: { fontSize: 19, fontWeight: '800', color: theme.colors.text, marginBottom: 6 },
    setupSub: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary, marginBottom: 16 },
    label: { fontSize: 12.5, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 6, marginTop: 10 },
    input: {
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontSize: 14.5,
      color: theme.colors.text,
    },
    genderRow: { flexDirection: 'row', gap: 10 },
    genderChip: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: 12,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    genderChipActive: { borderColor: theme.colors.primary, backgroundColor: 'rgba(236,72,153,0.1)' },
    genderText: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary },
    genderTextActive: { color: theme.colors.primary, fontWeight: '800' },
    rowInputs: { flexDirection: 'row', gap: 10 },
    primaryBtn: {
      marginTop: 20,
      backgroundColor: theme.colors.primary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
    },
    primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
    cancelBtn: { marginTop: 10, paddingVertical: 10, alignItems: 'center' },
    cancelBtnText: { color: theme.colors.textSecondary, fontSize: 13.5, fontWeight: '600' },
    heroCard: {
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(236,72,153,0.3)' : '#FBCFE8',
    },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
    heroBadge: { fontSize: 10.5, fontWeight: '800', color: theme.colors.primary, letterSpacing: 0.7, marginBottom: 4 },
    heroName: { fontSize: 24, fontWeight: '800', color: theme.colors.text },
    heroAge: { fontSize: 13.5, fontWeight: '600', color: theme.colors.textSecondary, marginTop: 2 },
    editPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.colors.backgroundCard,
    },
    editPillText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
    statsRow: { flexDirection: 'row', gap: 10 },
    statBox: {
      flex: 1,
      backgroundColor: theme.isDark ? 'rgba(15,23,42,0.35)' : 'rgba(255,255,255,0.85)',
      borderRadius: 16,
      paddingVertical: 12,
      alignItems: 'center',
    },
    statValue: { fontSize: 17, fontWeight: '800', color: theme.colors.text },
    statLabel: { fontSize: 11.5, fontWeight: '600', color: theme.colors.textSecondary, marginTop: 2 },
    menuList: { gap: 12 },
    menuCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    menuIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    menuBody: { flex: 1 },
    menuTitle: { fontSize: 15.5, fontWeight: '800', color: theme.colors.text },
    menuSub: { fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 3 },
  });
