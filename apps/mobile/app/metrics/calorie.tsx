import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { metricsService } from '@/services/api';
import { useTheme } from '@/hooks/useTheme';
import { validateAgeYears, validateHeightCm, validateWeightKg } from '@/utils/numberInput';

export default function CalorieCalculatorScreen() {
    const theme = useTheme();
    const router = useRouter();
    const [height, setHeight] = useState('');
    const [weight, setWeight] = useState('');
    const [age, setAge] = useState('');
    const [sex, setSex] = useState<'male' | 'female'>('female');
    const [activityLevel, setActivityLevel] = useState('sedentary');
    const [result, setResult] = useState<any>(null);

    const calculateBMRMutation = useMutation({
        mutationFn: (data: {
            heightCm: number;
            weightKg: number;
            ageYears: number;
            sex: 'male' | 'female';
            activityLevel?: string;
        }) => metricsService.calculateBMR(data),
        onSuccess: (data) => {
            setResult(data);
        },
        onError: (error: any) => {
            Alert.alert('Hata', error.message || 'Kalori hesaplanırken bir hata oluştu');
        },
    });

    const handleCalculate = () => {
        const heightCheck = validateHeightCm(height);
        if (heightCheck.error || !heightCheck.value) {
            Alert.alert('Hata', heightCheck.error || 'Lütfen geçerli bir boy değeri girin');
            return;
        }
        const weightCheck = validateWeightKg(weight);
        if (weightCheck.error || !weightCheck.value) {
            Alert.alert('Hata', weightCheck.error || 'Lütfen geçerli bir kilo değeri girin');
            return;
        }
        const ageCheck = validateAgeYears(age);
        if (ageCheck.error || !ageCheck.value) {
            Alert.alert('Hata', ageCheck.error || 'Lütfen geçerli bir yaş değeri girin');
            return;
        }

        calculateBMRMutation.mutate({
            heightCm: heightCheck.value,
            weightKg: weightCheck.value,
            ageYears: ageCheck.value,
            sex,
            activityLevel,
        });
    };

    const activityLevels = [
        { value: 'sedentary', label: 'Hareketsiz', desc: 'Egzersiz yok' },
        { value: 'light', label: 'Hafif Aktif', desc: 'Haftada 1-3 gün' },
        { value: 'moderate', label: 'Orta Aktif', desc: 'Haftada 3-5 gün' },
        { value: 'active', label: 'Çok Aktif', desc: 'Haftada 6-7 gün' },
        { value: 'very_active', label: 'Aşırı Aktif', desc: 'Günde 2 kez' },
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
                        <Text style={styles.title}>Kalori Hesaplama</Text>
                        <Text style={styles.subtitle}>Günlük kalori ihtiyacı</Text>
                    </View>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Boy (cm)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="örn: 170"
                            placeholderTextColor={theme.colors.textLight}
                            keyboardType="numeric"
                            value={height}
                            onChangeText={setHeight}
                        />
                    </View>

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
                        <Text style={styles.label}>Yaş</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="örn: 30"
                            placeholderTextColor={theme.colors.textLight}
                            keyboardType="numeric"
                            value={age}
                            onChangeText={setAge}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Cinsiyet</Text>
                        <View style={styles.segmentedControl}>
                            <TouchableOpacity
                                style={[styles.segment, sex === 'female' && styles.segmentActive]}
                                onPress={() => setSex('female')}
                            >
                                <Text style={[styles.segmentText, sex === 'female' && styles.segmentTextActive]}>
                                    Kadın
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.segment, sex === 'male' && styles.segmentActive]}
                                onPress={() => setSex('male')}
                            >
                                <Text style={[styles.segmentText, sex === 'male' && styles.segmentTextActive]}>
                                    Erkek
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Aktivite Seviyesi</Text>
                        {activityLevels.map((level) => (
                            <TouchableOpacity
                                key={level.value}
                                style={[
                                    styles.activityOption,
                                    activityLevel === level.value && styles.activityOptionActive,
                                ]}
                                onPress={() => setActivityLevel(level.value)}
                            >
                                <View style={styles.activityOptionContent}>
                                    <Text
                                        style={[
                                            styles.activityLabel,
                                            activityLevel === level.value && styles.activityLabelActive,
                                        ]}
                                    >
                                        {level.label}
                                    </Text>
                                    <Text style={styles.activityDesc}>{level.desc}</Text>
                                </View>
                                <View
                                    style={[
                                        styles.radio,
                                        activityLevel === level.value && styles.radioActive,
                                    ]}
                                >
                                    {activityLevel === level.value && <View style={styles.radioDot} />}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity
                        style={styles.calculateButton}
                        onPress={handleCalculate}
                        disabled={calculateBMRMutation.isPending}
                    >
                        <Text style={styles.calculateButtonText}>
                            {calculateBMRMutation.isPending ? 'Hesaplanıyor...' : 'Hesapla'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {result && (
                    <View style={styles.resultCard}>
                        <Text style={styles.resultTitle}>Günlük Kalori İhtiyacınız</Text>

                        <View style={styles.mainResult}>
                            <Text style={styles.calorieValue}>{Math.round(result.tdee || result.bmr)}</Text>
                            <Text style={styles.calorieUnit}>kcal/gün</Text>
                        </View>

                        <View style={styles.detailsCard}>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Bazal Metabolizma (BMR)</Text>
                                <Text style={styles.detailValue}>{Math.round(result.bmr)} kcal</Text>
                            </View>
                            {result.tdee && (
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Günlük Harcama (TDEE)</Text>
                                    <Text style={styles.detailValue}>{Math.round(result.tdee)} kcal</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.goalsCard}>
                            <Text style={styles.goalsTitle}>Hedef Bazlı Kalori</Text>
                            <View style={styles.goalRow}>
                                <Text style={styles.goalLabel}>🎯 Kilo Kaybı (-20%)</Text>
                                <Text style={styles.goalValue}>
                                    {Math.round((result.tdee || result.bmr) * 0.8)} kcal
                                </Text>
                            </View>
                            <View style={styles.goalRow}>
                                <Text style={styles.goalLabel}>⚖️ Kilo Koruma</Text>
                                <Text style={styles.goalValue}>
                                    {Math.round(result.tdee || result.bmr)} kcal
                                </Text>
                            </View>
                            <View style={styles.goalRow}>
                                <Text style={styles.goalLabel}>💪 Kilo Alma (+15%)</Text>
                                <Text style={styles.goalValue}>
                                    {Math.round((result.tdee || result.bmr) * 1.15)} kcal
                                </Text>
                            </View>
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
        segmentedControl: {
            flexDirection: 'row',
            backgroundColor: theme.colors.background,
            borderRadius: 12,
            padding: 4,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        segment: {
            flex: 1,
            paddingVertical: 10,
            alignItems: 'center',
            borderRadius: 8,
        },
        segmentActive: {
            backgroundColor: theme.colors.primary,
        },
        segmentText: {
            fontSize: 15,
            fontWeight: '600',
            color: theme.colors.text,
        },
        segmentTextActive: {
            color: theme.colors.textOnPrimary,
        },
        activityOption: {
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
        activityOptionActive: {
            borderColor: theme.colors.primary,
            backgroundColor: theme.colors.primary + '10',
        },
        activityOptionContent: {
            flex: 1,
        },
        activityLabel: {
            fontSize: 15,
            fontWeight: '600',
            color: theme.colors.text,
            marginBottom: 2,
        },
        activityLabelActive: {
            color: theme.colors.primary,
        },
        activityDesc: {
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
            borderColor: theme.colors.primary,
        },
        radioDot: {
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: theme.colors.primary,
        },
        calculateButton: {
            backgroundColor: theme.colors.primary,
            borderRadius: 12,
            padding: 16,
            alignItems: 'center',
            marginTop: theme.spacing.sm,
        },
        calculateButtonText: {
            color: theme.colors.textOnPrimary,
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
        calorieValue: {
            fontSize: 56,
            fontWeight: '800',
            color: '#F59E0B',
            marginBottom: 4,
        },
        calorieUnit: {
            fontSize: 18,
            fontWeight: '600',
            color: theme.colors.textSecondary,
        },
        detailsCard: {
            backgroundColor: theme.colors.background,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
        },
        detailRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 8,
        },
        detailLabel: {
            fontSize: 15,
            color: theme.colors.text,
        },
        detailValue: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.colors.primary,
        },
        goalsCard: {
            backgroundColor: theme.colors.background,
            borderRadius: 12,
            padding: 16,
        },
        goalsTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: 12,
            textAlign: 'center',
        },
        goalRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
        },
        goalLabel: {
            fontSize: 15,
            color: theme.colors.text,
        },
        goalValue: {
            fontSize: 16,
            fontWeight: '700',
            color: '#F59E0B',
        },
    });
