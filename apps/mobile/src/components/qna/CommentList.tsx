import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Comment } from '@/types/qna';
import { OptimizedAvatar } from './OptimizedAvatar';
import { memo } from 'react';
import { useAuthStore } from '@/store/authStore';

interface CommentListProps {
    comments: Comment[];
    loading?: boolean;
    emptyMessage?: string;
    onReportComment?: (commentId: string) => void;
}

export const CommentList = memo(function CommentList({
    comments,
    loading = false,
    emptyMessage = 'Henüz yorum yapılmamış',
    onReportComment,
}: CommentListProps) {
    const theme = useTheme();
    const styles = createStyles(theme);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
        );
    }

    if (comments.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>{emptyMessage}</Text>
            </View>
        );
    }

    return (
        <View>
            {comments.map((item, idx) => (
                <View key={item.id}>
                    {idx > 0 && <View style={styles.separator} />}
                    <CommentItem comment={item} onReport={onReportComment} />
                </View>
            ))}
        </View>
    );
});

interface CommentItemProps {
    comment: Comment;
    onReport?: (commentId: string) => void;
}

const CommentItem = memo(function CommentItem({ comment, onReport }: CommentItemProps) {
    const theme = useTheme();
    const styles = createStyles(theme);
    const { user } = useAuthStore();

    const isOwnComment = Boolean(
        (comment as any)?.isOwner ?? (user?.id && comment.userId && user.id === comment.userId),
    );

    return (
        <View style={styles.commentContainer}>
            <View style={styles.commentHeader}>
                <OptimizedAvatar
                    imageUrl={comment.user?.profilePictureUrl}
                    displayName={comment.user?.displayName}
                    size={28}
                    isAnonymous={false}
                />
                <View style={styles.commentInfo}>
                    <Text style={styles.authorName}>{comment.user?.displayName || 'Anonim Kullanıcı'}</Text>
                    <Text style={styles.timestamp}>{formatTimestamp(comment.createdAt)}</Text>
                </View>
                {onReport && (
                    <TouchableOpacity
                        style={styles.reportButton}
                        onPress={() => onReport(comment.id)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.reportIcon}>🚩</Text>
                    </TouchableOpacity>
                )}
            </View>
            <Text style={styles.commentContent}>{comment.content}</Text>
        </View>
    );
});

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
        loadingContainer: {
            padding: theme.spacing.lg,
            alignItems: 'center',
        },
        emptyContainer: {
            padding: theme.spacing.lg,
            alignItems: 'center',
        },
        emptyText: {
            fontSize: 14,
            color: theme.colors.textSecondary,
            fontStyle: 'italic',
        },
        commentContainer: {
            paddingVertical: theme.spacing.md,
        },
        commentHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            marginBottom: theme.spacing.xs,
        },
        avatar: {
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: theme.colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
        },
        avatarText: {
            fontSize: 12,
            fontWeight: '700',
            color: '#fff',
        },
        commentInfo: {
            flex: 1,
        },
        authorName: {
            fontSize: 13,
            fontWeight: '600',
            color: theme.colors.text,
        },
        timestamp: {
            fontSize: 11,
            color: theme.colors.textLight,
            marginTop: 2,
        },
        commentContent: {
            fontSize: 14,
            color: theme.colors.text,
            lineHeight: 20,
            marginLeft: 36,
        },
        separator: {
            height: 1,
            backgroundColor: theme.colors.border,
            marginVertical: theme.spacing.xs,
        },
        reportButton: {
            padding: theme.spacing.xs,
            marginLeft: theme.spacing.xs,
        },
        reportIcon: {
            fontSize: 14,
        },
    });
