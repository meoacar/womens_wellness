import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import {
    parseLocaleNumber,
    validateAgeYears,
    validateHeightCm,
    validateWeightKg,
} from '@/utils/numberInput';

export default function BodyFatCalculatorScreen() {
    const theme = useTheme();
    const router = useRouter();
    const [height, setHeight] = useState('');
    const [weight, setWeight] = useState('');
    const [age, setAge] = useState('');
    const [neck, setNeck] = useState('');
    const [waist, setWaist] = useState('');
    const [hip, setHip] = useState('');
    const [result, setResult] = useState<any>(null);

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

        const h = heightCheck.value;
        const w = weightCheck.value;
        const n = parseLocaleNumber(neck);
        const wa = parseLocaleNumber(waist);
        const hi = parseLocaleNumber(hip);

        if (isNaN(n) || n < 20 || n > 70) {
            Alert.alert('Hata', 'Lütfen geçerli bir boyun çevresi girin (20-70 cm)');
            return;
        }
        if (isNaN(wa) || wa < 40 || wa > 200) {
            Alert.alert('Hata', 'Lütfen geçerli bir bel çevresi girin (40-200 cm)');
            return;
        }
        if (isNaN(hi) || hi < 50 || hi > 220) {
            Alert.alert('Hata', 'Lütfen geçerli bir kalça çevresi girin (50-220 cm)');
            return;
        }
        if (wa + hi - n <= 0) {
            Alert.alert('Hata', 'Bel ve kalça çevresi toplamı boyun çevresinden büyük olmalıdır');
            return;
        }

        // US Navy Method for women
        const bodyFatPercentage =
            495 / (1.29579 - 0.35004 * Math.log10(wa + hi - n) + 0.22100 * Math.log10(h)) - 450;

        if (!Number.isFinite(bodyFatPercentage) || bodyFatPercentage < 2 || bodyFatPercentage > 75) {
            Alert.alert('Hata', 'Girdiğiniz ölçüm değerleri geçerli aralık dışında. Lütfen cm cinsinden ölçümleri kontrol edin.');
            return;
        }

        const fatMass = (bodyFatPercentage / 100) * w;
        const leanMass = w - fatMass;

        let category = '';
        let categoryColor = '';

        if (bodyFatPercentage < 21) {
            category = 'Atletik';
            categoryColor = '#10B981';
        } else if (bodyFatPercentage < 25) {
            category = 'Fit';
            categoryColor = '#3B82F6';
        } else if (bodyFatPercentage < 32) {
            category = 'Ortalama';
            categoryColor = '#F59E0B';
        } else if (bodyFatPercentage < 39) {
            category = 'Ortalamanın Üstü';
            categoryColor = '#FF9800';
        } else {
            category = 'Obez';
            categoryColor = '#EF4444';
        }

        setResult({
            bodyFatPercentage,
            fatMass,
            leanMass,
            category,
            categoryColor,
        });
    };

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
                        <Text style={styles.title}>Vücut Yağ Oranı</Text>
                        <Text style={styles.subtitle}>Yağ yüzdesi hesaplama</Text>
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

                    <View style={styles.measurementsCard}>
                        <Text style={styles.measurementsTitle}>📏 Ölçümler</Text>
                        <Text style={styles.measurementsNote}>
                            Ölçümleri cm cinsinden girin
                        </Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Boyun Çevresi</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="örn: 32"
                                placeholderTextColor={theme.colors.textLight}
                                keyboardType="numeric"
                                value={neck}
                                onChangeText={setNeck}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Bel Çevresi</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="örn: 70"
                                placeholderTextColor={theme.colors.textLight}
                                keyboardType="numeric"
                                value={waist}
                                onChangeText={setWaist}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Kalça Çevresi</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="örn: 95"
                                placeholderTextColor={theme.colors.textLight}
                                keyboardType="numeric"
                                value={hip}
                                onChangeText={setHip}
                            />
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.calculateButton}
                        onPress={handleCalculate}
                    >
                        <Text style={styles.calculateButtonText}>Hesapla</Text>
                    </TouchableOpacity>
                </View>

                {result && (
                    <View style={styles.resultCard}>
                        <Text style={styles.resultTitle}>Vücut Yağ Oranınız</Text>

                        <View style={styles.mainResult}>
                            <Text style={styles.percentValue}>
                                {result.bodyFatPercentage.toFixed(1)}%
                            </Text>
                            <View style={[styles.categoryBadge, { backgroundColor: result.categoryColor + '20' }]}>
                                <Text style={[styles.categoryText, { color: result.categoryColor }]}>
                                    {result.category}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.compositionCard}>
                            <Text style={styles.compositionTitle}>Vücut Kompozisyonu</Text>

                            <View style={styles.compositionRow}>
                                <View style={styles.compositionItem}>
                                    <Text style={styles.compositionIcon}>🟡</Text>
                                    <Text style={styles.compositionLabel}>Yağ Kütlesi</Text>
                                    <Text style={styles.compositionValue}>{result.fatMass.toFixed(1)} kg</Text>
                                </View>

                                <View style={styles.compositionDivider} />

                                <View style={styles.compositionItem}>
                                    <Text style={styles.compositionIcon}>💪</Text>
                                    <Text style={styles.compositionLabel}>Yağsız Kütle</Text>
                                    <Text style={styles.compositionValue}>{result.leanMass.toFixed(1)} kg</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.rangesCard}>
                            <Text style={styles.rangesTitle}>Kadınlar İçin Yağ Oranı Aralıkları</Text>
                            <View style={styles.rangeItem}>
                                <View style={[styles.rangeIndicator, { backgroundColor: '#10B981' }]} />
                                <Text style={styles.rangeLabel}>Atletik</Text>
                                <Text style={styles.rangeValue}>14-20%</Text>
                            </View>
                            <View style={styles.rangeItem}>
                                <View style={[styles.rangeIndicator, { backgroundColor: '#3B82F6' }]} />
                                <Text style={styles.rangeLabel}>Fit</Text>
                                <Text style={styles.rangeValue}>21-24%</Text>
                            </View>
                            <View style={styles.rangeItem}>
                                <View style={[styles.rangeIndicator, { backgroundColor: '#F59E0B' }]} />
                                <Text style={styles.rangeLabel}>Ortalama</Text>
                                <Text style={styles.rangeValue}>25-31%</Text>
                            </View>
                            <View style={styles.rangeItem}>
                                <View style={[styles.rangeIndicator, { backgroundColor: '#FF9800' }]} />
                                <Text style={styles.rangeLabel}>Ortalamanın Üstü</Text>
                                <Text style={styles.rangeValue}>32-38%</Text>
                            </View>
                            <View style={styles.rangeItem}>
                                <View style={[styles.rangeIndicator, { backgroundColor: '#EF4444' }]} />
                                <Text style={styles.rangeLabel}>Obez</Text>
                                <Text style={styles.rangeValue}>39%+</Text>
                            </View>
                        </View>

                        <View style={styles.infoCard}>
                            <Text style={styles.infoTitle}>ℹ️ Not</Text>
                            <Text style={styles.infoText}>
                                Bu hesaplama US Navy metoduna dayanır. En doğru sonuçlar için profesyonel
                                vücut kompozisyonu analizi yaptırmanız önerilir.
                            </Text>
                        </View>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView >
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
        measurementsCard: {
            backgroundColor: theme.colors.background,
            borderRadius: 12,
            padding: 16,
            marginBottom: theme.spacing.md,
        },
        measurementsTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: 4,
        },
        measurementsNote: {
            fontSize: 13,
            color: theme.colors.textSecondary,
            marginBottom: 16,
        },
        calculateButton: {
            backgroundColor: '#EF4444',
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
            fontSize: 20,
            fontWeight: '700',
            color: theme.colors.text,
            textAlign: 'center',
            marginBottom: 24,
        },
        mainResult: {
            alignItems: 'center',
            marginBottom: 24,
        },
        percentValue: {
            fontSize: 56,
            fontWeight: '800',
            color: '#EF4444',
            marginBottom: 12,
        },
        categoryBadge: {
            paddingHorizontal: 20,
            paddingVertical: 8,
            borderRadius: 20,
        },
        categoryText: {
            fontSize: 16,
            fontWeight: '700',
        },
        compositionCard: {
            backgroundColor: theme.colors.background,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
        },
        compositionTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: 16,
            textAlign: 'center',
        },
        compositionRow: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        compositionItem: {
            flex: 1,
            alignItems: 'center',
        },
        compositionIcon: {
            fontSize: 32,
            marginBottom: 8,
        },
        compositionLabel: {
            fontSize: 14,
            color: theme.colors.textSecondary,
            marginBottom: 4,
        },
        compositionValue: {
            fontSize: 20,
            fontWeight: '700',
            color: theme.colors.text,
        },
        compositionDivider: {
            width: 1,
            height: 60,
            backgroundColor: theme.colors.border,
            marginHorizontal: 16,
        },
        rangesCard: {
            backgroundColor: theme.colors.background,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
        },
        rangesTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: 12,
            textAlign: 'center',
        },
        rangeItem: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 8,
        },
        rangeIndicator: {
            width: 12,
            height: 12,
            borderRadius: 6,
            marginRight: 12,
        },
        rangeLabel: {
            flex: 1,
            fontSize: 15,
            color: theme.colors.text,
        },
        rangeValue: {
            fontSize: 15,
            fontWeight: '600',
            color: theme.colors.textSecondary,
        },
        infoCard: {
            backgroundColor: '#EF4444' + '10',
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: '#EF4444' + '30',
        },
        infoTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: 8,
        },
        infoText: {
            fontSize: 14,
            color: theme.colors.text,
            lineHeight: 20,
        },
    });
