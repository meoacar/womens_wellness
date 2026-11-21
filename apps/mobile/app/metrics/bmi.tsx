import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { metricsService } from '@/services/api';
import { useTheme } from '@/hooks/useTheme';
import { validateHeightCm, validateWeightKg } from '@/utils/numberInput';

export default function BMICalculatorScreen() {
    const theme = useTheme();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [height, setHeight] = useState('');
    const [weight, setWeight] = useState('');
    const [result, setResult] = useState<any>(null);

    const calculateBMIMutation = useMutation({
        mutationFn: (data: { heightCm: number; weightKg: number }) =>
            metricsService.calculateBMI(data),
        onSuccess: (data) => {
            console.log('BMI API Response:', JSON.stringify(data, null, 2));
            setResult(data);
            queryClient.invalidateQueries({ queryKey: ['metrics'] });
        },
        onError: (error: any) => {
            Alert.alert('Hata', error.message || 'BMI hesaplanırken bir hata oluştu');
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

        calculateBMIMutation.mutate({ heightCm: heightCheck.value, weightKg: weightCheck.value });
    };

    const getCategoryInfo = (category: string) => {
        switch (category) {
            case 'underweight':
                return { text: 'Zayıf', color: '#FFA500' };
            case 'normal':
                return { text: 'Normal', color: '#4CAF50' };
            case 'overweight':
                return { text: 'Fazla Kilolu', color: '#FF9800' };
            case 'obese':
                return { text: 'Obez', color: '#F44336' };
            default:
                return { text: category, color: '#666' };
        }
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
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <Text style={styles.backIcon}>←</Text>
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.title}>VKİ Hesaplama</Text>
                        <Text style={styles.subtitle}>Vücut Kitle İndeksi</Text>
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
                            editable={!calculateBMIMutation.isPending}
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
                            editable={!calculateBMIMutation.isPending}
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.calculateButton}
                        onPress={handleCalculate}
                        disabled={calculateBMIMutation.isPending}
                    >
                        <Text style={styles.calculateButtonText}>
                            {calculateBMIMutation.isPending ? 'Hesaplanıyor...' : 'Hesapla'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {result && (
                    <View style={styles.resultCard}>
                        <Text style={styles.resultTitle}>Sonuç</Text>
                        <Text style={styles.bmiValue}>{result.bmi?.toFixed(1)}</Text>
                        <Text
                            style={[
                                styles.category,
                                { color: getCategoryInfo(result.category).color },
                            ]}
                        >
                            {getCategoryInfo(result.category).text}
                        </Text>

                        <View style={styles.idealWeightCard}>
                            <Text style={styles.idealWeightTitle}>İdeal Kilo Aralığınız</Text>
                            <View style={styles.idealWeightContent}>
                                <View style={styles.weightRangeBox}>
                                    <Text style={styles.weightValue}>
                                        {(18.5 * Math.pow(result.heightCm / 100, 2)).toFixed(1)}
                                    </Text>
                                    <Text style={styles.weightUnit}>kg</Text>
                                </View>
                                <View style={styles.rangeDivider}>
                                    <View style={styles.dividerLine} />
                                </View>
                                <View style={styles.weightRangeBox}>
                                    <Text style={styles.weightValue}>
                                        {(24.9 * Math.pow(result.heightCm / 100, 2)).toFixed(1)}
                                    </Text>
                                    <Text style={styles.weightUnit}>kg</Text>
                                </View>
                            </View>
                            <Text style={styles.idealWeightSubtext}>
                                {result.heightCm} cm boy için normal BMI aralığı
                            </Text>
                        </View>

                        <View style={styles.infoBox}>
                            <Text style={styles.infoTitle}>BMI Aralıkları</Text>
                            <View style={styles.rangesList}>
                                <View style={[styles.rangeItem, styles.rangeUnderweight]}>
                                    <View style={styles.rangeIndicator} />
                                    <View style={styles.rangeContent}>
                                        <Text style={styles.rangeLabel}>Zayıf</Text>
                                        <Text style={styles.rangeValue}>&lt; 18.5</Text>
                                    </View>
                                </View>
                                <View style={[styles.rangeItem, styles.rangeNormal]}>
                                    <View style={styles.rangeIndicator} />
                                    <View style={styles.rangeContent}>
                                        <Text style={styles.rangeLabel}>Normal</Text>
                                        <Text style={styles.rangeValue}>18.5 - 24.9</Text>
                                    </View>
                                </View>
                                <View style={[styles.rangeItem, styles.rangeOverweight]}>
                                    <View style={styles.rangeIndicator} />
                                    <View style={styles.rangeContent}>
                                        <Text style={styles.rangeLabel}>Fazla Kilolu</Text>
                                        <Text style={styles.rangeValue}>25.0 - 29.9</Text>
                                    </View>
                                </View>
                                <View style={[styles.rangeItem, styles.rangeObese]}>
                                    <View style={styles.rangeIndicator} />
                                    <View style={styles.rangeContent}>
                                        <Text style={styles.rangeLabel}>Obez</Text>
                                        <Text style={styles.rangeValue}>≥ 30.0</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (theme: ReturnType<typeof useTheme>) => StyleSheet.create({
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
        shadowColor: theme.card.shadowColor,
        shadowOffset: theme.card.shadowOffset,
        shadowOpacity: theme.card.shadowOpacity,
        shadowRadius: theme.card.shadowRadius,
        elevation: theme.card.elevation,
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
        borderRadius: theme.button.borderRadius,
        padding: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
        color: theme.colors.text,
    },
    calculateButton: {
        backgroundColor: theme.colors.primary,
        borderRadius: theme.button.borderRadius,
        padding: theme.button.padding,
        alignItems: 'center',
        marginTop: theme.spacing.sm,
        shadowColor: theme.button.shadowColor,
        shadowOffset: theme.button.shadowOffset,
        shadowOpacity: theme.button.shadowOpacity,
        shadowRadius: theme.button.shadowRadius,
        elevation: theme.button.elevation,
    },
    calculateButtonText: {
        color: theme.colors.textOnPrimary,
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    resultCard: {
        backgroundColor: theme.colors.backgroundCard,
        borderRadius: theme.card.borderRadius,
        padding: theme.spacing.lg,
        marginBottom: theme.spacing.lg,
        alignItems: 'center',
        shadowColor: theme.card.shadowColor,
        shadowOffset: theme.card.shadowOffset,
        shadowOpacity: theme.card.shadowOpacity,
        shadowRadius: theme.card.shadowRadius,
        elevation: theme.card.elevation,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    resultTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 12,
        color: theme.colors.textSecondary,
    },
    bmiValue: {
        fontSize: 48,
        fontWeight: '800',
        color: theme.colors.primary,
        marginBottom: 8,
    },
    category: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 20,
    },
    idealWeightCard: {
        width: '100%',
        backgroundColor: theme.colors.backgroundCard,
        borderRadius: 16,
        padding: theme.spacing.lg,
        marginTop: 20,
        borderWidth: 2,
        borderColor: theme.colors.success,
        shadowColor: theme.colors.success,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    idealWeightTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.colors.success,
        textAlign: 'center',
        marginBottom: 20,
        letterSpacing: 0.5,
    },
    idealWeightContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    weightRangeBox: {
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    weightValue: {
        fontSize: 32,
        fontWeight: '800',
        color: theme.colors.text,
        marginBottom: 4,
    },
    weightUnit: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    rangeDivider: {
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    dividerLine: {
        width: 32,
        height: 3,
        backgroundColor: theme.colors.success,
        borderRadius: 2,
    },
    idealWeightSubtext: {
        fontSize: 13,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    infoBox: {
        width: '100%',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: 12,
        padding: 20,
        marginTop: 20,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 16,
        color: theme.colors.text,
        textAlign: 'center',
    },
    rangesList: {
        gap: 12,
    },
    rangeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.backgroundCard,
        borderRadius: 12,
        padding: 14,
        borderLeftWidth: 4,
        shadowColor: theme.card.shadowColor,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    rangeUnderweight: {
        borderLeftColor: '#FFA500',
    },
    rangeNormal: {
        borderLeftColor: '#4CAF50',
    },
    rangeOverweight: {
        borderLeftColor: '#FF9800',
    },
    rangeObese: {
        borderLeftColor: '#F44336',
    },
    rangeIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'currentColor',
        marginRight: 12,
    },
    rangeContent: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    rangeLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: theme.colors.text,
    },
    rangeValue: {
        fontSize: 14,
        fontWeight: '500',
        color: theme.colors.textSecondary,
    },
});
