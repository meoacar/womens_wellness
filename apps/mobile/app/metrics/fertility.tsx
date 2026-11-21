import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function FertilityCalculatorScreen() {
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

        // Peak fertility: 2 days before ovulation + ovulation day
        const peakStart = new Date(ovulationDate);
        peakStart.setDate(peakStart.getDate() - 2);

        const peakEnd = new Date(ovulationDate);

        // Next period
        const nextPeriod = new Date(baseLmp);
        nextPeriod.setDate(nextPeriod.getDate() + cycleLength);

        // Calculate fertile days for next 3 cycles
        const nextCycles = [];
        for (let i = 1; i <= 3; i++) {
            const cycleStart = new Date(baseLmp);
            cycleStart.setDate(cycleStart.getDate() + (cycleLength * i));

            const cycleOvulation = new Date(cycleStart);
            cycleOvulation.setDate(cycleOvulation.getDate() + ovulationDay);

            const cycleFertileStart = new Date(cycleOvulation);
            cycleFertileStart.setDate(cycleFertileStart.getDate() - 5);

            const cycleFertileEnd = new Date(cycleOvulation);
            cycleFertileEnd.setDate(cycleFertileEnd.getDate() + 1);

            nextCycles.push({
                cycleNumber: i + 1,
                periodDate: cycleStart,
                ovulationDate: cycleOvulation,
                fertileStart: cycleFertileStart,
                fertileEnd: cycleFertileEnd,
            });
        }

        setResult({
            ovulationDate,
            fertileStart,
            fertileEnd,
            peakStart,
            peakEnd,
            nextPeriod,
            nextCycles,
        });
    };

    const cycleLengths = [21, 24, 26, 28, 30, 32, 35];

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
    };

    const formatDateShort = (date: Date) => {
        return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
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
                        <Text style={styles.title}>Doğurganlık Hesaplayıcı</Text>
                        <Text style={styles.subtitle}>Verimli günler</Text>
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
                        <Text style={styles.resultTitle}>Bu Döngü</Text>

                        <View style={[styles.dateCard, styles.peakCard]}>
                            <Text style={styles.dateCardIcon}>🌺</Text>
                            <View style={styles.dateCardContent}>
                                <Text style={styles.dateCardLabel}>En Verimli Günler</Text>
                                <Text style={styles.dateCardDate}>
                                    {formatDate(result.peakStart)} - {formatDateShort(result.peakEnd)}
                                </Text>
                                <Text style={styles.dateCardNote}>Hamile kalma şansı en yüksek</Text>
                            </View>
                        </View>

                        <View style={[styles.dateCard, styles.fertileCard]}>
                            <Text style={styles.dateCardIcon}>💚</Text>
                            <View style={styles.dateCardContent}>
                                <Text style={styles.dateCardLabel}>Verimli Dönem</Text>
                                <Text style={styles.dateCardDate}>
                                    {formatDate(result.fertileStart)} - {formatDateShort(result.fertileEnd)}
                                </Text>
                                <Text style={styles.dateCardNote}>Hamile kalma olasılığı var</Text>
                            </View>
                        </View>

                        <View style={[styles.dateCard, styles.ovulationCard]}>
                            <Text style={styles.dateCardIcon}>🌸</Text>
                            <View style={styles.dateCardContent}>
                                <Text style={styles.dateCardLabel}>Ovulasyon Günü</Text>
                                <Text style={styles.dateCardDate}>{formatDate(result.ovulationDate)}</Text>
                            </View>
                        </View>

                        <View style={[styles.dateCard, styles.periodCard]}>
                            <Text style={styles.dateCardIcon}>📅</Text>
                            <View style={styles.dateCardContent}>
                                <Text style={styles.dateCardLabel}>Sonraki Adet</Text>
                                <Text style={styles.dateCardDate}>{formatDate(result.nextPeriod)}</Text>
                            </View>
                        </View>

                        <View style={styles.nextCyclesCard}>
                            <Text style={styles.nextCyclesTitle}>Sonraki Döngüler</Text>
                            {result.nextCycles.map((cycle: any) => (
                                <View key={cycle.cycleNumber} style={styles.cycleRow}>
                                    <View style={styles.cycleNumber}>
                                        <Text style={styles.cycleNumberText}>{cycle.cycleNumber}</Text>
                                    </View>
                                    <View style={styles.cycleInfo}>
                                        <Text style={styles.cycleLabel}>Verimli Dönem</Text>
                                        <Text style={styles.cycleDate}>
                                            {formatDateShort(cycle.fertileStart)} - {formatDateShort(cycle.fertileEnd)}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>

                        <View style={styles.tipsCard}>
                            <Text style={styles.tipsTitle}>💡 İpuçları</Text>
                            <Text style={styles.tipText}>
                                • En verimli günler ovulasyondan 2 gün önce ve ovulasyon günüdür
                            </Text>
                            <Text style={styles.tipText}>
                                • Sperm 5 güne kadar yaşayabilir, bu yüzden verimli dönem yaklaşık 7 gündür
                            </Text>
                            <Text style={styles.tipText}>
                                • Ovulasyon testleri daha kesin sonuçlar verir
                            </Text>
                            <Text style={styles.tipText}>
                                • Bazal vücut ısısı takibi ovulasyonu doğrulamaya yardımcı olur
                            </Text>
                        </View>

                        <View style={styles.infoCard}>
                            <Text style={styles.infoTitle}>ℹ️ Önemli Not</Text>
                            <Text style={styles.infoText}>
                                Bu hesaplama ortalama değerlere dayalıdır. Her kadının döngüsü farklıdır.
                                Hamilelik planlaması için doktorunuza danışmanız önerilir.
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
            backgroundColor: '#F97316',
            borderColor: '#F97316',
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
            backgroundColor: '#F97316',
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
        peakCard: {
            borderLeftColor: '#F97316',
            backgroundColor: '#F97316' + '10',
        },
        fertileCard: {
            borderLeftColor: '#10B981',
        },
        ovulationCard: {
            borderLeftColor: '#EC4899',
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
            marginBottom: 2,
        },
        dateCardNote: {
            fontSize: 13,
            color: theme.colors.textSecondary,
            fontStyle: 'italic',
        },
        nextCyclesCard: {
            backgroundColor: theme.colors.background,
            borderRadius: 12,
            padding: 16,
            marginTop: 8,
            marginBottom: 16,
        },
        nextCyclesTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: 12,
            textAlign: 'center',
        },
        cycleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
        },
        cycleNumber: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: '#F97316',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
        },
        cycleNumberText: {
            fontSize: 14,
            fontWeight: '700',
            color: '#FFFFFF',
        },
        cycleInfo: {
            flex: 1,
        },
        cycleLabel: {
            fontSize: 14,
            color: theme.colors.textSecondary,
            marginBottom: 2,
        },
        cycleDate: {
            fontSize: 15,
            fontWeight: '600',
            color: theme.colors.text,
        },
        tipsCard: {
            backgroundColor: theme.colors.background,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
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
            marginBottom: 8,
            lineHeight: 20,
        },
        infoCard: {
            backgroundColor: '#F97316' + '10',
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: '#F97316' + '30',
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
