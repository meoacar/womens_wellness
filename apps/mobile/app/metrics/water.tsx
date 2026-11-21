import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { metricsService } from '@/services/api';
import { useTheme } from '@/hooks/useTheme';
import { parseLocaleNumber, validateWeightKg } from '@/utils/numberInput';

export default function WaterCalculatorScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [weight, setWeight] = useState('');
  const [activity, setActivity] = useState('moderate');
  const [climate, setClimate] = useState('temperate');
  const [result, setResult] = useState<any>(null);

  const calculateWaterMutation = useMutation({
    mutationFn: (data: { weightKg: number; activity?: string; climate?: string }) =>
      metricsService.calculateWater(data),
    onSuccess: (data: any) => {
      // If backend returns null, calculate on frontend as fallback
      let dailyWaterMl = data?.dailyWaterMl || data?.dailyNeedMl;

      if (!dailyWaterMl) {
        const w = parseLocaleNumber(weight);
        const base = w * 33;
        const activityMultiplier = activity === 'sedentary' ? 1.0 : activity === 'active' ? 1.3 : 1.15;
        const climateBonus = climate === 'cool' ? 0 : climate === 'hot' ? 500 : 250;
        dailyWaterMl = Math.round(base * activityMultiplier + climateBonus);
      }

      setResult({ dailyWaterMl });
    },
    onError: (error: any) => {
      Alert.alert('Hata', error.message || 'Su ihtiyacı hesaplanırken bir hata oluştu');
    },
  });

  const handleCalculate = () => {
    const weightCheck = validateWeightKg(weight);
    if (weightCheck.error || !weightCheck.value) {
      Alert.alert('Hata', weightCheck.error || 'Lütfen geçerli bir kilo değeri girin');
      return;
    }

    calculateWaterMutation.mutate({ weightKg: weightCheck.value, activity, climate });
  };

  const activityLevels = [
    { value: 'sedentary', label: 'Düşük', desc: 'Hareketsiz yaşam' },
    { value: 'moderate', label: 'Orta', desc: 'Normal aktivite' },
    { value: 'active', label: 'Yüksek', desc: 'Aktif yaşam' },
  ];

  const climateLevels = [
    { value: 'cool', label: 'Soğuk', desc: 'Serin iklim' },
    { value: 'temperate', label: 'Ilıman', desc: 'Normal iklim' },
    { value: 'hot', label: 'Sıcak', desc: 'Sıcak iklim' },
  ];

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Su İhtiyacı</Text>
            <Text style={styles.subtitle}>Günlük su tüketimi</Text>
          </View>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Kilo (kg)</Text>
            <TextInput
              style={styles.input}
              placeholder="örn: 65"
              placeholderTextColor={theme.colors.textLight}
              keyboardType="numeric"
              value={weight}
              onChangeText={setWeight}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Aktivite Seviyesi</Text>
            {activityLevels.map((level) => (
              <TouchableOpacity
                key={level.value}
                style={[
                  styles.option,
                  activity === level.value && styles.optionActive,
                ]}
                onPress={() => setActivity(level.value)}
              >
                <View style={styles.optionContent}>
                  <Text
                    style={[
                      styles.optionLabel,
                      activity === level.value && styles.optionLabelActive,
                    ]}
                  >
                    {level.label}
                  </Text>
                  <Text style={styles.optionDesc}>{level.desc}</Text>
                </View>
                <View style={[styles.radio, activity === level.value && styles.radioActive]}>
                  {activity === level.value && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>İklim</Text>
            {climateLevels.map((level) => (
              <TouchableOpacity
                key={level.value}
                style={[
                  styles.option,
                  climate === level.value && styles.optionActive,
                ]}
                onPress={() => setClimate(level.value)}
              >
                <View style={styles.optionContent}>
                  <Text
                    style={[
                      styles.optionLabel,
                      climate === level.value && styles.optionLabelActive,
                    ]}
                  >
                    {level.label}
                  </Text>
                  <Text style={styles.optionDesc}>{level.desc}</Text>
                </View>
                <View style={[styles.radio, climate === level.value && styles.radioActive]}>
                  {climate === level.value && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.calculateButton}
            onPress={handleCalculate}
            disabled={calculateWaterMutation.isPending}
          >
            <Text style={styles.calculateButtonText}>
              {calculateWaterMutation.isPending ? 'Hesaplanıyor...' : 'Hesapla'}
            </Text>
          </TouchableOpacity>
        </View>

        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Günlük Su İhtiyacınız</Text>

            <View style={styles.mainResult}>
              <Text style={styles.waterIcon}>💧</Text>
              <Text style={styles.waterValue}>{result.dailyWaterMl || 2000}</Text>
              <Text style={styles.waterUnit}>ml/gün</Text>
            </View>

            <View style={styles.equivalentsCard}>
              <Text style={styles.equivalentsTitle}>Eşdeğerleri</Text>
              <View style={styles.equivalentRow}>
                <Text style={styles.equivalentIcon}>🥤</Text>
                <Text style={styles.equivalentLabel}>Bardak (200ml)</Text>
                <Text style={styles.equivalentValue}>
                  {Math.round((result.dailyWaterMl || 2000) / 200)} bardak
                </Text>
              </View>
              <View style={styles.equivalentRow}>
                <Text style={styles.equivalentIcon}>🍶</Text>
                <Text style={styles.equivalentLabel}>Şişe (500ml)</Text>
                <Text style={styles.equivalentValue}>
                  {((result.dailyWaterMl || 2000) / 500).toFixed(1)} şişe
                </Text>
              </View>
              <View style={styles.equivalentRow}>
                <Text style={styles.equivalentIcon}>💧</Text>
                <Text style={styles.equivalentLabel}>Litre</Text>
                <Text style={styles.equivalentValue}>
                  {((result.dailyWaterMl || 2000) / 1000).toFixed(1)} L
                </Text>
              </View>
            </View>

            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>💡 İpuçları</Text>
              <Text style={styles.tipText}>• Sabah kalktığınızda 1-2 bardak su için</Text>
              <Text style={styles.tipText}>• Her öğünden önce su içmeyi unutmayın</Text>
              <Text style={styles.tipText}>• Egzersiz sırasında daha fazla su tüketin</Text>
              <Text style={styles.tipText}>• İdrar renginiz açık sarı olmalı</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flex: 1,
    },
    contentContainer: {
      padding: theme.spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.xl,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.backgroundCard,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    backIcon: {
      fontSize: 24,
      color: theme.colors.text,
    },
    headerTextContainer: {
      flex: 1,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    form: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: theme.card.borderRadius,
      padding: theme.card.padding,
      marginBottom: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    inputGroup: {
      marginBottom: theme.spacing.md,
    },
    label: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: theme.spacing.sm,
      color: theme.colors.text,
    },
    input: {
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      padding: 12,
      fontSize: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      color: theme.colors.text,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    optionActive: {
      borderColor: '#3B82F6',
      backgroundColor: '#3B82F6' + '10',
    },
    optionContent: {
      flex: 1,
    },
    optionLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 2,
    },
    optionLabelActive: {
      color: '#3B82F6',
    },
    optionDesc: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: theme.colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioActive: {
      borderColor: '#3B82F6',
    },
    radioDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#3B82F6',
    },
    calculateButton: {
      backgroundColor: '#3B82F6',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: theme.spacing.sm,
    },
    calculateButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    resultCard: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: theme.card.borderRadius,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    resultTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 20,
    },
    mainResult: {
      alignItems: 'center',
      marginBottom: 24,
    },
    waterIcon: {
      fontSize: 48,
      marginBottom: 12,
    },
    waterValue: {
      fontSize: 56,
      fontWeight: '800',
      color: '#3B82F6',
      marginBottom: 4,
    },
    waterUnit: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    equivalentsCard: {
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    equivalentsTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    equivalentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    equivalentIcon: {
      fontSize: 24,
      marginRight: 12,
    },
    equivalentLabel: {
      flex: 1,
      fontSize: 15,
      color: theme.colors.text,
    },
    equivalentValue: {
      fontSize: 16,
      fontWeight: '700',
      color: '#3B82F6',
    },
    tipsCard: {
      backgroundColor: '#3B82F6' + '10',
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: '#3B82F6' + '30',
    },
    tipsTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 12,
    },
    tipText: {
      fontSize: 14,
      color: theme.colors.text,
      marginBottom: 6,
      lineHeight: 20,
    },
  });
