import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { Answer, VoteType, AnswerComment } from '@/types/qna';
import { VoteButton } from './VoteButton';
import { CommentList } from './CommentList';
import { CommentInput } from './CommentInput';
import { OptimizedAvatar } from './OptimizedAvatar';
import { memo, useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { haptics } from '@/utils/haptics';
import { accessibility } from '@/utils/accessibility';

interface AnswerCardProps {
    answer: Answer;
    isQuestionAuthor: boolean;
    onMarkBest?: () => void;
    onVote: (type: VoteType) => void;
    onShare?: () => void;
    onReport?: () => void;
    onReportComment?: (commentId: string) => void;
    comments?: AnswerComment[];
    onSubmitComment?: (content: string) => Promise<void>;
    isSubmittingComment?: boolean;
}

export function AnswerCard({
    answer,
    isQuestionAuthor,
    onMarkBest,
    onVote,
    onShare,
    onReport,
    onReportComment,
    comments = [],
    onSubmitComment,
    isSubmittingComment = false,
}: AnswerCardProps) {

    const theme = useTheme();
    const styles = createStyles(theme);
    const { user } = useAuthStore();
    const [showComments, setShowComments] = useState(false);
    const [justOpenedComments, setJustOpenedComments] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    const commentCount = Math.max(comments.length, answer._count?.comments || 0);
    const isOwnAnswer = Boolean(
        (answer as any)?.isOwner ?? (user?.id && answer.userId && user.id === answer.userId),
    );

    // Fade in and slide up animation on mount
    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const handleMarkBest = () => {
        haptics.success();
        onMarkBest?.();
    };

    const handleShare = () => {
        haptics.light();
        onShare?.();
    };

    const handleReport = () => {
        haptics.warning();
        onReport?.();
    };

    const handleToggleComments = () => {
        haptics.selection();
        const next = !showComments;
        setShowComments(next);
        setJustOpenedComments(next);
    };

    return (
        <Animated.View
            style={{
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
            }}
        >
            <View
                style={[styles.container, answer.isBestAnswer && styles.bestAnswerContainer]}
            >
                {/* Best Answer Badge */}
                {answer.isBestAnswer && (
                    <View style={styles.bestAnswerBadge}>
                        <Text style={{ fontSize: 14 }}>✅</Text>
                        <Text style={styles.bestAnswerText}>En İyi Cevap</Text>
                    </View>
                )}

                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.authorInfo}>
                        <OptimizedAvatar
                            imageUrl={answer.user?.profilePictureUrl}
                            displayName={answer.user?.displayName}
                            size={36}
                            isAnonymous={false}
                        />
                        <View>
                            <Text style={styles.authorName}>{answer.user?.displayName || 'Anonim Kullanıcı'}</Text>
                            {answer.user?.reputation !== undefined && (
                                <Text style={styles.reputation}>
                                    {answer.user.reputation} puan
                                </Text>
                            )}
                        </View>
                    </View>
                    <Text style={styles.timestamp}>
                        {formatTimestamp(answer.createdAt)}
                    </Text>
                </View>

                {/* Content */}
                <Text style={styles.content}>{answer.content}</Text>

                {/* Actions */}
                <View style={styles.actions}>
                    <VoteButton
                        answerId={answer.id}
                        currentVote={answer.userVote || null}
                        voteCount={answer.voteCount}
                        onVote={onVote}
                        isOwnAnswer={isOwnAnswer}
                    />

                    {isOwnAnswer && (
                        <View style={styles.ownAnswerNote}>
                            <Text style={styles.ownAnswerNoteText}>Kendi cevabınız</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.actionButton, showComments && styles.actionButtonActive]}
                        onPress={handleToggleComments}
                        activeOpacity={0.7}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={`Yorumlar, ${commentCount} yorum`}
                        accessibilityHint={accessibility.getButtonHint('Yorumları görüntüle')}
                    >
                        <Ionicons
                            name={showComments ? 'chatbubble' : 'chatbubble-outline'}
                            size={15}
                            color={showComments ? theme.colors.primary : theme.colors.textSecondary}
                        />
                        <Text style={[styles.actionText, showComments && styles.actionTextActive]}>
                            {commentCount > 0 ? `${commentCount} yorum` : 'Yorum yap'}
                        </Text>
                    </TouchableOpacity>

                    {onShare && (
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={handleShare}
                            activeOpacity={0.7}
                            accessible={true}
                            accessibilityRole="button"
                            accessibilityLabel="Cevabı paylaş"
                            accessibilityHint={accessibility.getButtonHint('Cevabı paylaş')}
                        >
                            <Ionicons name="share-outline" size={16} color={theme.colors.textSecondary} />
                            <Text style={styles.actionText}>Paylaş</Text>
                        </TouchableOpacity>
                    )}

                    {onReport && (
                        <TouchableOpacity
                            style={[styles.actionButton, styles.reportButton]}
                            onPress={handleReport}
                            activeOpacity={0.7}
                            accessible={true}
                            accessibilityRole="button"
                            accessibilityLabel="Cevabı bildir"
                            accessibilityHint={accessibility.getButtonHint('Cevabı bildir')}
                        >
                            <Ionicons name="flag-outline" size={15} color="#ef4444" />
                            <Text style={[styles.actionText, styles.reportText]}>Bildir</Text>
                        </TouchableOpacity>
                    )}

                    {isQuestionAuthor && !answer.isBestAnswer && onMarkBest && (
                        <TouchableOpacity
                            style={styles.markBestButton}
                            onPress={handleMarkBest}
                            activeOpacity={0.7}
                            accessible={true}
                            accessibilityRole="button"
                            accessibilityLabel="En iyi cevap olarak işaretle"
                            accessibilityHint={accessibility.getButtonHint('Bu cevabı en iyi cevap olarak işaretle')}
                        >
                            <Ionicons name="checkmark-circle-outline" size={16} color={theme.colors.success} />
                            <Text style={styles.markBestText}>En iyi cevap seç</Text>
                        </TouchableOpacity>
                    )}

                    {isQuestionAuthor && answer.isBestAnswer && (
                        <View style={styles.bestAnswerIndicator}>
                            <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                            <Text style={styles.bestAnswerIndicatorText}>Seçtiğiniz en iyi cevap</Text>
                        </View>
                    )}
                </View>

                {/* Comments Section */}
                {showComments && (
                    <View style={styles.commentsSection}>
                        {comments.length > 0 ? (
                            <CommentList
                                comments={comments}
                                onReportComment={(commentId) => {
                                    haptics.warning();
                                    onReportComment?.(commentId);
                                }}
                            />
                        ) : (
                            <Text style={styles.noCommentsText}>Henüz yorum yok. İlk yorumu yaz!</Text>
                        )}
                        {onSubmitComment && (
                            <View style={styles.commentInputWrapper}>
                                <CommentInput
                                    onSubmit={onSubmitComment}
                                    isSubmitting={isSubmittingComment}
                                    placeholder="Cevaba yorum yap..."
                                    autoFocus={justOpenedComments}
                                />
                            </View>
                        )}
                    </View>
                )}
            </View>
        </Animated.View>
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

    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
    StyleSheet.create({
        container: {
            backgroundColor: theme.colors.backgroundCard,
            borderRadius: 16,
            padding: theme.spacing.lg,
            marginBottom: theme.spacing.md,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
        },
        bestAnswerContainer: {
            borderWidth: 2,
            borderColor: theme.colors.success,
            backgroundColor: 'rgba(34, 197, 94, 0.05)',
        },
        bestAnswerBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 12,
            alignSelf: 'flex-start',
            marginBottom: theme.spacing.md,
        },
        bestAnswerText: {
            fontSize: 13,
            fontWeight: '600',
            color: theme.colors.success,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing.md,
        },
        authorInfo: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            flex: 1,
        },
        avatar: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: theme.colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
        },
        avatarText: {
            fontSize: 16,
            fontWeight: '700',
            color: '#fff',
        },
        authorName: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.colors.text,
        },
        reputation: {
            fontSize: 11,
            color: theme.colors.textSecondary,
            marginTop: 2,
        },
        timestamp: {
            fontSize: 12,
            color: theme.colors.textLight,
        },
        content: {
            fontSize: 15,
            color: theme.colors.text,
            lineHeight: 22,
            marginBottom: theme.spacing.md,
        },
        actions: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.md,
            paddingTop: theme.spacing.sm,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
        },
        actionButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            backgroundColor: theme.colors.background,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        actionButtonActive: {
            backgroundColor: 'rgba(139, 92, 246, 0.12)',
            borderColor: theme.colors.primary,
        },
        actionText: {
            fontSize: 13,
            color: theme.colors.textSecondary,
            fontWeight: '500',
        },
        actionTextActive: {
            color: theme.colors.primary,
            fontWeight: '600',
        },
        markBestButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderWidth: 1,
            borderColor: theme.colors.success,
        },
        markBestText: {
            fontSize: 13,
            color: theme.colors.success,
            fontWeight: '600',
        },
        commentsSection: {
            marginTop: theme.spacing.md,
            paddingTop: theme.spacing.md,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
        },
        commentInputWrapper: {
            marginTop: theme.spacing.md,
        },
        noCommentsText: {
            fontSize: 14,
            color: theme.colors.textSecondary,
            textAlign: 'center',
            paddingVertical: theme.spacing.md,
            fontStyle: 'italic',
        },
        bestAnswerIndicator: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
        },
        bestAnswerIndicatorText: {
            fontSize: 13,
            color: theme.colors.success,
            fontWeight: '600',
        },
        ownAnswerNote: {
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
        },
        ownAnswerNoteText: {
            fontSize: 12,
            color: theme.colors.primary,
            fontWeight: '500',
        },
        reportButton: {
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderWidth: 1,
            borderColor: '#ef4444',
        },
        reportText: {
            color: '#ef4444',
            fontWeight: '600',
        },
    });
