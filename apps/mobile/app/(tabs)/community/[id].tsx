import { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Share,
    RefreshControl,
    KeyboardAvoidingView,
    Platform,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { qnaService } from '@/services/api';
import {
    useQuestion,
    useAnswers,
    useQuestionComments,
    useCreateAnswer,
    useCreateQuestionComment,
    useCreateAnswerComment,
    useMarkBestAnswer,
    useVoteAnswer,
    useRemoveVote,
    useFavoriteQuestion,
    useUnfavoriteQuestion,
    useFollowQuestion,
    useUnfollowQuestion,
    useReportContent,
    useBlockUser,
} from '@/hooks/useQna';
import {
    AnswerCard,
    CommentList,
    CommentInput,
    AnswerInput,
    CategoryPill,
    TagChip,
    ShareSheet,
    ReportModal,
    RelatedQuestions,
    AnswerListSkeleton,
    ErrorState,
    EmptyState,
    OfflineBanner,
    OptimizedAvatar,
} from '@/components/qna';
import { createQuestionShareLink } from '@/utils/deepLinkHelpers';
import { VoteType, ContentType } from '@/types/qna';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export default function QuestionDetailScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuthStore();
    const { isConnected } = useNetworkStatus();

    // CRITICAL FIX: Always use a valid string for questionId to prevent hook count changes
    // Use 'INVALID_ID' instead of empty string to ensure hooks are always enabled with same count
    const questionId = typeof id === 'string' && id.length > 0 ? id : 'INVALID_ID';
    const hasValidId = typeof id === 'string' && id.length > 0;

    // State - ALL useState calls MUST be unconditional
    const [showComments, setShowComments] = useState(false);
    const [showAnswerInput, setShowAnswerInput] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [answerCommentsMap, setAnswerCommentsMap] = useState<Record<string, any[]>>({});
    const [showShareSheet, setShowShareSheet] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [shareContent, setShareContent] = useState<{ title: string; url: string } | null>(null);
    const [reportContent, setReportContent] = useState<{ id: string; type: ContentType } | null>(null);

    // Queries - MUST be called unconditionally with stable enabled flag
    // CRITICAL: Use hasValidId (stable boolean) instead of !!questionId to prevent hook count changes
    const { data: question, isLoading: questionLoading, refetch: refetchQuestion } = useQuestion(questionId, {
        enabled: hasValidId,
    });
    const scrollViewRef = useRef<ScrollView>(null);
    const answerSectionYRef = useRef<number>(0);

    const { data: answers = [], isLoading: answersLoading, refetch: refetchAnswers } = useAnswers(questionId, 'best', {
        enabled: hasValidId,
    });

    const fetchAllAnswerComments = useCallback(async (targetAnswers: typeof answers) => {
        if (targetAnswers.length === 0) return;
        const commentsMap: Record<string, any[]> = {};
        await Promise.all(
            targetAnswers.map(async (answer) => {
                try {
                    const list = await qnaService.getAnswerComments(answer.id);
                    commentsMap[answer.id] = list;
                } catch (error) {
                    console.error(`Failed to load comments for answer ${answer.id}:`, error);
                    commentsMap[answer.id] = [];
                }
            })
        );
        setAnswerCommentsMap(commentsMap);
    }, []);

    // Load comments for all answers when answers change
    useEffect(() => {
        if (answers.length > 0) {
            const answerIds = answers.map(a => a.id).sort().join(',');
            const currentIds = Object.keys(answerCommentsMap).sort().join(',');
            if (answerIds !== currentIds) {
                fetchAllAnswerComments(answers);
            }
        }
    }, [answers, answerCommentsMap, fetchAllAnswerComments]);
    const { data: comments = [], isLoading: commentsLoading, refetch: refetchComments } = useQuestionComments(questionId, {
        enabled: hasValidId,
    });

    // Mutations - MUST be called unconditionally
    const createAnswer = useCreateAnswer();
    const createQuestionComment = useCreateQuestionComment();
    const createAnswerComment = useCreateAnswerComment();
    const markBestAnswer = useMarkBestAnswer();
    const voteAnswer = useVoteAnswer();
    const removeVote = useRemoveVote();
    const favoriteQuestion = useFavoriteQuestion();
    const unfavoriteQuestion = useUnfavoriteQuestion();
    const followQuestion = useFollowQuestion();
    const unfollowQuestion = useUnfollowQuestion();
    const reportContentMutation = useReportContent();
    const blockUserMutation = useBlockUser();

    // Derived state - AFTER all hooks
    const isQuestionAuthor = Boolean(
        (question as any)?.isOwner ?? (user?.id && question?.userId && user.id === question.userId),
    );
    const answerCount = answers.length;
    const styles = createStyles(theme);

    // Check if user can answer (minimum 3 minutes between answers)
    const userLastAnswer = answers
        .filter(a => Boolean((a as any)?.isOwner ?? (user?.id && a.userId && a.userId === user.id)))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    const canAnswer = !userLastAnswer ||
        (Date.now() - new Date(userLastAnswer.createdAt).getTime()) >= 3 * 60 * 1000; // 3 minutes

    const timeUntilCanAnswer = userLastAnswer
        ? Math.ceil((3 * 60 * 1000 - (Date.now() - new Date(userLastAnswer.createdAt).getTime())) / 1000 / 60)
        : 0;

    // Track view count on mount - useEffect MUST be unconditional
    useEffect(() => {
        if (questionId) {
            // View count is tracked automatically by backend when fetching question
        }
    }, [questionId]);

    // Handlers
    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        const [, answersResult] = await Promise.all([
            refetchQuestion(),
            refetchAnswers(),
            refetchComments(),
        ]);
        if (answersResult?.data) {
            await fetchAllAnswerComments(answersResult.data);
        }
        setRefreshing(false);
    }, [refetchQuestion, refetchAnswers, refetchComments, fetchAllAnswerComments]);

    const handleSubmitAnswer = async (content: string, imageUrls?: string[]) => {
        // Check if user can answer
        if (!canAnswer) {
            Alert.alert(
                'Bekleyin',
                `Aynı soruya tekrar cevap verebilmek için ${timeUntilCanAnswer} dakika beklemelisiniz.`
            );
            return;
        }

        await createAnswer.mutateAsync({
            questionId: questionId,
            data: { content, imageUrls },
        });
        setShowAnswerInput(false);
        await Promise.all([refetchAnswers(), refetchQuestion()]);
        Alert.alert('Başarılı', 'Cevabınız gönderildi');
    };

    const handleSubmitQuestionComment = async (content: string) => {
        await createQuestionComment.mutateAsync({
            questionId: questionId,
            data: { content },
        });
        Alert.alert('Başarılı', 'Yorumunuz eklendi');
    };

    const handleSubmitAnswerComment = async (answerId: string, content: string) => {
        await createAnswerComment.mutateAsync({
            answerId,
            data: { content },
        });
        // Refresh answer comments
        const answerComments = await qnaService.getAnswerComments(answerId);
        setAnswerCommentsMap(prev => ({ ...prev, [answerId]: answerComments }));
    };

    const handleMarkBest = async (answerId: string) => {
        try {
            console.log('🎯 handleMarkBest called:', { answerId, questionId });

            // Check if user is the question author
            if (!isQuestionAuthor) {
                Alert.alert('Uyarı', 'Sadece soru sahibi en iyi cevabı seçebilir');
                return;
            }

            // Check if there's already a best answer
            const hasBestAnswer = answers.some(a => a.isBestAnswer);
            console.log('📊 Current answers state:', answers.map(a => ({ id: a.id, isBestAnswer: a.isBestAnswer })));

            if (hasBestAnswer) {
                Alert.alert(
                    'Dikkat',
                    'Zaten bir en iyi cevap seçilmiş. Değiştirmek istiyor musunuz?',
                    [
                        { text: 'İptal', style: 'cancel' },
                        {
                            text: 'Değiştir',
                            onPress: async () => {
                                try {
                                    console.log('🔄 Calling markBestAnswer API...');
                                    const result = await markBestAnswer.mutateAsync({ answerId, questionId: questionId });
                                    console.log('✅ API Success:', result);

                                    // Force immediate refetch to update UI
                                    await refetchAnswers();
                                    await refetchQuestion();

                                    Alert.alert('Başarılı', 'En iyi cevap güncellendi');
                                } catch (error: any) {
                                    console.error('❌ API Error:', error);
                                    const errorMessage = error.message || 'İşlem başarısız';
                                    Alert.alert('Hata', errorMessage);
                                }
                            },
                        },
                    ]
                );
            } else {
                console.log('🔄 Calling markBestAnswer API (first time)...');
                const result = await markBestAnswer.mutateAsync({ answerId, questionId: questionId });
                console.log('✅ API Success:', result);

                // Force immediate refetch to update UI
                await refetchAnswers();
                await refetchQuestion();

                Alert.alert('Başarılı', 'Cevap en iyi cevap olarak işaretlendi');
            }
        } catch (error: any) {
            const errorMessage = error.message || 'İşlem başarısız';

            if (errorMessage.includes('soru sahibi')) {
                Alert.alert('Uyarı', 'Sadece soru sahibi en iyi cevabı seçebilir');
            } else if (errorMessage.includes('bulunamadı')) {
                Alert.alert('Hata', 'Cevap veya soru bulunamadı');
            } else {
                Alert.alert('Hata', errorMessage);
            }
        }
    };

    const handleVote = async (answerId: string, voteType: VoteType) => {
        try {
            // Find the answer to check if it's user's own answer
            const answer = answers.find(a => a.id === answerId);
            if (!answer) return;

            // Check if user is trying to vote on their own answer
            if (Boolean((answer as any)?.isOwner ?? (user?.id && answer.userId && user.id === answer.userId))) {
                Alert.alert('Uyarı', 'Kendi cevabınıza oy veremezsiniz');
                return;
            }

            // Toggle off if tapping the currently active vote, otherwise vote / switch
            if (answer.userVote === voteType) {
                await removeVote.mutateAsync(answerId);
            } else {
                await voteAnswer.mutateAsync({ answerId, data: { voteType } });
            }
        } catch (error: any) {
            // Handle specific error messages
            const errorMessage = error.message || 'Oy verilemedi';

            if (errorMessage.includes('kendi cevabınıza')) {
                Alert.alert('Uyarı', 'Kendi cevabınıza oy veremezsiniz');
            } else if (errorMessage.includes('bulunamadı')) {
                Alert.alert('Hata', 'Cevap bulunamadı');
            } else {
                Alert.alert('Hata', errorMessage);
            }
        }
    };

    const handleFavorite = async () => {
        try {
            if (question?.isFavorited) {
                // Unfavorite (backend auto-unfollows)
                await unfavoriteQuestion.mutateAsync(questionId);
            } else {
                // Favorite (backend auto-follows)
                await favoriteQuestion.mutateAsync(questionId);
            }
        } catch (error: any) {
            Alert.alert('Hata', error.message || 'İşlem başarısız');
        }
    };

    const handleShare = () => {
        setShareContent({
            title: question?.title || '',
            url: createQuestionShareLink(questionId),
        });
        setShowShareSheet(true);
    };

    const handleShareAnswer = (answerId: string, answerContent: string) => {
        const preview = answerContent.length > 100
            ? answerContent.substring(0, 100) + '...'
            : answerContent;
        setShareContent({
            title: `${question?.title} - Cevap: ${preview}`,
            url: `${createQuestionShareLink(questionId)}#answer-${answerId}`,
        });
        setShowShareSheet(true);
    };

    const handleShareComplete = async () => {
        // Track share event
        try {
            await qnaService.trackShare(questionId);
        } catch (error) {
            console.error('Failed to track share:', error);
        }
    };

    const confirmBlockUser = (targetUserId: string, goBackOnSuccess = false) => {
        Alert.alert(
            'Kullanıcıyı Engelle',
            'Bu kullanıcıyı engellediğinizde soruları, cevapları ve yorumları artık size gösterilmeyecektir. Ayarlar > Engellenen Kullanıcılar bölümünden engeli kaldırabilirsiniz.',
            [
                { text: 'Vazgeç', style: 'cancel' },
                {
                    text: 'Engelle',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await blockUserMutation.mutateAsync({ targetUserId });
                            await Promise.all([refetchAnswers(), refetchComments()]);
                            Alert.alert('Engellendi', 'Kullanıcı engellendi.');
                            if (goBackOnSuccess) {
                                router.back();
                            }
                        } catch (error: any) {
                            Alert.alert('Hata', error?.message || 'Kullanıcı engellenemedi');
                        }
                    },
                },
            ],
        );
    };

    const handleReport = () => {
        if (!isQuestionAuthor && !question?.isAnonymous && question?.userId) {
            Alert.alert('Soru İşlemleri', 'Ne yapmak istersiniz?', [
                {
                    text: 'İçeriği Bildir',
                    onPress: () => {
                        setReportContent({
                            id: questionId,
                            type: ContentType.QUESTION,
                        });
                        setShowReportModal(true);
                    },
                },
                {
                    text: 'Kullanıcıyı Engelle',
                    style: 'destructive',
                    onPress: () => confirmBlockUser(question.userId, true),
                },
                { text: 'Vazgeç', style: 'cancel' },
            ]);
            return;
        }
        setReportContent({
            id: questionId,
            type: ContentType.QUESTION,
        });
        setShowReportModal(true);
    };

    const handleReportAnswer = (answerId: string, authorUserId?: string, isAnonymous?: boolean) => {
        if (authorUserId && !isAnonymous && authorUserId !== user?.id) {
            Alert.alert('Cevap İşlemleri', 'Ne yapmak istersiniz?', [
                {
                    text: 'Cevabı Bildir',
                    onPress: () => {
                        setReportContent({
                            id: answerId,
                            type: ContentType.ANSWER,
                        });
                        setShowReportModal(true);
                    },
                },
                {
                    text: 'Kullanıcıyı Engelle',
                    style: 'destructive',
                    onPress: () => confirmBlockUser(authorUserId, false),
                },
                { text: 'Vazgeç', style: 'cancel' },
            ]);
            return;
        }
        setReportContent({
            id: answerId,
            type: ContentType.ANSWER,
        });
        setShowReportModal(true);
    };

    const handleReportComment = (commentId: string) => {
        setReportContent({
            id: commentId,
            type: ContentType.COMMENT,
        });
        setShowReportModal(true);
    };

    const handleSubmitReport = async (reason: string, description?: string) => {
        if (!reportContent) return;

        const reportData = {
            contentId: reportContent.id,
            contentType: reportContent.type,
            reason,
            description,
        };

        console.log('📤 Sending report:', reportData);

        try {
            const result = await reportContentMutation.mutateAsync(reportData);
            console.log('✅ Report success:', result);
            Alert.alert('Başarılı', 'Raporunuz alındı. İnceleme yapılacaktır.');
        } catch (error: any) {
            console.error('❌ Report error:', error);
            console.error('Error details:', JSON.stringify(error, null, 2));
            Alert.alert('Hata', error.message || 'Rapor gönderilemedi');
        }
    };

    // Loading state - render after all hooks
    if (questionLoading) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <Stack.Screen options={{ title: 'Yükleniyor...' }} />
                <OfflineBanner />
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    <View style={styles.questionCard}>
                        <AnswerListSkeleton count={1} />
                    </View>
                    <View style={styles.answersSection}>
                        <AnswerListSkeleton count={2} />
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    // Error state - render after all hooks
    if (!question) {
        const errorType = !isConnected ? 'network' : 'not-found';
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <Stack.Screen options={{ title: 'Hata' }} />
                <OfflineBanner />
                <ErrorState
                    type={errorType}
                    title={errorType === 'not-found' ? 'Soru Bulunamadı' : undefined}
                    message={errorType === 'not-found' ? 'Bu soru silinmiş veya mevcut değil.' : undefined}
                    onRetry={errorType === 'network' ? () => refetchQuestion() : undefined}
                    showRetry={errorType === 'network'}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.topBar}>
                <TouchableOpacity
                    style={styles.topBarBackBtn}
                    onPress={() => router.back()}
                    activeOpacity={0.75}
                >
                    <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
                </TouchableOpacity>
                <View style={styles.topBarTitleWrap}>
                    <Text style={styles.topBarTitle} numberOfLines={1}>
                        {question?.title || 'Soru Detayı'}
                    </Text>
                    <Text style={styles.topBarSubtitle} numberOfLines={1}>
                        Topluluk Tartışması
                    </Text>
                </View>
                <View style={styles.topBarActions}>
                    <TouchableOpacity
                        style={styles.topBarIconBtn}
                        onPress={handleShare}
                        activeOpacity={0.75}
                    >
                        <Ionicons name="share-social-outline" size={19} color={theme.colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.topBarIconBtn}
                        onPress={handleReport}
                        activeOpacity={0.75}
                    >
                        <Ionicons name="flag-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </View>
            <OfflineBanner />
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 24}
            >
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={theme.colors.primary}
                        />
                    }
                >
                    {/* Question Card */}
                    <View style={styles.questionCard}>
                        {/* Author Info */}
                        <View style={styles.authorSection}>
                            <OptimizedAvatar
                                imageUrl={question.user?.profilePictureUrl}
                                displayName={question.user?.displayName}
                                size={44}
                                isAnonymous={question.isAnonymous}
                            />
                            <View style={styles.authorInfo}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.authorName}>
                                        {question.isAnonymous ? 'Anonim Kullanıcı' : question.user?.displayName}
                                    </Text>
                                    {!question.isAnonymous && (question.user?.isPremium || question.isPremium) && (
                                        <View style={styles.inlinePremiumBadge}>
                                            <Ionicons name="sparkles" size={10} color="#D97706" />
                                            <Text style={styles.inlinePremiumText}>PRO</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.timestamp}>{formatTimestamp(question.createdAt)}</Text>
                            </View>
                            {question.isPremium && (
                                <View style={styles.premiumBadge}>
                                    <Ionicons name="sparkles" size={11} color="#D97706" />
                                    <Text style={styles.premiumBadgeText}>Öne Çıkan</Text>
                                </View>
                            )}
                        </View>

                        {/* Title */}
                        <Text style={styles.questionTitle}>{question.title}</Text>

                        {/* Content */}
                        <Text style={styles.questionContent}>{question.content}</Text>

                        {/* Attached Images */}
                        {Array.isArray(question.imageUrls) && question.imageUrls.length > 0 && (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.questionImagesRow}
                            >
                                {question.imageUrls.map((uri, idx) => (
                                    <Image
                                        key={`${uri}-${idx}`}
                                        source={{ uri }}
                                        style={styles.questionImage}
                                        resizeMode="cover"
                                    />
                                ))}
                            </ScrollView>
                        )}

                        {/* Category and Tags */}
                        <View style={styles.tagsContainer}>
                            <CategoryPill category={question.category} />
                            {question.tags.map((tag) => (
                                <TagChip key={tag} tag={tag} />
                            ))}
                        </View>

                        {/* Stats */}
                        <View style={styles.statsRow}>
                            <View style={styles.stat}>
                                <Ionicons name="eye-outline" size={16} color={theme.colors.textSecondary} />
                                <Text style={styles.statText}>{question.viewCount} görüntülenme</Text>
                            </View>
                            <View style={styles.stat}>
                                <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.colors.textSecondary} />
                                <Text style={styles.statText}>{answerCount} cevap</Text>
                            </View>
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.actionButtons}>
                            <TouchableOpacity
                                style={[styles.actionButton, question.isFavorited && styles.actionButtonActive]}
                                onPress={handleFavorite}
                                activeOpacity={0.8}
                            >
                                <Ionicons
                                    name={question.isFavorited ? 'heart' : 'heart-outline'}
                                    size={17}
                                    color={question.isFavorited ? theme.colors.primary : theme.colors.textSecondary}
                                />
                                <Text style={[styles.actionButtonText, question.isFavorited && styles.actionButtonTextActive]}>
                                    {question.isFavorited ? 'Favorilerde' : 'Favorile'}
                                </Text>
                                {question.isFavorited && (
                                    <Ionicons name="notifications" size={13} color={theme.colors.primary} style={{ marginLeft: 2 }} />
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionButton} onPress={handleShare} activeOpacity={0.8}>
                                <Ionicons name="share-social-outline" size={17} color={theme.colors.textSecondary} />
                                <Text style={styles.actionButtonText}>Paylaş</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, styles.reportButton]}
                                onPress={handleReport}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="flag-outline" size={16} color="#ef4444" />
                                <Text style={[styles.actionButtonText, styles.reportButtonText]}>Bildir</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Comments Section */}
                        <View style={styles.commentsSection}>
                            <TouchableOpacity
                                style={styles.commentsHeader}
                                onPress={() => setShowComments(!showComments)}
                                activeOpacity={0.75}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons
                                        name={showComments ? 'chatbubbles' : 'chatbubbles-outline'}
                                        size={18}
                                        color={theme.colors.primary}
                                    />
                                    <Text style={styles.commentsTitle}>
                                        Yorumlar ({comments.length})
                                    </Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.primary }}>
                                        {showComments ? 'Gizle' : 'Yorum yap'}
                                    </Text>
                                    <Ionicons
                                        name={showComments ? 'chevron-up' : 'chevron-down'}
                                        size={18}
                                        color={theme.colors.primary}
                                    />
                                </View>
                            </TouchableOpacity>

                            {showComments && (
                                <>
                                    <CommentList
                                        comments={comments}
                                        loading={commentsLoading}
                                        onReportComment={handleReportComment}
                                    />
                                    <View style={styles.commentInputContainer}>
                                        <CommentInput
                                            onSubmit={handleSubmitQuestionComment}
                                            isSubmitting={createQuestionComment.isPending}
                                            placeholder="Soruya yorum yap..."
                                        />
                                    </View>
                                </>
                            )}
                        </View>
                    </View>

                    {/* Answers Section */}
                    <View
                        style={styles.answersSection}
                        onLayout={(e) => {
                            answerSectionYRef.current = e.nativeEvent.layout.y;
                        }}
                    >
                        <View style={styles.answersSectionHeader}>
                            <Text style={styles.sectionTitle}>
                                Cevaplar ({answerCount})
                            </Text>
                            <TouchableOpacity
                                style={[
                                    styles.answerButton,
                                    !canAnswer && styles.answerButtonDisabled
                                ]}
                                onPress={() => {
                                    if (!canAnswer) {
                                        Alert.alert(
                                            'Bekleyin',
                                            `Aynı soruya tekrar cevap verebilmek için ${timeUntilCanAnswer} dakika beklemelisiniz.`
                                        );
                                        return;
                                    }
                                    setShowAnswerInput(!showAnswerInput);
                                }}
                                disabled={!canAnswer}
                            >
                                <Ionicons
                                    name="add-circle-outline"
                                    size={18}
                                    color={canAnswer ? theme.colors.primary : theme.colors.textSecondary}
                                />
                                <Text style={[
                                    styles.answerButtonText,
                                    !canAnswer && styles.answerButtonTextDisabled
                                ]}>
                                    {canAnswer ? 'Cevap Ver' : `Bekleyin (${timeUntilCanAnswer}dk)`}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Answer Input */}
                        {showAnswerInput && (
                            <View
                                style={styles.answerInputContainer}
                                onLayout={() => {
                                    setTimeout(() => {
                                        scrollViewRef.current?.scrollTo({
                                            y: Math.max(0, answerSectionYRef.current - 16),
                                            animated: true,
                                        });
                                    }, 120);
                                }}
                            >
                                <AnswerInput
                                    onSubmit={handleSubmitAnswer}
                                    onCancel={() => setShowAnswerInput(false)}
                                    isSubmitting={createAnswer.isPending}
                                />
                            </View>
                        )}

                        {/* Answers List */}
                        {answersLoading ? (
                            <AnswerListSkeleton count={2} />
                        ) : answers.length === 0 ? (
                            <EmptyState
                                type="answers"
                                actionLabel="Cevap Ver"
                                onAction={() => setShowAnswerInput(true)}
                            />
                        ) : (
                            answers.map((answer, index) => (
                                <AnswerCard
                                    key={`${answer.id}-${answer.isBestAnswer}-${index}`}
                                    answer={answer}
                                    isQuestionAuthor={isQuestionAuthor}
                                    onMarkBest={
                                        isQuestionAuthor && !answer.isBestAnswer
                                            ? () => handleMarkBest(answer.id)
                                            : undefined
                                    }
                                    onVote={(voteType) => handleVote(answer.id, voteType)}
                                    onShare={() => handleShareAnswer(answer.id, answer.content)}
                                    onReport={() => handleReportAnswer(answer.id, answer.userId, (answer as any).isAnonymous)}
                                    onReportComment={(commentId) => handleReportComment(commentId)}
                                    comments={answerCommentsMap[answer.id] || []}
                                    onSubmitComment={(content) => handleSubmitAnswerComment(answer.id, content)}
                                    isSubmittingComment={createAnswerComment.isPending}
                                />
                            ))
                        )}
                    </View>

                    {/* Related Questions */}
                    {question && (
                        <RelatedQuestions
                            currentQuestionId={question.id}
                            category={question.category}
                            tags={question.tags}
                            limit={5}
                        />
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Share Sheet */}
            {shareContent && (
                <ShareSheet
                    visible={showShareSheet}
                    onClose={() => {
                        setShowShareSheet(false);
                        setShareContent(null);
                    }}
                    title={shareContent.title}
                    shareUrl={shareContent.url}
                    onShareComplete={handleShareComplete}
                />
            )}

            {/* Report Modal */}
            {reportContent && (
                <ReportModal
                    visible={showReportModal}
                    onClose={() => {
                        setShowReportModal(false);
                        setReportContent(null);
                    }}
                    contentId={reportContent.id}
                    contentType={reportContent.type}
                    onSubmit={handleSubmitReport}
                />
            )}
        </SafeAreaView>
    );
}

function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Şimdi';
    if (diffMins < 60) return `${diffMins} dk önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    if (diffDays < 7) return `${diffDays} gün önce`;

    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
    StyleSheet.create({
        safeArea: {
            flex: 1,
            backgroundColor: theme.colors.background,
        },
        topBar: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 14,
            paddingVertical: 10,
            backgroundColor: theme.colors.backgroundCard,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
            gap: 10,
        },
        topBarBackBtn: {
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: theme.colors.background,
            borderWidth: 1,
            borderColor: theme.colors.border,
            justifyContent: 'center',
            alignItems: 'center',
        },
        topBarTitleWrap: {
            flex: 1,
        },
        topBarTitle: {
            fontSize: 15.5,
            fontWeight: '700',
            color: theme.colors.text,
        },
        topBarSubtitle: {
            fontSize: 11.5,
            color: theme.colors.textSecondary,
            marginTop: 1,
        },
        topBarActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        topBarIconBtn: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: theme.colors.background,
            borderWidth: 1,
            borderColor: theme.colors.border,
            justifyContent: 'center',
            alignItems: 'center',
        },
        container: {
            flex: 1,
        },
        scrollView: {
            flex: 1,
        },
        scrollContent: {
            paddingBottom: 120,
        },
        headerButton: {
            padding: theme.spacing.sm,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: theme.spacing.xl,
        },
        errorContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: theme.spacing.xl,
        },
        errorText: {
            fontSize: 18,
            fontWeight: '600',
            color: theme.colors.text,
            marginTop: theme.spacing.md,
            marginBottom: theme.spacing.lg,
        },
        backButton: {
            backgroundColor: theme.colors.primary,
            paddingHorizontal: theme.spacing.xl,
            paddingVertical: theme.spacing.md,
            borderRadius: 12,
        },
        backButtonText: {
            fontSize: 16,
            fontWeight: '600',
            color: '#fff',
        },
        questionCard: {
            backgroundColor: theme.colors.backgroundCard,
            marginHorizontal: 14,
            marginTop: 12,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: theme.colors.border,
            padding: theme.spacing.lg,
            marginBottom: theme.spacing.sm,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 2,
        },
        authorSection: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: theme.spacing.md,
        },
        avatar: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: theme.colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
        },
        avatarText: {
            fontSize: 18,
            fontWeight: '700',
            color: '#fff',
        },
        anonymousAvatar: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: theme.colors.border,
            justifyContent: 'center',
            alignItems: 'center',
        },
        authorInfo: {
            flex: 1,
            marginLeft: theme.spacing.sm,
        },
        authorName: {
            fontSize: 15,
            fontWeight: '600',
            color: theme.colors.text,
        },
        timestamp: {
            fontSize: 12,
            color: theme.colors.textLight,
            marginTop: 2,
        },
        premiumBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: 'rgba(245, 158, 11, 0.14)',
            paddingHorizontal: 9,
            paddingVertical: 4,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: 'rgba(245, 158, 11, 0.28)',
        },
        premiumBadgeText: {
            fontSize: 11,
            fontWeight: '700',
            color: '#D97706',
        },
        questionTitle: {
            fontSize: 22,
            fontWeight: '700',
            color: theme.colors.text,
            lineHeight: 30,
            marginBottom: theme.spacing.md,
        },
        questionContent: {
            fontSize: 16,
            color: theme.colors.text,
            lineHeight: 24,
            marginBottom: theme.spacing.lg,
        },
        inlinePremiumBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            backgroundColor: 'rgba(245, 158, 11, 0.16)',
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: 'rgba(245, 158, 11, 0.32)',
        },
        inlinePremiumText: {
            fontSize: 9.5,
            fontWeight: '800',
            color: '#D97706',
        },
        questionImagesRow: {
            flexDirection: 'row',
            gap: 10,
            marginBottom: theme.spacing.md,
        },
        questionImage: {
            width: 160,
            height: 160,
            borderRadius: 12,
            backgroundColor: theme.colors.backgroundSecondary,
        },
        tagsContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.xs,
            marginBottom: theme.spacing.lg,
        },
        statsRow: {
            flexDirection: 'row',
            gap: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: theme.colors.border,
            marginBottom: theme.spacing.md,
        },
        stat: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        statText: {
            fontSize: 14,
            color: theme.colors.textSecondary,
        },
        actionButtons: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
            marginBottom: theme.spacing.lg,
        },
        actionButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderRadius: 12,
            backgroundColor: theme.colors.background,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        actionButtonActive: {
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            borderColor: theme.colors.primary,
        },
        actionButtonText: {
            fontSize: 13,
            fontWeight: '500',
            color: theme.colors.textSecondary,
        },
        actionButtonTextActive: {
            color: theme.colors.primary,
        },
        reportButton: {
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderColor: '#ef4444',
        },
        reportButtonText: {
            color: '#ef4444',
            fontWeight: '600',
        },
        commentsSection: {
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            paddingTop: theme.spacing.md,
        },
        commentsHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing.md,
        },
        commentsTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.colors.text,
        },
        commentInputContainer: {
            marginTop: theme.spacing.md,
        },
        answersSection: {
            padding: theme.spacing.lg,
        },
        answersSectionHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing.lg,
        },
        sectionTitle: {
            fontSize: 20,
            fontWeight: '700',
            color: theme.colors.text,
        },
        answerButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderRadius: 12,
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
        },
        answerButtonDisabled: {
            backgroundColor: theme.colors.background,
            opacity: 0.5,
        },
        answerButtonText: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.colors.primary,
        },
        answerButtonTextDisabled: {
            color: theme.colors.textSecondary,
        },
        answerInputContainer: {
            marginBottom: theme.spacing.lg,
        },
        emptyContainer: {
            alignItems: 'center',
            padding: theme.spacing.xl,
        },
        emptyText: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.colors.textSecondary,
            marginTop: theme.spacing.md,
        },
        emptySubtext: {
            fontSize: 14,
            color: theme.colors.textLight,
            marginTop: theme.spacing.xs,
        },
    });
