import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useInfiniteQuestions, useQuestions, useFavoriteQuestions } from '@/hooks/useQna';
import { useQnaStore } from '@/store/qnaStore';
import { qnaService } from '@/services/api';
import {
    QuestionCard,
    QuestionListSkeleton,
    ErrorState,
    EmptyState,
    OfflineBanner,
    CategoryPill,
} from '@/components/qna';
import { QuestionCategory, QuestionStatus, Question } from '@/types/qna';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

type SortTab = 'recent' | 'popular' | 'unanswered' | 'favorites';

const SORT_OPTIONS: ReadonlyArray<{
    value: SortTab;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
}> = [
    { value: 'recent', label: 'En Yeni', icon: 'time-outline' },
    { value: 'popular', label: 'Popüler', icon: 'flame-outline' },
    { value: 'unanswered', label: 'Cevapsız', icon: 'help-circle-outline' },
    { value: 'favorites', label: 'Favoriler', icon: 'heart-outline' },
];

const CATEGORIES: ReadonlyArray<{
    value?: QuestionCategory;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
}> = [
    { value: undefined, label: 'Tümü', icon: 'sparkles-outline' },
    { value: QuestionCategory.MENSTRUAL_HEALTH, label: 'Adet', icon: 'water-outline' },
    { value: QuestionCategory.PREGNANCY, label: 'Hamilelik', icon: 'heart-outline' },
    { value: QuestionCategory.FERTILITY, label: 'Doğurganlık', icon: 'flower-outline' },
    { value: QuestionCategory.NUTRITION, label: 'Beslenme', icon: 'nutrition-outline' },
    { value: QuestionCategory.EXERCISE, label: 'Egzersiz', icon: 'fitness-outline' },
    { value: QuestionCategory.MENTAL_HEALTH, label: 'Ruh Sağlığı', icon: 'leaf-outline' },
    { value: QuestionCategory.SLEEP, label: 'Uyku', icon: 'moon-outline' },
    { value: QuestionCategory.PMS, label: 'PMS', icon: 'pulse-outline' },
    { value: QuestionCategory.GENERAL, label: 'Genel', icon: 'chatbubbles-outline' },
];

export default function CommunityIndexScreen() {
    const theme = useTheme();
    const router = useRouter();
    const queryClient = useQueryClient();

    useFocusEffect(
        useCallback(() => {
            const current = queryClient.getQueryData<{ unreadCount: number }>(['qna', 'unread-count']);
            if ((current?.unreadCount ?? 0) > 0) {
                queryClient.setQueryData(['qna', 'unread-count'], { unreadCount: 0 });
                qnaService.markNotificationsRead().catch(() => {});
            }
        }, [queryClient]),
    );
    const styles = createStyles(theme);
    const { isConnected } = useNetworkStatus();
    const { flags } = useFeatureFlags();

    const {
        filters,
        searchQuery,
        sortBy,
        setSortBy,
        selectedCategory,
        setSelectedCategory,
    } = useQnaStore();

    const [activeSortTab, setActiveSortTab] = useState<SortTab>(sortBy);
    const [selectedStatus, setSelectedStatus] = useState<QuestionStatus | undefined>(
        filters.status
    );

    const showingFavorites = activeSortTab === 'favorites';

    const queryFilters = useMemo(
        () => ({
            category: selectedCategory,
            status: selectedStatus,
            sort: showingFavorites ? 'recent' : activeSortTab,
            search: searchQuery,
            limit: 12,
        }),
        [selectedCategory, selectedStatus, activeSortTab, searchQuery, showingFavorites]
    );

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
        refetch,
        isRefetching,
    } = useInfiniteQuestions(queryFilters, {
        enabled: !showingFavorites,
    });

    const {
        data: favoritesData,
        isLoading: favoritesLoading,
        isError: favoritesError,
        refetch: refetchFavorites,
        isRefetching: isRefetchingFavorites,
    } = useFavoriteQuestions(1, 50, {
        enabled: showingFavorites,
    });

    const questions = useMemo(() => {
        if (showingFavorites) {
            return favoritesData?.questions || [];
        }
        return data?.pages.flatMap((page) => page.questions) || [];
    }, [data, favoritesData, showingFavorites]);

    const shouldShowSpotlight =
        !showingFavorites &&
        !searchQuery &&
        !selectedCategory &&
        !selectedStatus &&
        activeSortTab === 'recent';

    const popularQuestionsQuery = useQuestions(
        {
            sort: 'popular',
            limit: 5,
        },
        {
            staleTime: 10 * 60 * 1000,
            enabled: shouldShowSpotlight,
        }
    );

    const spotlightQuestions = popularQuestionsQuery.data?.questions || [];

    const handleLoadMore = useCallback(() => {
        if (!showingFavorites && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [showingFavorites, hasNextPage, isFetchingNextPage, fetchNextPage]);

    const handleRefresh = useCallback(() => {
        if (showingFavorites) {
            refetchFavorites();
        } else {
            refetch();
        }
        if (shouldShowSpotlight) {
            popularQuestionsQuery.refetch();
        }
    }, [refetch, refetchFavorites, showingFavorites, shouldShowSpotlight, popularQuestionsQuery]);

    const handleQuestionPress = useCallback(
        (question: Question) => {
            router.push({
                pathname: '/(tabs)/community/[id]' as any,
                params: { id: question.id },
            });
        },
        [router]
    );

    const handleAskQuestion = useCallback(() => {
        router.push('/(tabs)/community/ask' as any);
    }, [router]);

    const handleSortChange = useCallback(
        (tab: SortTab) => {
            setActiveSortTab(tab);
            if (tab !== 'favorites') {
                setSortBy(tab);
            }
        },
        [setSortBy]
    );

    const handleCategoryChange = useCallback(
        (category?: QuestionCategory) => {
            setSelectedCategory(category);
        },
        [setSelectedCategory]
    );

    const currentIsLoading = showingFavorites ? favoritesLoading : isLoading;
    const currentIsError = showingFavorites ? favoritesError : isError;
    const currentIsRefreshing = showingFavorites ? isRefetchingFavorites : isRefetching;

    const renderHeader = useCallback(
        () => (
            <View style={styles.header}>
                {/* Title Row */}
                <View style={styles.headerTop}>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>Topluluk</Text>
                        <Text style={styles.headerSubtitle}>
                            Kadın sağlığı soru & deneyim alanı
                        </Text>
                    </View>

                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => router.push('/(tabs)/community/my-questions' as any)}
                            activeOpacity={0.75}
                        >
                            <Ionicons name="person-outline" size={19} color={theme.colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() =>
                                router.push('/(tabs)/community/notification-preferences' as any)
                            }
                            activeOpacity={0.75}
                        >
                            <Ionicons
                                name="notifications-outline"
                                size={19}
                                color={theme.colors.text}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleAskQuestion}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={['#EC4899', '#8B5CF6']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.askButton}
                            >
                                <Ionicons name="add" size={18} color="#FFFFFF" />
                                <Text style={styles.askButtonText}>Soru Sor</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Search Trigger */}
                <TouchableOpacity
                    style={styles.searchBar}
                    onPress={() => router.push('/(tabs)/community/search' as any)}
                    activeOpacity={0.8}
                >
                    <Ionicons name="search-outline" size={18} color={theme.colors.textLight} />
                    <Text style={styles.searchPlaceholder}>
                        Soru, konu veya etiket ara...
                    </Text>
                    <Ionicons name="options-outline" size={17} color={theme.colors.textLight} />
                </TouchableOpacity>

                {/* Sort Pills */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.sortScroll}
                >
                    {SORT_OPTIONS.map((option) => {
                        const isActive = activeSortTab === option.value;
                        return (
                            <TouchableOpacity
                                key={option.value}
                                style={[styles.sortChip, isActive && styles.sortChipActive]}
                                onPress={() => handleSortChange(option.value)}
                                activeOpacity={0.8}
                            >
                                <Ionicons
                                    name={option.icon}
                                    size={14}
                                    color={isActive ? '#FFFFFF' : theme.colors.textSecondary}
                                />
                                <Text
                                    style={[
                                        styles.sortChipText,
                                        isActive && styles.sortChipTextActive,
                                    ]}
                                >
                                    {option.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* Direct Category Chips */}
                {!showingFavorites && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoriesScroll}
                    >
                        {CATEGORIES.map((cat) => {
                            const isSelected = selectedCategory === cat.value;
                            return (
                                <TouchableOpacity
                                    key={cat.label}
                                    style={[
                                        styles.categoryChip,
                                        isSelected && styles.categoryChipActive,
                                    ]}
                                    onPress={() => handleCategoryChange(cat.value)}
                                    activeOpacity={0.75}
                                >
                                    <Ionicons
                                        name={cat.icon}
                                        size={13}
                                        color={
                                            isSelected ? theme.colors.primary : theme.colors.textLight
                                        }
                                    />
                                    <Text
                                        style={[
                                            styles.categoryChipText,
                                            isSelected && styles.categoryChipTextActive,
                                        ]}
                                    >
                                        {cat.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}

                {/* Spotlight Carousel */}
                {shouldShowSpotlight && spotlightQuestions.length > 0 && (
                    <View style={styles.spotlightSection}>
                        <View style={styles.spotlightHeader}>
                            <View style={styles.spotlightTitleRow}>
                                <Ionicons name="flame" size={16} color="#F97316" />
                                <Text style={styles.spotlightHeading}>Öne Çıkan Tartışmalar</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => handleSortChange('popular')}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.seeAllText}>Tümü</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.spotlightScroll}
                        >
                            {spotlightQuestions.slice(0, 5).map((q) => (
                                <TouchableOpacity
                                    key={q.id}
                                    style={styles.spotlightCard}
                                    onPress={() => handleQuestionPress(q)}
                                    activeOpacity={0.85}
                                >
                                    <CategoryPill category={q.category} size="small" />
                                    <Text style={styles.spotlightCardTitle} numberOfLines={2}>
                                        {q.title}
                                    </Text>
                                    <View style={styles.spotlightCardFooter}>
                                        <View style={styles.spotlightStat}>
                                            <Ionicons
                                                name="chatbubble-outline"
                                                size={12}
                                                color={theme.colors.textSecondary}
                                            />
                                            <Text style={styles.spotlightStatText}>
                                                {q._count?.answers || 0}
                                            </Text>
                                        </View>
                                        <View style={styles.spotlightStat}>
                                            <Ionicons
                                                name="eye-outline"
                                                size={12}
                                                color={theme.colors.textSecondary}
                                            />
                                            <Text style={styles.spotlightStatText}>
                                                {q.viewCount}
                                            </Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Feed Section Label */}
                <View style={styles.feedTitleRow}>
                    <Text style={styles.feedTitle}>
                        {showingFavorites
                            ? 'Favori Sorularım'
                            : selectedCategory
                              ? CATEGORIES.find((c) => c.value === selectedCategory)?.label ||
                                'Sorular'
                              : 'Tüm Paylaşımlar'}
                    </Text>
                    <Text style={styles.feedCount}>{questions.length} konu</Text>
                </View>
            </View>
        ),
        [
            styles,
            theme.colors,
            router,
            handleAskQuestion,
            activeSortTab,
            handleSortChange,
            showingFavorites,
            selectedCategory,
            handleCategoryChange,
            shouldShowSpotlight,
            spotlightQuestions,
            handleQuestionPress,
            questions.length,
        ]
    );

    const renderEmpty = useCallback(() => {
        if (currentIsLoading) return <QuestionListSkeleton count={4} />;

        if (showingFavorites) {
            return (
                <EmptyState
                    type="favorites"
                    actionLabel="Soruları Keşfet"
                    onAction={() => handleSortChange('recent')}
                />
            );
        }

        return (
            <EmptyState
                type="questions"
                actionLabel="İlk Soruyu Sor"
                onAction={handleAskQuestion}
            />
        );
    }, [currentIsLoading, showingFavorites, handleSortChange, handleAskQuestion]);

    const renderFooter = useCallback(() => {
        if (!isFetchingNextPage) return null;
        return (
            <View style={styles.footer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
        );
    }, [isFetchingNextPage, styles.footer, theme.colors.primary]);

    const renderItem = useCallback(
        ({ item }: { item: Question }) => (
            <QuestionCard question={item} onPress={() => handleQuestionPress(item)} />
        ),
        [handleQuestionPress]
    );

    const keyExtractor = useCallback((item: Question) => item.id, []);

    if (currentIsError) {
        const errorType = !isConnected ? 'network' : 'server';
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <OfflineBanner />
                <ErrorState
                    type={errorType}
                    onRetry={() => (showingFavorites ? refetchFavorites() : refetch())}
                />
            </SafeAreaView>
        );
    }

    if (flags.community_enabled === false) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 }}>
                    <Ionicons name="people-outline" size={48} color={theme.colors.primary} />
                    <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text, textAlign: 'center' }}>
                        Topluluk Geçici Olarak Kapalı
                    </Text>
                    <Text style={{ fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 }}>
                        Topluluk alanı yönetici tarafından geçici olarak devre dışı bırakıldı.
                    </Text>
                    <TouchableOpacity
                        style={{ backgroundColor: theme.colors.primary, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12, marginTop: 6 }}
                        onPress={() => router.replace('/(tabs)/home' as any)}
                    >
                        <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Ana Sayfaya Dön</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <OfflineBanner />
            <FlatList
                data={questions}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmpty}
                ListFooterComponent={renderFooter}
                contentContainerStyle={styles.listContent}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.4}
                refreshControl={
                    <RefreshControl
                        refreshing={currentIsRefreshing}
                        onRefresh={handleRefresh}
                        tintColor={theme.colors.primary}
                    />
                }
                showsVerticalScrollIndicator={false}
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
        listContent: {
            paddingHorizontal: 16,
            paddingTop: 6,
            paddingBottom: 110,
            flexGrow: 1,
        },
        header: {
            gap: 12,
            marginBottom: 8,
        },
        headerTop: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
        },
        headerTitleContainer: {
            flex: 1,
        },
        headerTitle: {
            fontSize: 27,
            fontWeight: '800',
            color: theme.colors.text,
            letterSpacing: -0.4,
        },
        headerSubtitle: {
            fontSize: 12.5,
            color: theme.colors.textSecondary,
            marginTop: 2,
            fontWeight: '500',
        },
        headerActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        iconButton: {
            width: 38,
            height: 38,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.colors.backgroundCard,
            borderRadius: 19,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        askButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: theme.colors.primary,
            paddingHorizontal: 13,
            paddingVertical: 9,
            borderRadius: 19,
        },
        askButtonText: {
            fontSize: 13.5,
            fontWeight: '700',
            color: '#fff',
        },
        searchBar: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.backgroundCard,
            paddingHorizontal: 14,
            paddingVertical: 11,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.colors.border,
            gap: 10,
        },
        searchPlaceholder: {
            flex: 1,
            fontSize: 14,
            color: theme.colors.textLight,
        },
        sortScroll: {
            gap: 8,
        },
        sortChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 13,
            paddingVertical: 7,
            borderRadius: 18,
            backgroundColor: theme.colors.backgroundCard,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        sortChipActive: {
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.primary,
        },
        sortChipText: {
            fontSize: 13,
            fontWeight: '600',
            color: theme.colors.textSecondary,
        },
        sortChipTextActive: {
            color: '#FFFFFF',
            fontWeight: '700',
        },
        categoriesScroll: {
            gap: 8,
        },
        categoryChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 11,
            paddingVertical: 6,
            borderRadius: 14,
            backgroundColor: theme.colors.background,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        categoryChipActive: {
            backgroundColor: theme.colors.backgroundSecondary,
            borderColor: theme.colors.primary,
        },
        categoryChipText: {
            fontSize: 12,
            fontWeight: '600',
            color: theme.colors.textSecondary,
        },
        categoryChipTextActive: {
            color: theme.colors.primary,
            fontWeight: '700',
        },
        spotlightSection: {
            gap: 10,
            marginTop: 2,
        },
        spotlightHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        spotlightTitleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        spotlightHeading: {
            fontSize: 15,
            fontWeight: '700',
            color: theme.colors.text,
        },
        seeAllText: {
            fontSize: 13,
            fontWeight: '600',
            color: theme.colors.primary,
        },
        spotlightScroll: {
            gap: 10,
        },
        spotlightCard: {
            width: 236,
            backgroundColor: theme.colors.backgroundCard,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: theme.colors.border,
            justifyContent: 'space-between',
            gap: 10,
        },
        spotlightCardTitle: {
            fontSize: 14,
            fontWeight: '700',
            color: theme.colors.text,
            lineHeight: 19,
        },
        spotlightCardFooter: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        spotlightStat: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        spotlightStatText: {
            fontSize: 12,
            fontWeight: '600',
            color: theme.colors.textSecondary,
        },
        feedTitleRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 4,
        },
        feedTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.colors.text,
        },
        feedCount: {
            fontSize: 12.5,
            color: theme.colors.textLight,
            fontWeight: '600',
        },
        footer: {
            paddingVertical: 16,
            alignItems: 'center',
        },
    });
