import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { validateHeightCm } from '@/utils/numberInput';

export default function IdealWeightCalculatorScreen() {
    const theme = useTheme();
    const router = useRouter();
    const [height, setHeight] = useState('');
    const [result, setResult] = useState<any>(null);

    const handleCalculate = () => {
        const heightCheck = validateHeightCm(height);
        if (heightCheck.error || !heightCheck.value) {
            Alert.alert('Hata', heightCheck.error || 'Lütfen geçerli bir boy değeri girin');
            return;
        }
        const h = heightCheck.value;

        // Different formulas for ideal weight
        const heightM = h / 100;

        // BMI-based (18.5-24.9)
        const minWeight = 18.5 * heightM * heightM;
        const maxWeight = 24.9 * heightM * heightM;
        const idealWeight = (minWeight + maxWeight) / 2;

        // Height-based clinical formulas (for women; base at 60 inches / 152.4 cm)
        const heightInches = h / 2.54;
        const inchDiff = heightInches - 60;
        const devine = 45.5 + 2.3 * inchDiff;
        const robinson = 49 + 1.7 * inchDiff;
        const miller = 53.1 + 1.36 * inchDiff;
        const hamwi = 45.5 + 2.2 * inchDiff;

        setResult({
            minWeight,
            maxWeight,
            idealWeight,
            devine: Math.max(devine, 30),
            robinson: Math.max(robinson, 30),
            miller: Math.max(miller, 30),
            hamwi: Math.max(hamwi, 30),
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
                        <Text style={styles.title}>İdeal Kilo</Text>
                        <Text style={styles.subtitle}>Hedef kilo aralığı</Text>
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

                    <TouchableOpacity
                        style={styles.calculateButton}
                        onPress={handleCalculate}
                    >
                        <Text style={styles.calculateButtonText}>Hesapla</Text>
                    </TouchableOpacity>
                </View>

                {result && (
                    <View style={styles.resultCard}>
                        <Text style={styles.resultTitle}>İdeal Kilo Aralığınız</Text>

                        <View style={styles.mainResult}>
                            <Text style={styles.icon}>🎯</Text>
                            <View style={styles.rangeContainer}>
                                <View style={styles.weightBox}>
                                    <Text style={styles.weightValue}>{result.minWeight.toFixed(1)}</Text>
                                    <Text style={styles.weightUnit}>kg</Text>
                                </View>
                                <View style={styles.divider}>
                                    <View style={styles.dividerLine} />
                                </View>
                                <View style={styles.weightBox}>
                                    <Text style={styles.weightValue}>{result.maxWeight.toFixed(1)}</Text>
                                    <Text style={styles.weightUnit}>kg</Text>
                                </View>
                            </View>
                            <Text style={styles.rangeNote}>Normal BMI aralığı (18.5-24.9)</Text>
                        </View>

                        <View style={styles.formulasCard}>
                            <Text style={styles.formulasTitle}>Farklı Formüllere Göre</Text>

                            <View style={styles.formulaRow}>
                                <View style={styles.formulaInfo}>
                                    <Text style={styles.formulaName}>Devine Formülü</Text>
                                    <Text style={styles.formulaDesc}>En yaygın kullanılan</Text>
                                </View>
                                <Text style={styles.formulaValue}>{result.devine.toFixed(1)} kg</Text>
                            </View>

                            <View style={styles.formulaRow}>
                                <View style={styles.formulaInfo}>
                                    <Text style={styles.formulaName}>Robinson Formülü</Text>
                                    <Text style={styles.formulaDesc}>Güncellenmiş versiyon</Text>
                                </View>
                                <Text style={styles.formulaValue}>{result.robinson.toFixed(1)} kg</Text>
                            </View>

                            <View style={styles.formulaRow}>
                                <View style={styles.formulaInfo}>
                                    <Text style={styles.formulaName}>Miller Formülü</Text>
                                    <Text style={styles.formulaDesc}>Modern yaklaşım</Text>
                                </View>
                                <Text style={styles.formulaValue}>{result.miller.toFixed(1)} kg</Text>
                            </View>

                            <View style={styles.formulaRow}>
                                <View style={styles.formulaInfo}>
                                    <Text style={styles.formulaName}>Hamwi Formülü</Text>
                                    <Text style={styles.formulaDesc}>Klinik kullanım</Text>
                                </View>
                                <Text style={styles.formulaValue}>{result.hamwi.toFixed(1)} kg</Text>
                            </View>
                        </View>

                        <View style={styles.infoCard}>
                            <Text style={styles.infoTitle}>ℹ️ Önemli Not</Text>
                            <Text style={styles.infoText}>
                                İdeal kilo, vücut yapısı, kas kütlesi ve genel sağlık durumuna göre değişir.
                                Bu hesaplamalar genel bir rehberdir. Kişisel hedefleriniz için doktorunuza danışın.
                            </Text>
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
        calculateButton: {
            backgroundColor: '#8B5CF6',
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
        icon: {
            fontSize: 48,
            marginBottom: 16,
        },
        rangeContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 12,
        },
        weightBox: {
            alignItems: 'center',
            paddingHorizontal: 20,
        },
        weightValue: {
            fontSize: 36,
            fontWeight: '800',
            color: '#8B5CF6',
            marginBottom: 4,
        },
        weightUnit: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.colors.textSecondary,
        },
        divider: {
            paddingHorizontal: 16,
        },
        dividerLine: {
            width: 32,
            height: 3,
            backgroundColor: '#8B5CF6',
            borderRadius: 2,
        },
        rangeNote: {
            fontSize: 14,
            color: theme.colors.textSecondary,
            textAlign: 'center',
            fontStyle: 'italic',
        },
        formulasCard: {
            backgroundColor: theme.colors.background,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
        },
        formulasTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: 16,
            textAlign: 'center',
        },
        formulaRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
        },
        formulaInfo: {
            flex: 1,
        },
        formulaName: {
            fontSize: 15,
            fontWeight: '600',
            color: theme.colors.text,
            marginBottom: 2,
        },
        formulaDesc: {
            fontSize: 13,
            color: theme.colors.textSecondary,
        },
        formulaValue: {
            fontSize: 18,
            fontWeight: '700',
            color: '#8B5CF6',
        },
        infoCard: {
            backgroundColor: '#8B5CF6' + '10',
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: '#8B5CF6' + '30',
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
