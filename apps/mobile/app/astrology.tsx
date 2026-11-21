import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useAuthStore } from '@/store/authStore';
import { getZodiacSign, parseBirthDateSafe, ZODIAC_SIGNS, ZodiacSign } from '@/utils/astrology';
import { astrologyApi, HoroscopeEntry } from '@/services/astrologyApi';

type Period = 'daily' | 'weekly' | 'monthly';
type ElementFilter = 'all' | 'fire' | 'earth' | 'air' | 'water';

const ALL_SIGNS: ZodiacSign[] = [
    'aries', 'taurus', 'gemini', 'cancer',
    'leo', 'virgo', 'libra', 'scorpio',
    'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

const ELEMENT_FILTERS: Array<{ id: ElementFilter; label: string; color: string }> = [
    { id: 'all', label: 'Tümü', color: '#EC4899' },
    { id: 'fire', label: 'Ateş', color: '#EF4444' },
    { id: 'earth', label: 'Toprak', color: '#10B981' },
    { id: 'air', label: 'Hava', color: '#3B82F6' },
    { id: 'water', label: 'Su', color: '#06B6D4' },
];

export default function AstrologyScreen() {
    const theme = useTheme();
    const { flags } = useFeatureFlags();
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();

    const [selectedPeriod, setSelectedPeriod] = useState<Period>('daily');
    const [elementFilter, setElementFilter] = useState<ElementFilter>('all');
    const [previewSign, setPreviewSign] = useState<ZodiacSign | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const { data: cosmic, refetch: refetchCosmic } = useQuery({
        queryKey: ['astrology', 'cosmic'],
        queryFn: () => astrologyApi.getCosmicOverview(),
        enabled: isAuthenticated,
        staleTime: 5 * 60 * 1000,
    });

    const { data: myChart, refetch: refetchChart } = useQuery({
        queryKey: ['astrology', 'my-birth-chart'],
        queryFn: () => astrologyApi.getMyBirthChart(),
        enabled: isAuthenticated,
        staleTime: 5 * 60 * 1000,
    });

    const userBirthDate = user?.profile?.dateOfBirth
        ? parseBirthDateSafe(user.profile.dateOfBirth)
        : null;
    const derivedSign: ZodiacSign | null =
        (userBirthDate ? getZodiacSign(userBirthDate) : null) ||
        (myChart?.sunSign as ZodiacSign) ||
        null;

    const activeSign: ZodiacSign = previewSign || derivedSign || 'libra';
    const activeSignInfo = ZODIAC_SIGNS[activeSign];

    const {
        data: activeHoroscope,
        isLoading: horoscopeLoading,
        refetch: refetchHoroscope,
    } = useQuery({
        queryKey: ['astrology', 'horoscope', activeSign, selectedPeriod],
        queryFn: () => astrologyApi.getHoroscopes(selectedPeriod, activeSign) as Promise<HoroscopeEntry | null>,
        enabled: isAuthenticated,
        staleTime: 5 * 60 * 1000,
    });

    const filteredSigns = useMemo(() => {
        if (elementFilter === 'all') return ALL_SIGNS;
        return ALL_SIGNS.filter((s) => ZODIAC_SIGNS[s].element === elementFilter);
    }, [elementFilter]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refetchCosmic(), refetchChart(), refetchHoroscope()]);
        setRefreshing(false);
    }, [refetchCosmic, refetchChart, refetchHoroscope]);

    const styles = createStyles(theme);

    const renderStars = (score: number) => (
        <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((i) => (
                <Ionicons
                    key={i}
                    name={i <= score ? 'star' : 'star-outline'}
                    size={11}
                    color={i <= score ? '#FBBF24' : 'rgba(255,255,255,0.35)'}
                />
            ))}
        </View>
    );

    if (flags.astrology_enabled === false) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 }}>
                    <Ionicons name="planet-outline" size={48} color={theme.colors.primary} />
                    <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text, textAlign: 'center' }}>
                        Astroloji Geçici Olarak Kapalı
                    </Text>
                    <Text style={{ fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 }}>
                        Astroloji ve doğum haritası modülü yönetici tarafından geçici olarak devre dışı bırakıldı.
                    </Text>
                    <TouchableOpacity
                        style={{ backgroundColor: theme.colors.primary, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12, marginTop: 6 }}
                        onPress={() => router.back()}
                    >
                        <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Geri Dön</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={theme.colors.primary}
                    />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.title}>Astroloji</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.chartPillButton}
                        onPress={() => router.push('/astrology/birth-chart')}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="planet-outline" size={15} color={theme.colors.primary} />
                        <Text style={styles.chartPillText}>Haritam</Text>
                    </TouchableOpacity>
                </View>

                {/* Cosmic Sky & Moon Phase Banner (Admin-managed) */}
                <LinearGradient
                    colors={theme.isDark ? ['#1E1B4B', '#4C1D95'] : ['#312E81', '#7C3AED']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cosmicCard}
                >
                    <View style={styles.cosmicTopRow}>
                        <View style={styles.moonPill}>
                            <Ionicons name="moon" size={13} color="#FDE68A" />
                            <Text style={styles.moonPillText}>
                                {cosmic?.moonPhase || 'İlk Dördün'} • {cosmic?.moonSign || 'Balık'}
                            </Text>
                        </View>
                        <View style={styles.energyBadge}>
                            <Ionicons name="sparkles" size={12} color="#FFFFFF" />
                            <Text style={styles.energyBadgeText}>
                                Enerji %{cosmic?.energyIndex ?? 86}
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.cosmicThemeTitle}>
                        {cosmic?.cosmicTheme || 'Sezgisel Dengelenme ve Nazik Başlangıçlar'}
                    </Text>

                    {cosmic?.retrogradeNote && (
                        <Text style={styles.cosmicRetroNote}>{cosmic.retrogradeNote}</Text>
                    )}

                    <View style={styles.affirmationBox}>
                        <Text style={styles.affirmationLabel}>GÜNÜN OLUMLAMASI</Text>
                        <Text style={styles.affirmationText}>
                            “{cosmic?.dailyAffirmation || 'Bedenimin ritmine kulak veriyor, bugünü huzurla kucaklıyorum.'}”
                        </Text>
                    </View>
                </LinearGradient>

                {/* Personal Zodiac Hero Card */}
                <LinearGradient
                    colors={
                        theme.isDark
                            ? ['#581C87', '#831843']
                            : ['#EC4899', '#8B5CF6']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroSignCard}
                >
                    <View style={styles.heroSignTop}>
                        <View style={styles.heroSignIdentity}>
                            <View style={styles.heroEmblemCircle}>
                                <Text style={styles.heroEmblem}>{activeSignInfo.emoji}</Text>
                            </View>
                            <View>
                                <View style={styles.heroTagRow}>
                                    <Text style={styles.heroEyebrow}>
                                        {derivedSign && !previewSign ? 'SENİN BURCUN' : 'SEÇİLİ BURÇ'}
                                    </Text>
                                </View>
                                <Text style={styles.heroSignName}>{activeSignInfo.nameTr}</Text>
                                <Text style={styles.heroSignDates}>
                                    {activeSignInfo.dates} • {activeSignInfo.rulingPlanet}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.detailButton}
                            onPress={() => router.push(`/astrology/${activeSign}`)}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.detailButtonText}>Detay</Text>
                            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    {/* Saved Big 3 Badges if available */}
                    {myChart && (
                        <View style={styles.big3Row}>
                            <View style={styles.big3Pill}>
                                <Text style={styles.big3Text}>
                                    ☀️ {ZODIAC_SIGNS[myChart.sunSign as ZodiacSign]?.nameTr || myChart.sunSign}
                                </Text>
                            </View>
                            <View style={styles.big3Pill}>
                                <Text style={styles.big3Text}>
                                    🌙 {ZODIAC_SIGNS[myChart.moonSign as ZodiacSign]?.nameTr || myChart.moonSign}
                                </Text>
                            </View>
                            <View style={styles.big3Pill}>
                                <Text style={styles.big3Text}>
                                    ⬆️ {ZODIAC_SIGNS[myChart.risingSign as ZodiacSign]?.nameTr || myChart.risingSign}
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Period Segmented Switch */}
                    <View style={styles.periodSegmented}>
                        {(['daily', 'weekly', 'monthly'] as const).map((p) => {
                            const active = selectedPeriod === p;
                            const label = p === 'daily' ? 'Günlük' : p === 'weekly' ? 'Haftalık' : 'Aylık';
                            return (
                                <TouchableOpacity
                                    key={p}
                                    style={[styles.periodSegment, active && styles.periodSegmentActive]}
                                    onPress={() => setSelectedPeriod(p)}
                                    activeOpacity={0.8}
                                >
                                    <Text
                                        style={[
                                            styles.periodSegmentText,
                                            active && styles.periodSegmentTextActive,
                                        ]}
                                    >
                                        {label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Dynamic Horoscope Content */}
                    {horoscopeLoading ? (
                        <View style={styles.heroLoader}>
                            <ActivityIndicator color="#FFFFFF" size="small" />
                        </View>
                    ) : (
                        <>
                            {activeHoroscope?.title && (
                                <Text style={styles.horoscopeHeadline}>
                                    {activeHoroscope.title}
                                </Text>
                            )}
                            <Text style={styles.horoscopeSummary}>
                                {activeHoroscope?.summary ||
                                    'Bugün iç sesinize kulak verip kendinize şefkat göstermeye odaklanın.'}
                            </Text>

                            {/* Mini Scores */}
                            <View style={styles.scoresGrid}>
                                <View style={styles.scoreMiniCard}>
                                    <Text style={styles.scoreMiniLabel}>Aşk</Text>
                                    {renderStars(activeHoroscope?.loveScore ?? 4)}
                                </View>
                                <View style={styles.scoreMiniCard}>
                                    <Text style={styles.scoreMiniLabel}>Kariyer</Text>
                                    {renderStars(activeHoroscope?.careerScore ?? 4)}
                                </View>
                                <View style={styles.scoreMiniCard}>
                                    <Text style={styles.scoreMiniLabel}>Sağlık</Text>
                                    {renderStars(activeHoroscope?.healthScore ?? 4)}
                                </View>
                            </View>

                            {/* Lucky Chips */}
                            <View style={styles.luckyRow}>
                                <View style={styles.luckyChip}>
                                    <Ionicons name="sparkles-outline" size={12} color="#FDE68A" />
                                    <Text style={styles.luckyChipText}>
                                        Sayı: {activeHoroscope?.luckyNumber ?? 7}
                                    </Text>
                                </View>
                                <View style={styles.luckyChip}>
                                    <Ionicons name="color-palette-outline" size={12} color="#FDE68A" />
                                    <Text style={styles.luckyChipText}>
                                        {activeHoroscope?.luckyColor ?? 'Gül Kurusu'}
                                    </Text>
                                </View>
                                {activeHoroscope?.luckyStone && (
                                    <View style={styles.luckyChip}>
                                        <Ionicons name="diamond-outline" size={12} color="#FDE68A" />
                                        <Text style={styles.luckyChipText}>
                                            {activeHoroscope.luckyStone}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </>
                    )}

                    {!derivedSign && (
                        <TouchableOpacity
                            style={styles.setupDobPrompt}
                            onPress={() => router.push('/settings/profile')}
                        >
                            <Ionicons name="calendar-outline" size={14} color="#FFFFFF" />
                            <Text style={styles.setupDobText}>
                                Kişisel burcun için profiline doğum tarihi ekle →
                            </Text>
                        </TouchableOpacity>
                    )}
                </LinearGradient>

                {/* Cosmic Tools Row */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Kozmik Araçlar</Text>
                    <View style={styles.toolsRow}>
                        <TouchableOpacity
                            style={styles.toolTile}
                            onPress={() => router.push('/astrology/compatibility')}
                            activeOpacity={0.85}
                        >
                            <View style={[styles.toolIconCircle, { backgroundColor: 'rgba(236, 72, 153, 0.14)' }]}>
                                <Ionicons name="heart" size={22} color="#EC4899" />
                            </View>
                            <Text style={styles.toolTitle}>Aşk Uyumu</Text>
                            <Text style={styles.toolDesc}>İki burcun ilişki ve iletişim uyumu</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.toolTile}
                            onPress={() => router.push('/astrology/birth-chart')}
                            activeOpacity={0.85}
                        >
                            <View style={[styles.toolIconCircle, { backgroundColor: 'rgba(139, 92, 246, 0.14)' }]}>
                                <Ionicons name="planet" size={22} color="#8B5CF6" />
                            </View>
                            <Text style={styles.toolTitle}>Doğum Haritası</Text>
                            <Text style={styles.toolDesc}>Güneş, Ay ve Yükselen analizi</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* All 12 Zodiac Signs with Element Filter */}
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Tüm Burçlar</Text>
                        <Text style={styles.sectionHint}>İncelemek için dokun</Text>
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.elementScroll}
                    >
                        {ELEMENT_FILTERS.map((el) => {
                            const isActive = elementFilter === el.id;
                            return (
                                <TouchableOpacity
                                    key={el.id}
                                    style={[
                                        styles.elementChip,
                                        isActive && { backgroundColor: el.color, borderColor: el.color },
                                    ]}
                                    onPress={() => setElementFilter(el.id)}
                                    activeOpacity={0.8}
                                >
                                    <Text
                                        style={[
                                            styles.elementChipText,
                                            isActive && styles.elementChipTextActive,
                                        ]}
                                    >
                                        {el.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <View style={styles.zodiacGrid}>
                        {filteredSigns.map((sign) => {
                            const info = ZODIAC_SIGNS[sign];
                            const isCurrent = sign === activeSign;
                            return (
                                <TouchableOpacity
                                    key={sign}
                                    style={[
                                        styles.zodiacCard,
                                        isCurrent && { borderColor: info.color, borderWidth: 1.5 },
                                    ]}
                                    onPress={() => router.push(`/astrology/${sign}`)}
                                    onLongPress={() => setPreviewSign(sign)}
                                    activeOpacity={0.8}
                                >
                                    <View
                                        style={[
                                            styles.zodiacSymbolBg,
                                            { backgroundColor: `${info.color}1A` },
                                        ]}
                                    >
                                        <Text style={styles.zodiacCardEmoji}>{info.emoji}</Text>
                                    </View>
                                    <Text style={styles.zodiacCardName}>{info.nameTr}</Text>
                                    <Text style={styles.zodiacCardDates} numberOfLines={1}>
                                        {info.dates}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
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
        headerCenter: {
            flex: 1,
            alignItems: 'center',
        },
        title: {
            fontSize: 21,
            fontWeight: '800',
            color: theme.colors.text,
            letterSpacing: -0.3,
        },
        chartPillButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            backgroundColor: theme.colors.backgroundCard,
            borderWidth: 1,
            borderColor: theme.colors.border,
            paddingHorizontal: 11,
            paddingVertical: 7,
            borderRadius: 18,
        },
        chartPillText: {
            fontSize: 12.5,
            fontWeight: '700',
            color: theme.colors.primary,
        },
        cosmicCard: {
            borderRadius: 22,
            padding: 18,
            gap: 10,
            shadowColor: '#4C1D95',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.2,
            shadowRadius: 14,
            elevation: 5,
        },
        cosmicTopRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
        },
        moonPill: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: 'rgba(255,255,255,0.16)',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 12,
        },
        moonPillText: {
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: '700',
        },
        energyBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: 'rgba(255,255,255,0.2)',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 12,
        },
        energyBadgeText: {
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: '700',
        },
        cosmicThemeTitle: {
            fontSize: 18,
            fontWeight: '800',
            color: '#FFFFFF',
            lineHeight: 24,
        },
        cosmicRetroNote: {
            fontSize: 12.5,
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 18,
        },
        affirmationBox: {
            backgroundColor: 'rgba(255,255,255,0.12)',
            borderRadius: 14,
            padding: 12,
            marginTop: 2,
        },
        affirmationLabel: {
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 0.8,
            color: '#FDE68A',
            marginBottom: 4,
        },
        affirmationText: {
            fontSize: 13.5,
            color: '#FFFFFF',
            fontStyle: 'italic',
            lineHeight: 19,
        },
        heroSignCard: {
            borderRadius: 24,
            padding: 18,
            gap: 14,
            shadowColor: '#EC4899',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.22,
            shadowRadius: 14,
            elevation: 6,
        },
        heroSignTop: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        heroSignIdentity: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            flex: 1,
        },
        heroEmblemCircle: {
            width: 54,
            height: 54,
            borderRadius: 27,
            backgroundColor: 'rgba(255,255,255,0.2)',
            justifyContent: 'center',
            alignItems: 'center',
        },
        heroEmblem: {
            fontSize: 28,
        },
        heroTagRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        heroEyebrow: {
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 0.9,
            color: 'rgba(255,255,255,0.8)',
        },
        heroSignName: {
            fontSize: 22,
            fontWeight: '800',
            color: '#FFFFFF',
        },
        heroSignDates: {
            fontSize: 12,
            color: 'rgba(255,255,255,0.88)',
            marginTop: 1,
        },
        detailButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: 'rgba(255,255,255,0.22)',
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 14,
        },
        detailButtonText: {
            color: '#FFFFFF',
            fontSize: 12.5,
            fontWeight: '700',
        },
        big3Row: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
        },
        big3Pill: {
            backgroundColor: 'rgba(255,255,255,0.16)',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 12,
        },
        big3Text: {
            color: '#FFFFFF',
            fontSize: 11.5,
            fontWeight: '700',
        },
        periodSegmented: {
            flexDirection: 'row',
            backgroundColor: 'rgba(0,0,0,0.2)',
            borderRadius: 14,
            padding: 3,
            gap: 3,
        },
        periodSegment: {
            flex: 1,
            paddingVertical: 7,
            borderRadius: 11,
            alignItems: 'center',
        },
        periodSegmentActive: {
            backgroundColor: '#FFFFFF',
        },
        periodSegmentText: {
            fontSize: 12.5,
            fontWeight: '700',
            color: 'rgba(255,255,255,0.85)',
        },
        periodSegmentTextActive: {
            color: '#7C3AED',
        },
        heroLoader: {
            paddingVertical: 20,
            alignItems: 'center',
        },
        horoscopeHeadline: {
            fontSize: 16,
            fontWeight: '800',
            color: '#FFFFFF',
        },
        horoscopeSummary: {
            fontSize: 14,
            color: 'rgba(255,255,255,0.95)',
            lineHeight: 21,
        },
        scoresGrid: {
            flexDirection: 'row',
            gap: 8,
        },
        scoreMiniCard: {
            flex: 1,
            backgroundColor: 'rgba(255,255,255,0.14)',
            borderRadius: 12,
            paddingVertical: 8,
            paddingHorizontal: 8,
            alignItems: 'center',
            gap: 4,
        },
        scoreMiniLabel: {
            fontSize: 11,
            fontWeight: '700',
            color: 'rgba(255,255,255,0.9)',
        },
        starsRow: {
            flexDirection: 'row',
            gap: 2,
        },
        luckyRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        luckyChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            backgroundColor: 'rgba(255,255,255,0.16)',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 12,
        },
        luckyChipText: {
            color: '#FFFFFF',
            fontSize: 11.5,
            fontWeight: '600',
        },
        setupDobPrompt: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.2)',
        },
        setupDobText: {
            fontSize: 12,
            color: '#FFFFFF',
            fontWeight: '600',
        },
        section: {
            gap: 10,
        },
        sectionHeaderRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        sectionTitle: {
            fontSize: 17,
            fontWeight: '800',
            color: theme.colors.text,
        },
        sectionHint: {
            fontSize: 12,
            color: theme.colors.textLight,
            fontWeight: '500',
        },
        toolsRow: {
            flexDirection: 'row',
            gap: 12,
        },
        toolTile: {
            flex: 1,
            backgroundColor: theme.colors.backgroundCard,
            borderRadius: 18,
            padding: 15,
            borderWidth: 1,
            borderColor: theme.colors.border,
            gap: 8,
        },
        toolIconCircle: {
            width: 42,
            height: 42,
            borderRadius: 14,
            justifyContent: 'center',
            alignItems: 'center',
        },
        toolTitle: {
            fontSize: 15,
            fontWeight: '700',
            color: theme.colors.text,
        },
        toolDesc: {
            fontSize: 12,
            color: theme.colors.textSecondary,
            lineHeight: 17,
        },
        elementScroll: {
            gap: 8,
        },
        elementChip: {
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 16,
            backgroundColor: theme.colors.backgroundCard,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        elementChipText: {
            fontSize: 12.5,
            fontWeight: '600',
            color: theme.colors.textSecondary,
        },
        elementChipTextActive: {
            color: '#FFFFFF',
            fontWeight: '700',
        },
        zodiacGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 10,
        },
        zodiacCard: {
            width: '31%',
            backgroundColor: theme.colors.backgroundCard,
            borderRadius: 16,
            paddingVertical: 14,
            paddingHorizontal: 8,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: theme.colors.border,
            gap: 6,
        },
        zodiacSymbolBg: {
            width: 44,
            height: 44,
            borderRadius: 22,
            justifyContent: 'center',
            alignItems: 'center',
        },
        zodiacCardEmoji: {
            fontSize: 22,
        },
        zodiacCardName: {
            fontSize: 13.5,
            fontWeight: '700',
            color: theme.colors.text,
        },
        zodiacCardDates: {
            fontSize: 10,
            color: theme.colors.textLight,
            textAlign: 'center',
        },
    });
