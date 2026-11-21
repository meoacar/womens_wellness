import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { usePremium } from '@/hooks/usePremium';
import { UpgradePrompt } from '@/components/premium/UpgradePrompt';
import { useAuthStore } from '@/store/authStore';
import {
    getZodiacSign,
    ZODIAC_SIGNS,
    ZodiacSign,
    calculateCompatibility,
} from '@/utils/astrology';
import { astrologyApi, CompatibilityResult } from '@/services/astrologyApi';

const ALL_SIGNS: ZodiacSign[] = [
    'aries', 'taurus', 'gemini', 'cancer',
    'leo', 'virgo', 'libra', 'scorpio',
    'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

export default function CompatibilityScreen() {
    const theme = useTheme();
    const { isPremium } = usePremium();
    const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
    const router = useRouter();
    const { user } = useAuthStore();

    const defaultUserSign = user?.profile?.dateOfBirth
        ? getZodiacSign(user.profile.dateOfBirth)
        : 'libra';

    const [sign1, setSign1] = useState<ZodiacSign>(defaultUserSign);
    const [sign2, setSign2] = useState<ZodiacSign>('leo');
    const [result, setResult] = useState<CompatibilityResult | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        handleCalculate(sign1, sign2);
    }, []);

    const handleCalculate = async (s1: ZodiacSign, s2: ZodiacSign) => {
        setLoading(true);
        try {
            const res = await astrologyApi.calculateCompatibility(s1, s2);
            setResult(res);
        } catch {
            const fallbackScore = calculateCompatibility(s1, s2);
            setResult({
                sign1: s1,
                sign2: s2,
                overallScore: fallbackScore,
                loveScore: fallbackScore,
                communicationScore: Math.max(52, fallbackScore - 4),
                trustScore: Math.min(96, fallbackScore + 2),
                headline: fallbackScore >= 80 ? 'Doğal Kozmik Uyum' : 'Dengeli Bağ',
                advice: 'Birbirinizin güçlü yanlarını takdir ederek uyumunuzu derinleştirebilirsiniz.',
            });
        } finally {
            setLoading(false);
        }
    };

    const selectSign1 = (s: ZodiacSign) => {
        if (!isPremium) {
            setShowUpgradePrompt(true);
            return;
        }
        setSign1(s);
        handleCalculate(s, sign2);
    };

    const selectSign2 = (s: ZodiacSign) => {
        if (!isPremium) {
            setShowUpgradePrompt(true);
            return;
        }
        setSign2(s);
        handleCalculate(sign1, s);
    };

    const styles = createStyles(theme);
    const info1 = ZODIAC_SIGNS[sign1];
    const info2 = ZODIAC_SIGNS[sign2];

    const renderMeter = (label: string, value: number, color: string) => (
        <View style={styles.meterRow}>
            <Text style={styles.meterLabel}>{label}</Text>
            <View style={styles.meterTrack}>
                <View style={[styles.meterFill, { width: `${value}%`, backgroundColor: color }]} />
            </View>
            <Text style={styles.meterValue}>%{value}</Text>
        </View>
    );

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
                    <Text style={styles.title}>Aşk Uyumu</Text>
                    <View style={styles.headerSpacer} />
                </View>

                {/* Result Hero Card */}
                <LinearGradient
                    colors={theme.isDark ? ['#831843', '#4C1D95'] : ['#EC4899', '#8B5CF6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroCard}
                >
                    <View style={styles.pairRow}>
                        <View style={styles.pairItem}>
                            <View style={styles.pairCircle}>
                                <Text style={styles.pairEmoji}>{info1.emoji}</Text>
                            </View>
                            <Text style={styles.pairName}>{info1.nameTr}</Text>
                        </View>

                        <View style={styles.heartBadge}>
                            <Ionicons name="heart" size={18} color="#FFFFFF" />
                            <Text style={styles.overallPct}>
                                %{result?.overallScore ?? calculateCompatibility(sign1, sign2)}
                            </Text>
                        </View>

                        <View style={styles.pairItem}>
                            <View style={styles.pairCircle}>
                                <Text style={styles.pairEmoji}>{info2.emoji}</Text>
                            </View>
                            <Text style={styles.pairName}>{info2.nameTr}</Text>
                        </View>
                    </View>

                    {loading ? (
                        <ActivityIndicator color="#FFFFFF" style={{ marginVertical: 12 }} />
                    ) : result ? (
                        <>
                            <Text style={styles.resultHeadline}>{result.headline}</Text>
                            <Text style={styles.resultAdvice}>{result.advice}</Text>
                        </>
                    ) : null}
                </LinearGradient>

                {/* Detailed Breakdown Card */}
                {result && (
                    <View style={styles.breakdownCard}>
                        <Text style={styles.sectionTitle}>Uyum Dağılımı</Text>
                        {renderMeter('Aşk & Çekim', result.loveScore, '#EC4899')}
                        {renderMeter('İletişim', result.communicationScore, '#8B5CF6')}
                        {renderMeter('Güven & Bağ', result.trustScore, '#10B981')}
                    </View>
                )}

                {/* Sign 1 Selector */}
                <View style={styles.selectorSection}>
                    <Text style={styles.sectionTitle}>1. Burç ({info1.nameTr})</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.signScroll}
                    >
                        {ALL_SIGNS.map((s) => {
                            const item = ZODIAC_SIGNS[s];
                            const active = sign1 === s;
                            return (
                                <TouchableOpacity
                                    key={`s1-${s}`}
                                    style={[
                                        styles.signPill,
                                        active && {
                                            backgroundColor: item.color,
                                            borderColor: item.color,
                                        },
                                    ]}
                                    onPress={() => selectSign1(s)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.signPillEmoji}>{item.emoji}</Text>
                                    <Text
                                        style={[
                                            styles.signPillText,
                                            active && styles.signPillTextActive,
                                        ]}
                                    >
                                        {item.nameTr}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Sign 2 Selector */}
                <View style={styles.selectorSection}>
                    <Text style={styles.sectionTitle}>2. Burç ({info2.nameTr})</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.signScroll}
                    >
                        {ALL_SIGNS.map((s) => {
                            const item = ZODIAC_SIGNS[s];
                            const active = sign2 === s;
                            return (
                                <TouchableOpacity
                                    key={`s2-${s}`}
                                    style={[
                                        styles.signPill,
                                        active && {
                                            backgroundColor: item.color,
                                            borderColor: item.color,
                                        },
                                    ]}
                                    onPress={() => selectSign2(s)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.signPillEmoji}>{item.emoji}</Text>
                                    <Text
                                        style={[
                                            styles.signPillText,
                                            active && styles.signPillTextActive,
                                        ]}
                                    >
                                        {item.nameTr}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            </ScrollView>

            <UpgradePrompt
                visible={showUpgradePrompt}
                onClose={() => setShowUpgradePrompt(false)}
                feature="Sınırsız Burç Uyumu Analizi"
                description="İstediğin tüm burç eşleşmelerinde aşk, iletişim ve güven skorlarını hesaplamak için 7 gün ücretsiz Premium dene."
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
            gap: 16,
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
        heroCard: {
            borderRadius: 24,
            padding: 20,
            gap: 14,
            alignItems: 'center',
        },
        pairRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            paddingHorizontal: 8,
        },
        pairItem: {
            alignItems: 'center',
            gap: 6,
            width: 84,
        },
        pairCircle: {
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: 'rgba(255,255,255,0.2)',
            justifyContent: 'center',
            alignItems: 'center',
        },
        pairEmoji: {
            fontSize: 28,
        },
        pairName: {
            fontSize: 14,
            fontWeight: '700',
            color: '#FFFFFF',
        },
        heartBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: 'rgba(255,255,255,0.22)',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 22,
        },
        overallPct: {
            fontSize: 22,
            fontWeight: '800',
            color: '#FFFFFF',
        },
        resultHeadline: {
            fontSize: 17,
            fontWeight: '800',
            color: '#FFFFFF',
            textAlign: 'center',
        },
        resultAdvice: {
            fontSize: 13.5,
            color: 'rgba(255,255,255,0.92)',
            textAlign: 'center',
            lineHeight: 20,
        },
        breakdownCard: {
            backgroundColor: theme.colors.backgroundCard,
            borderRadius: 20,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.colors.border,
            gap: 12,
        },
        sectionTitle: {
            fontSize: 15.5,
            fontWeight: '800',
            color: theme.colors.text,
        },
        meterRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        meterLabel: {
            width: 88,
            fontSize: 13,
            fontWeight: '600',
            color: theme.colors.textSecondary,
        },
        meterTrack: {
            flex: 1,
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.colors.background,
            overflow: 'hidden',
        },
        meterFill: {
            height: '100%',
            borderRadius: 4,
        },
        meterValue: {
            width: 38,
            textAlign: 'right',
            fontSize: 13,
            fontWeight: '700',
            color: theme.colors.text,
        },
        selectorSection: {
            gap: 10,
        },
        signScroll: {
            gap: 8,
        },
        signPill: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 13,
            paddingVertical: 9,
            borderRadius: 16,
            backgroundColor: theme.colors.backgroundCard,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        signPillEmoji: {
            fontSize: 16,
        },
        signPillText: {
            fontSize: 13,
            fontWeight: '700',
            color: theme.colors.text,
        },
        signPillTextActive: {
            color: '#FFFFFF',
        },
    });
