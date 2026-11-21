import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function OvulationCalculatorScreen() {
    const theme = useTheme();
    const router = useRouter();
    const [lastPeriodDate, setLastPeriodDate] = useState(new Date());
    const [cycleLength, setCycleLength] = useState(28);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleCalculate = () => {
        const baseLmp = new Date(
            lastPeriodDate.getFullYear(),
            lastPeriodDate.getMonth(),
            lastPeriodDate.getDate(),
            12,
            0,
            0,
        );
        // Ovulation typically occurs 14 days before next period
        const ovulationDay = cycleLength - 14;
        const ovulationDate = new Date(baseLmp);
        ovulationDate.setDate(ovulationDate.getDate() + ovulationDay);

        // Fertile window: 5 days before ovulation + ovulation day + 1 day after
        const fertileStart = new Date(ovulationDate);
        fertileStart.setDate(fertileStart.getDate() - 5);

        const fertileEnd = new Date(ovulationDate);
        fertileEnd.setDate(fertileEnd.getDate() + 1);

        // Next period
        const nextPeriod = new Date(baseLmp);
        nextPeriod.setDate(nextPeriod.getDate() + cycleLength);

        setResult({
            ovulationDate,
            fertileStart,
            fertileEnd,
            nextPeriod,
        });
    };

    const cycleLengths = [21, 24, 26, 28, 30, 32, 35];

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
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
                        <Text style={styles.title}>Ovulasyon Hesaplayıcı</Text>
                        <Text style={styles.subtitle}>Yumurtlama takvimi</Text>
                    </View>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Son Adet Tarihi</Text>
                        <TouchableOpacity
                            style={styles.dateButton}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <Text style={styles.dateText}>{formatDate(lastPeriodDate)}</Text>
                            <Text style={styles.dateIcon}>📅</Text>
                        </TouchableOpacity>
                        {showDatePicker && (
                            <DateTimePicker
                                value={lastPeriodDate}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={(event, selectedDate) => {
                                    setShowDatePicker(Platform.OS === 'ios');
                                    if (selectedDate) {
                                        setLastPeriodDate(selectedDate);
                                    }
                                }}
                                maximumDate={new Date()}
                            />
                        )}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Döngü Uzunluğu (gün)</Text>
                        <View style={styles.cycleLengthGrid}>
                            {cycleLengths.map((length) => (
                                <TouchableOpacity
                                    key={length}
                                    style={[
                                        styles.cycleLengthButton,
                                        cycleLength === length && styles.cycleLengthButtonActive,
                                    ]}
                                    onPress={() => setCycleLength(length)}
                                >
                                    <Text
                                        style={[
                                            styles.cycleLengthText,
                                            cycleLength === length && styles.cycleLengthTextActive,
                                        ]}
                                    >
                                        {length}
                                    </Text>
                                </TouchableOpacity>
                            ))}
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
                        <Text style={styles.resultTitle}>Tahmini Tarihler</Text>

                        <View style={[styles.dateCard, styles.ovulationCard]}>
                            <Text style={styles.dateCardIcon}>🌸</Text>
                            <View style={styles.dateCardContent}>
                                <Text style={styles.dateCardLabel}>Ovulasyon Günü</Text>
                                <Text style={styles.dateCardDate}>{formatDate(result.ovulationDate)}</Text>
                            </View>
                        </View>

                        <View style={[styles.dateCard, styles.fertileCard]}>
                            <Text style={styles.dateCardIcon}>💚</Text>
                            <View style={styles.dateCardContent}>
                                <Text style={styles.dateCardLabel}>Verimli Dönem Başlangıcı</Text>
                                <Text style={styles.dateCardDate}>{formatDate(result.fertileStart)}</Text>
                            </View>
                        </View>

                        <View style={[styles.dateCard, styles.fertileCard]}>
                            <Text style={styles.dateCardIcon}>💚</Text>
                            <View style={styles.dateCardContent}>
                                <Text style={styles.dateCardLabel}>Verimli Dönem Bitişi</Text>
                                <Text style={styles.dateCardDate}>{formatDate(result.fertileEnd)}</Text>
                            </View>
                        </View>

                        <View style={[styles.dateCard, styles.periodCard]}>
                            <Text style={styles.dateCardIcon}>📅</Text>
                            <View style={styles.dateCardContent}>
                                <Text style={styles.dateCardLabel}>Sonraki Adet Tarihi</Text>
                                <Text style={styles.dateCardDate}>{formatDate(result.nextPeriod)}</Text>
                            </View>
                        </View>

                        <View style={styles.infoCard}>
                            <Text style={styles.infoTitle}>ℹ️ Bilgi</Text>
                            <Text style={styles.infoText}>
                                Bu hesaplama ortalama değerlere dayalıdır. Her kadının döngüsü farklıdır.
                                Daha kesin sonuçlar için ovulasyon testleri kullanabilir veya doktorunuza danışabilirsiniz.
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
        dateButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: theme.colors.background,
            borderRadius: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        dateText: {
            fontSize: 16,
            color: theme.colors.text,
            fontWeight: '600',
        },
        dateIcon: {
            fontSize: 20,
        },
        cycleLengthGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        cycleLengthButton: {
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: theme.colors.background,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        cycleLengthButtonActive: {
            backgroundColor: '#EC4899',
            borderColor: '#EC4899',
        },
        cycleLengthText: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.colors.text,
        },
        cycleLengthTextActive: {
            color: '#FFFFFF',
        },
        calculateButton: {
            backgroundColor: '#EC4899',
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
            marginBottom: 20,
        },
        dateCard: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.background,
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            borderLeftWidth: 4,
        },
        ovulationCard: {
            borderLeftColor: '#EC4899',
        },
        fertileCard: {
            borderLeftColor: '#10B981',
        },
        periodCard: {
            borderLeftColor: '#F59E0B',
        },
        dateCardIcon: {
            fontSize: 32,
            marginRight: 16,
        },
        dateCardContent: {
            flex: 1,
        },
        dateCardLabel: {
            fontSize: 14,
            color: theme.colors.textSecondary,
            marginBottom: 4,
        },
        dateCardDate: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.colors.text,
        },
        infoCard: {
            backgroundColor: '#EC4899' + '10',
            borderRadius: 12,
            padding: 16,
            marginTop: 8,
            borderWidth: 1,
            borderColor: '#EC4899' + '30',
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
