import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuestions } from '@/hooks/useQna';
import { useTheme } from '@/hooks/useTheme';
import { Question, QuestionCategory } from '@/types/qna';

interface RelatedQuestionsProps {
    currentQuestionId: string;
    category: QuestionCategory;
    tags?: string[];
    limit?: number;
}

export function RelatedQuestions({
    currentQuestionId,
    category,
    tags = [],
    limit = 5,
}: RelatedQuestionsProps) {
    const theme = useTheme();
    const { data, isLoading } = useQuestions(
        {
            category,
            tags: tags.slice(0, 3), // Use first 3 tags for better matching
            sort: 'popular',
            limit: limit + 1, // Fetch one extra to exclude current question
        },
        {
            staleTime: 10 * 60 * 1000, // 10 minutes
        }
    );

    if (isLoading) {
        return (
            <View style={[styles.container, { backgroundColor: theme.colors.backgroundCard, borderColor: theme.colors.border }]}>
                <Text style={[styles.title, { color: theme.colors.text }]}>İlgili Sorular</Text>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                </View>
            </View>
        );
    }

    // Filter out current question and limit results
    const relatedQuestions = data?.questions
        .filter((q) => q.id !== currentQuestionId)
        .slice(0, limit) || [];

    if (relatedQuestions.length === 0) {
        return null;
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.backgroundCard, borderColor: theme.colors.border }]}>
            <View style={styles.header}>
                <Ionicons name="link-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.title, { color: theme.colors.text }]}>İlgili Sorular</Text>
            </View>

            <View style={styles.questionsContainer}>
                {relatedQuestions.map((question, index) => (
                    <TouchableOpacity
                        key={question.id}
                        style={[
                            styles.questionItem,
                            index !== relatedQuestions.length - 1 && [styles.questionItemBorder, { borderBottomColor: theme.colors.border }],
                        ]}
                        onPress={() => router.push(`/community/${question.id}`)}
                    >
                        <View style={styles.questionContent}>
                            <Text style={[styles.questionTitle, { color: theme.colors.text }]} numberOfLines={2}>
                                {question.title}
                            </Text>
                            <View style={styles.questionMeta}>
                                <View style={styles.metaItem}>
                                    <Ionicons name="chatbubble-outline" size={12} color={theme.colors.textSecondary} />
                                    <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>{question._count?.answers || 0} cevap</Text>
                                </View>
                                {question.status === 'ANSWERED' && (
                                    <View style={styles.answeredBadge}>
                                        <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                                    </View>
                                )}
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity
                style={styles.seeMoreButton}
                onPress={() =>
                    router.push({
                        pathname: '/community/search',
                        params: { category },
                    })
                }
            >
                <Text style={[styles.seeMoreText, { color: theme.colors.primary }]}>Bu kategorideki diğer soruları gör</Text>
                <Ionicons name="arrow-forward" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F3F4F6',
        borderRadius: 12,
        padding: 16,
        marginTop: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
    },
    loadingContainer: {
        paddingVertical: 32,
        alignItems: 'center',
    },
    questionsContainer: {
        gap: 0,
    },
    questionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    questionItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    questionContent: {
        flex: 1,
        marginRight: 12,
    },
    questionTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1F2937',
        marginBottom: 6,
    },
    questionMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 11,
        color: '#6B7280',
    },
    answeredBadge: {
        width: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    seeMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 12,
        paddingVertical: 8,
    },
    seeMoreText: {
        fontSize: 14,
        color: '#8B5CF6',
        fontWeight: '500',
    },
});
