import { View, Text, StyleSheet, TouchableOpacity, Animated, Image } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { Question } from '@/types/qna';
import { CategoryPill } from './CategoryPill';
import { TagChip } from './TagChip';
import { OptimizedAvatar } from './OptimizedAvatar';
import { memo, useRef } from 'react';
import { haptics } from '@/utils/haptics';
import { accessibility } from '@/utils/accessibility';

interface QuestionCardProps {
    question: Question;
    onPress: () => void;
    showActions?: boolean;
}

export const QuestionCard = memo(function QuestionCard({
    question,
    onPress,
    showActions = true,
}: QuestionCardProps) {
    const theme = useTheme();
    const styles = createStyles(theme);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const answerCount = question._count?.answers || 0;
    const favoriteCount = question._count?.favorites || 0;
    const isAnswered = question.status === 'ANSWERED';
    const isClosed = question.status === 'CLOSED';

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.985,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 4,
            tension: 45,
            useNativeDriver: true,
        }).start();
    };

    const handlePress = () => {
        haptics.light();
        onPress();
    };

    const accessibilityLabel = `${question.title}. ${
        question.isAnonymous
            ? accessibility.getAnonymousLabel()
            : `${question.user?.displayName} tarafından soruldu`
    }. ${accessibility.getAnswerCountLabel(answerCount)}. ${accessibility.getViewCountLabel(
        question.viewCount
    )}.`;

    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
                style={styles.container}
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={0.95}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel}
                accessibilityHint={accessibility.getButtonHint('Soru detayını görüntüle')}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.authorInfo}>
                        <OptimizedAvatar
                            imageUrl={question.user?.profilePictureUrl}
                            displayName={question.user?.displayName}
                            size={34}
                            isAnonymous={question.isAnonymous}
                        />
                        <View style={styles.authorMeta}>
                            <View style={styles.authorTopLine}>
                                <Text style={styles.authorName} numberOfLines={1}>
                                    {question.isAnonymous
                                        ? 'Anonim Üye'
                                        : question.user?.displayName || 'Topluluk Üyesi'}
                                </Text>
                                {!question.isAnonymous && (question.user?.isPremium || question.isPremium) && (
                                    <View style={styles.inlinePremiumBadge}>
                                        <Ionicons name="sparkles" size={10} color="#D97706" />
                                        <Text style={styles.inlinePremiumText}>PRO</Text>
                                    </View>
                                )}
                                <Text style={styles.dotSeparator}>•</Text>
                                <Text style={styles.timestamp}>
                                    {formatTimestamp(question.createdAt)}
                                </Text>
                            </View>
                            {!question.isAnonymous &&
                                question.user?.reputation !== undefined &&
                                question.user.reputation > 0 && (
                                    <Text style={styles.reputation}>
                                        {question.user.reputation} itibar puanı
                                    </Text>
                                )}
                        </View>
                    </View>

                    {question.isPremium && (
                        <View style={styles.featuredBadge}>
                            <Ionicons name="sparkles" size={11} color="#D97706" />
                            <Text style={styles.featuredBadgeText}>Öne Çıkan</Text>
                        </View>
                    )}
                </View>

                {/* Title & Excerpt */}
                <Text style={styles.title} numberOfLines={2}>
                    {question.title}
                </Text>
                <Text style={styles.content} numberOfLines={2}>
                    {question.content}
                </Text>

                {Array.isArray(question.imageUrls) && question.imageUrls.length > 0 && (
                    <View style={styles.imagePreviewRow}>
                        {question.imageUrls.slice(0, 5).map((uri, idx) => (
                            <Image
                                key={`${uri}-${idx}`}
                                source={{ uri }}
                                style={styles.imageThumb}
                                resizeMode="cover"
                            />
                        ))}
                    </View>
                )}

                {/* Category & Tags */}
                <View style={styles.tagsContainer}>
                    <CategoryPill category={question.category} size="small" />
                    {question.tags.slice(0, 2).map((tag) => (
                        <TagChip key={tag} tag={tag} size="small" />
                    ))}
                    {question.tags.length > 2 && (
                        <Text style={styles.moreTags}>+{question.tags.length - 2}</Text>
                    )}
                </View>

                {/* Footer */}
                {showActions && (
                    <View style={styles.footer}>
                        <View style={styles.stats}>
                            <View
                                style={[
                                    styles.answerStatPill,
                                    isAnswered && styles.answerStatPillSuccess,
                                ]}
                            >
                                <Ionicons
                                    name={
                                        isAnswered
                                            ? 'checkmark-circle'
                                            : 'chatbubble-ellipses-outline'
                                    }
                                    size={13}
                                    color={
                                        isAnswered
                                            ? theme.colors.success
                                            : theme.colors.textSecondary
                                    }
                                />
                                <Text
                                    style={[
                                        styles.statText,
                                        isAnswered && styles.statTextSuccess,
                                    ]}
                                >
                                    {answerCount} cevap
                                </Text>
                            </View>

                            <View style={styles.stat}>
                                <Ionicons
                                    name="eye-outline"
                                    size={14}
                                    color={theme.colors.textLight}
                                />
                                <Text style={styles.statText}>{question.viewCount}</Text>
                            </View>

                            {favoriteCount > 0 && (
                                <View style={styles.stat}>
                                    <Ionicons
                                        name={question.isFavorited ? 'heart' : 'heart-outline'}
                                        size={14}
                                        color={
                                            question.isFavorited
                                                ? '#F43F5E'
                                                : theme.colors.textLight
                                        }
                                    />
                                    <Text style={styles.statText}>{favoriteCount}</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.rightFooter}>
                            {isClosed ? (
                                <View style={styles.closedBadge}>
                                    <Ionicons
                                        name="lock-closed-outline"
                                        size={11}
                                        color={theme.colors.textLight}
                                    />
                                    <Text style={styles.closedText}>Kapalı</Text>
                                </View>
                            ) : (
                                <Ionicons
                                    name="chevron-forward"
                                    size={16}
                                    color={theme.colors.textLight}
                                />
                            )}
                        </View>
                    </View>
                )}
            </TouchableOpacity>
        </Animated.View>
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
    if (diffMins < 60) return `${diffMins} dk`;
    if (diffHours < 24) return `${diffHours} sa`;
    if (diffDays < 7) return `${diffDays} gün`;

    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
    StyleSheet.create({
        container: {
            backgroundColor: theme.colors.backgroundCard,
            borderRadius: 18,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: theme.colors.border,
            shadowColor: theme.colors.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 2,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
            gap: 8,
        },
        authorInfo: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            flex: 1,
        },
        authorMeta: {
            flex: 1,
        },
        authorTopLine: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
        },
        authorName: {
            fontSize: 13.5,
            fontWeight: '700',
            color: theme.colors.text,
            flexShrink: 1,
        },
        inlinePremiumBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            backgroundColor: 'rgba(245, 158, 11, 0.16)',
            paddingHorizontal: 5,
            paddingVertical: 1.5,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: 'rgba(245, 158, 11, 0.32)',
        },
        inlinePremiumText: {
            fontSize: 9,
            fontWeight: '800',
            color: '#D97706',
        },
        imagePreviewRow: {
            flexDirection: 'row',
            gap: 8,
            marginBottom: 10,
        },
        imageThumb: {
            width: 72,
            height: 72,
            borderRadius: 10,
            backgroundColor: theme.colors.backgroundSecondary,
        },
        dotSeparator: {
            fontSize: 12,
            color: theme.colors.textLight,
        },
        timestamp: {
            fontSize: 12,
            color: theme.colors.textLight,
            fontWeight: '500',
        },
        reputation: {
            fontSize: 11,
            color: theme.colors.textSecondary,
            marginTop: 1,
        },
        featuredBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: 'rgba(245, 158, 11, 0.14)',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 10,
        },
        featuredBadgeText: {
            fontSize: 11,
            fontWeight: '700',
            color: '#D97706',
        },
        title: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: 6,
            lineHeight: 22,
        },
        content: {
            fontSize: 13.5,
            color: theme.colors.textSecondary,
            lineHeight: 19,
            marginBottom: 12,
        },
        tagsContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 6,
            marginBottom: 12,
        },
        moreTags: {
            fontSize: 11.5,
            color: theme.colors.textLight,
            fontWeight: '600',
        },
        footer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
        },
        stats: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        answerStatPill: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 10,
            backgroundColor: theme.colors.background,
        },
        answerStatPillSuccess: {
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
        },
        stat: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        statText: {
            fontSize: 12.5,
            color: theme.colors.textSecondary,
            fontWeight: '600',
        },
        statTextSuccess: {
            color: theme.colors.success,
        },
        rightFooter: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        closedBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            paddingHorizontal: 7,
            paddingVertical: 3,
            borderRadius: 8,
            backgroundColor: theme.colors.background,
        },
        closedText: {
            fontSize: 11,
            color: theme.colors.textLight,
            fontWeight: '600',
        },
    });
