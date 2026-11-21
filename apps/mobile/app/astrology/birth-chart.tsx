import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { usePremium } from '@/hooks/usePremium';
import { UpgradePrompt } from '@/components/premium/UpgradePrompt';
import { useAuthStore } from '@/store/authStore';
import {
    ZODIAC_SIGNS,
    ZodiacSign,
    calculateElementDistribution,
    getSignDescription,
    parseBirthDateSafe,
    toBirthDateIsoNoon,
} from '@/utils/astrology';
import { astrologyApi, BirthChartResponse } from '@/services/astrologyApi';

const QUICK_CITIES = ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya'];
const QUICK_TIMES = ['06:00', '09:30', '12:00', '18:00', '22:30'];

export default function BirthChartScreen() {
    const theme = useTheme();
    const { isPremium } = usePremium();
    const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user, isAuthenticated } = useAuthStore();

    const { data: savedChart, isLoading: loadingSaved } = useQuery({
        queryKey: ['astrology', 'my-birth-chart'],
        queryFn: () => astrologyApi.getMyBirthChart(),
        enabled: isAuthenticated,
    });

    const initialDate =
        parseBirthDateSafe(user?.profile?.dateOfBirth) || new Date(1996, 4, 15, 12, 0, 0);

    const [birthDate, setBirthDate] = useState(initialDate);
    const [birthDateInput, setBirthDateInput] = useState(
        initialDate.toLocaleDateString('tr-TR')
    );
    const [birthTime, setBirthTime] = useState('12:00');
    const [birthPlace, setBirthPlace] = useState('İstanbul');
    const [editing, setEditing] = useState(true);
    const [loading, setLoading] = useState(false);
    const [apiChartData, setApiChartData] = useState<BirthChartResponse | null>(null);

    useEffect(() => {
        if (savedChart && !apiChartData) {
            setApiChartData(savedChart);
            if (savedChart.birthDate) {
                const d = new Date(savedChart.birthDate);
                if (!isNaN(d.getTime())) {
                    setBirthDate(d);
                    setBirthDateInput(d.toLocaleDateString('tr-TR'));
                }
            }
            if (savedChart.birthTime) setBirthTime(savedChart.birthTime);
            if (savedChart.city) setBirthPlace(savedChart.city);
            setEditing(false);
        }
    }, [savedChart, apiChartData]);

    const handleDateInputChange = (text: string) => {
        setBirthDateInput(text);
        const parts = text.split(/[./]/);
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 1920) {
                const newDate = new Date(year, month, day);
                if (!isNaN(newDate.getTime())) {
                    setBirthDate(newDate);
                }
            }
        }
    };

    const handleCalculate = async () => {
        if (!isPremium) {
            setShowUpgradePrompt(true);
            return;
        }
        if (!birthPlace.trim()) {
            Alert.alert('Uyarı', 'Lütfen doğum yerinizi girin');
            return;
        }

        setLoading(true);
        try {
            const result = await astrologyApi.calculateBirthChart({
                birthDate: toBirthDateIsoNoon(birthDate),
                birthTime: birthTime.trim() || '12:00',
                city: birthPlace.trim(),
            });

            setApiChartData(result);
            setEditing(false);
            queryClient.invalidateQueries({ queryKey: ['astrology', 'my-birth-chart'] });
        } catch (error: any) {
            Alert.alert(
                'Hata',
                error?.message || 'Doğum haritası hesaplanırken bir hata oluştu.'
            );
        } finally {
            setLoading(false);
        }
    };

    const chartData = useMemo(() => {
        if (!apiChartData) return null;

        const zodiacSign = apiChartData.sunSign as ZodiacSign;
        const risingSign = apiChartData.risingSign as ZodiacSign;
        const moonSign = apiChartData.moonSign as ZodiacSign;

        const zodiacInfo = ZODIAC_SIGNS[zodiacSign];
        const risingInfo = ZODIAC_SIGNS[risingSign];
        const moonInfo = ZODIAC_SIGNS[moonSign];

        if (!zodiacInfo || !risingInfo || !moonInfo) return null;

        const elementDist = calculateElementDistribution(zodiacSign, risingSign, moonSign);

        return {
            zodiacSign,
            zodiacInfo,
            risingSign,
            risingInfo,
            moonSign,
            moonInfo,
            elementDist,
        };
    }, [apiChartData]);

    const styles = createStyles(theme);

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Doğum Haritası</Text>
                    {chartData ? (
                        <TouchableOpacity
                            style={styles.editToggle}
                            onPress={() => setEditing(!editing)}
                        >
                            <Ionicons
                                name={editing ? 'close' : 'create-outline'}
                                size={18}
                                color={theme.colors.primary}
                            />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.headerSpacer} />
                    )}
                </View>

                {loadingSaved && !chartData && (
                    <View style={styles.loaderBox}>
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                    </View>
                )}

                {/* Input Form */}
                {(editing || !chartData) && (
                    <View style={styles.formCard}>
                        <Text style={styles.formHeading}>Doğum Bilgilerin</Text>
                        <Text style={styles.formSub}>
                            Güneş, Ay ve Yükselen burcunu hesaplayıp profiline kaydederiz.
                        </Text>

                        <Text style={styles.label}>Doğum Tarihi (GG.AA.YYYY)</Text>
                        <TextInput
                            style={styles.input}
                            value={birthDateInput}
                            onChangeText={handleDateInputChange}
                            placeholder="15.05.1996"
                            placeholderTextColor={theme.colors.textLight}
                            keyboardType="numbers-and-punctuation"
                        />

                        <Text style={styles.label}>Doğum Saati (SS:DD)</Text>
                        <TextInput
                            style={styles.input}
                            value={birthTime}
                            onChangeText={setBirthTime}
                            placeholder="12:00"
                            placeholderTextColor={theme.colors.textLight}
                            keyboardType="numbers-and-punctuation"
                        />
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.chipsScroll}
                        >
                            {QUICK_TIMES.map((t) => (
                                <TouchableOpacity
                                    key={t}
                                    style={[
                                        styles.quickChip,
                                        birthTime === t && styles.quickChipActive,
                                    ]}
                                    onPress={() => setBirthTime(t)}
                                >
                                    <Text
                                        style={[
                                            styles.quickChipText,
                                            birthTime === t && styles.quickChipTextActive,
                                        ]}
                                    >
                                        {t}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={styles.label}>Doğum Şehri</Text>
                        <TextInput
                            style={styles.input}
                            value={birthPlace}
                            onChangeText={setBirthPlace}
                            placeholder="Örn: İstanbul"
                            placeholderTextColor={theme.colors.textLight}
                        />
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.chipsScroll}
                        >
                            {QUICK_CITIES.map((c) => (
                                <TouchableOpacity
                                    key={c}
                                    style={[
                                        styles.quickChip,
                                        birthPlace === c && styles.quickChipActive,
                                    ]}
                                    onPress={() => setBirthPlace(c)}
                                >
                                    <Text
                                        style={[
                                            styles.quickChipText,
                                            birthPlace === c && styles.quickChipTextActive,
                                        ]}
                                    >
                                        {c}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.calculateButton, loading && { opacity: 0.7 }]}
                            onPress={handleCalculate}
                            disabled={loading}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name="planet" size={18} color="#FFFFFF" />
                                    <Text style={styles.calculateButtonText}>
                                        Haritamı Hesapla ve Kaydet
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* Chart Results */}
                {chartData && apiChartData && (
                    <>
                        <LinearGradient
                            colors={theme.isDark ? ['#312E81', '#6B21A8'] : ['#4F46E5', '#EC4899']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.summaryBanner}
                        >
                            <Text style={styles.summaryEyebrow}>BÜYÜK ÜÇLÜN (BIG 3)</Text>
                            <View style={styles.big3Row}>
                                <View style={styles.big3Col}>
                                    <Text style={styles.big3Emoji}>{chartData.zodiacInfo.emoji}</Text>
                                    <Text style={styles.big3Role}>Güneş</Text>
                                    <Text style={styles.big3Sign}>{chartData.zodiacInfo.nameTr}</Text>
                                    <Text style={styles.big3Deg}>{apiChartData.sunDegree}°</Text>
                                </View>
                                <View style={styles.big3Col}>
                                    <Text style={styles.big3Emoji}>{chartData.moonInfo.emoji}</Text>
                                    <Text style={styles.big3Role}>Ay</Text>
                                    <Text style={styles.big3Sign}>{chartData.moonInfo.nameTr}</Text>
                                    <Text style={styles.big3Deg}>{apiChartData.moonDegree}°</Text>
                                </View>
                                <View style={styles.big3Col}>
                                    <Text style={styles.big3Emoji}>{chartData.risingInfo.emoji}</Text>
                                    <Text style={styles.big3Role}>Yükselen</Text>
                                    <Text style={styles.big3Sign}>{chartData.risingInfo.nameTr}</Text>
                                    <Text style={styles.big3Deg}>{apiChartData.risingDegree}°</Text>
                                </View>
                            </View>
                        </LinearGradient>

                        {/* Element Distribution */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Element Dengesi</Text>
                            {(
                                [
                                    { key: 'fire', label: 'Ateş', color: '#EF4444' },
                                    { key: 'earth', label: 'Toprak', color: '#10B981' },
                                    { key: 'air', label: 'Hava', color: '#3B82F6' },
                                    { key: 'water', label: 'Su', color: '#06B6D4' },
                                ] as const
                            ).map((el) => {
                                const val = chartData.elementDist[el.key] || 0;
                                return (
                                    <View key={el.key} style={styles.elRow}>
                                        <Text style={styles.elLabel}>{el.label}</Text>
                                        <View style={styles.elTrack}>
                                            <View
                                                style={[
                                                    styles.elFill,
                                                    { width: `${val}%`, backgroundColor: el.color },
                                                ]}
                                            />
                                        </View>
                                        <Text style={styles.elValue}>%{val}</Text>
                                    </View>
                                );
                            })}
                        </View>

                        {/* Individual Sign Readings */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>
                                ☀️ Güneş Burcun: {chartData.zodiacInfo.nameTr}
                            </Text>
                            <Text style={styles.readingText}>
                                {getSignDescription('sun', chartData.zodiacSign)}
                            </Text>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>
                                🌙 Ay Burcun: {chartData.moonInfo.nameTr}
                            </Text>
                            <Text style={styles.readingText}>
                                {getSignDescription('moon', chartData.moonSign)}
                            </Text>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>
                                ⬆️ Yükselen Burcun: {chartData.risingInfo.nameTr}
                            </Text>
                            <Text style={styles.readingText}>
                                {getSignDescription('rising', chartData.risingSign)}
                            </Text>
                        </View>
                    </>
                )}
            </ScrollView>

            <UpgradePrompt
                visible={showUpgradePrompt}
                onClose={() => setShowUpgradePrompt(false)}
                feature="Kişisel Doğum Haritası Analizi"
                description="Doğum saatin ve yerine göre Güneş, Ay ve Yükselen burç haritanı hesaplamak için 7 gün ücretsiz Premium dene."
            />
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
        scrollContent: {
            paddingHorizontal: 16,
            paddingBottom: 40,
            gap: 14,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 6,
        },
        backButton: {
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: theme.colors.backgroundCard,
            borderWidth: 1,
            borderColor: theme.colors.border,
            justifyContent: 'center',
            alignItems: 'center',
        },
        title: {
            fontSize: 20,
            fontWeight: '800',
            color: theme.colors.text,
        },
        headerSpacer: {
            width: 38,
        },
        editToggle: {
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: theme.colors.backgroundCard,
            borderWidth: 1,
            borderColor: theme.colors.border,
            justifyContent: 'center',
            alignItems: 'center',
        },
        loaderBox: {
            paddingVertical: 20,
            alignItems: 'center',
        },
        formCard: {
            backgroundColor: theme.colors.backgroundCard,
            borderRadius: 20,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.colors.border,
            gap: 8,
        },
        formHeading: {
            fontSize: 17,
            fontWeight: '800',
            color: theme.colors.text,
        },
        formSub: {
            fontSize: 13,
            color: theme.colors.textSecondary,
            marginBottom: 4,
        },
        label: {
            fontSize: 12.5,
            fontWeight: '700',
            color: theme.colors.textSecondary,
            marginTop: 6,
        },
        input: {
            backgroundColor: theme.colors.background,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 11,
            fontSize: 15,
            color: theme.colors.text,
        },
        chipsScroll: {
            gap: 6,
            paddingVertical: 2,
        },
        quickChip: {
            paddingHorizontal: 11,
            paddingVertical: 5,
            borderRadius: 12,
            backgroundColor: theme.colors.background,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        quickChipActive: {
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.primary,
        },
        quickChipText: {
            fontSize: 12,
            fontWeight: '600',
            color: theme.colors.textSecondary,
        },
        quickChipTextActive: {
            color: '#FFFFFF',
        },
        calculateButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: theme.colors.primary,
            borderRadius: 14,
            paddingVertical: 13,
            marginTop: 10,
        },
        calculateButtonText: {
            color: '#FFFFFF',
            fontSize: 15,
            fontWeight: '700',
        },
        summaryBanner: {
            borderRadius: 24,
            padding: 20,
            gap: 14,
        },
        summaryEyebrow: {
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 1,
            color: 'rgba(255,255,255,0.82)',
            textAlign: 'center',
        },
        big3Row: {
            flexDirection: 'row',
            justifyContent: 'space-around',
            gap: 8,
        },
        big3Col: {
            flex: 1,
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.14)',
            borderRadius: 16,
            paddingVertical: 12,
            paddingHorizontal: 6,
            gap: 3,
        },
        big3Emoji: {
            fontSize: 26,
        },
        big3Role: {
            fontSize: 11,
            color: 'rgba(255,255,255,0.82)',
            fontWeight: '600',
        },
        big3Sign: {
            fontSize: 14,
            fontWeight: '800',
            color: '#FFFFFF',
        },
        big3Deg: {
            fontSize: 11,
            color: '#FDE68A',
            fontWeight: '700',
        },
        card: {
            backgroundColor: theme.colors.backgroundCard,
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.colors.border,
            gap: 10,
        },
        cardTitle: {
            fontSize: 15.5,
            fontWeight: '800',
            color: theme.colors.text,
        },
        readingText: {
            fontSize: 14,
            color: theme.colors.textSecondary,
            lineHeight: 21,
        },
        elRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        elLabel: {
            width: 56,
            fontSize: 13,
            fontWeight: '600',
            color: theme.colors.text,
        },
        elTrack: {
            flex: 1,
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.colors.background,
            overflow: 'hidden',
        },
        elFill: {
            height: '100%',
            borderRadius: 4,
        },
        elValue: {
            width: 38,
            textAlign: 'right',
            fontSize: 12.5,
            fontWeight: '700',
            color: theme.colors.textSecondary,
        },
    });
