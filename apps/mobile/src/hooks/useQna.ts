import { useQuery, useMutation, useQueryClient, useInfiniteQuery, UseQueryOptions } from '@tanstack/react-query';
import { qnaService } from '@/services/api';
import {
    VoteType,
    type Question,
    type Answer,
    type QuestionComment,
    type AnswerComment,
    type CreateQuestionDto,
    type UpdateQuestionDto,
    type CreateAnswerDto,
    type UpdateAnswerDto,
    type CreateCommentDto,
    type VoteDto,
    type ReportContentDto,
    type QuestionFilters,
    type PaginatedQuestions,
    type ReputationDetail,
    type Leaderboard,
    type QnaQuota,
} from '@/types/qna';

// Query keys
export const qnaKeys = {
    all: ['qna'] as const,
    questions: (filters?: QuestionFilters) => ['qna', 'questions', filters] as const,
    question: (id: string) => ['qna', 'question', id] as const,
    myQuestions: () => ['qna', 'my-questions'] as const,
    favoriteQuestions: () => ['qna', 'favorite-questions'] as const,
    followingQuestions: () => ['qna', 'following-questions'] as const,
    answers: (questionId: string, sort?: string) =>
        sort ? (['qna', 'answers', questionId, sort] as const) : (['qna', 'answers', questionId] as const),
    myAnswers: () => ['qna', 'my-answers'] as const,
    questionComments: (questionId: string) => ['qna', 'question-comments', questionId] as const,
    answerComments: (answerId: string) => ['qna', 'answer-comments', answerId] as const,
    userVote: (answerId: string) => ['qna', 'user-vote', answerId] as const,
    reputation: (userId?: string) => userId ? ['qna', 'reputation', userId] as const : ['qna', 'reputation', 'me'] as const,
    leaderboard: (page?: number) => ['qna', 'leaderboard', page] as const,
    badges: () => ['qna', 'badges'] as const,
    myBadges: () => ['qna', 'my-badges'] as const,
    quota: () => ['qna', 'quota'] as const,
    blockedUsers: () => ['qna', 'blocked-users'] as const,
};

// ============================================================================
// QUESTIONS
// ============================================================================

/**
 * Hook to fetch questions with filters
 */
export function useQuestions(
    filters: QuestionFilters = {},
    options?: Omit<UseQueryOptions<PaginatedQuestions>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: qnaKeys.questions(filters),
        queryFn: () => qnaService.getQuestions(filters),
        staleTime: 2 * 60 * 1000, // 2 minutes
        ...options,
    });
}

/**
 * Hook to fetch questions with infinite scroll
 */
export function useInfiniteQuestions(
    filters: Omit<QuestionFilters, 'page'> = {},
    options?: any
) {
    return useInfiniteQuery<PaginatedQuestions>({
        queryKey: qnaKeys.questions(filters),
        queryFn: ({ pageParam = 1 }) =>
            qnaService.getQuestions({ ...filters, page: pageParam as number }),
        getNextPageParam: (lastPage: PaginatedQuestions) => {
            if (lastPage.hasMore) {
                return lastPage.page + 1;
            }
            return undefined;
        },
        initialPageParam: 1,
        staleTime: 2 * 60 * 1000, // 2 minutes
        gcTime: 5 * 60 * 1000, // 5 minutes
        ...options,
    });
}

/**
 * Hook to fetch a single question
 */
export function useQuestion(
    id: string,
    options?: Omit<UseQueryOptions<Question>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: qnaKeys.question(id),
        queryFn: () => qnaService.getQuestion(id),
        staleTime: 5 * 60 * 1000, // 5 minutes
        ...options,
    });
}

/**
 * Hook to fetch user's own questions
 */
export function useMyQuestions(
    page?: number,
    limit?: number,
    options?: Omit<UseQueryOptions<PaginatedQuestions>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: qnaKeys.myQuestions(),
        queryFn: () => qnaService.getMyQuestions(page, limit),
        staleTime: 2 * 60 * 1000, // 2 minutes
        ...options,
    });
}

/**
 * Hook to fetch favorite questions
 */
export function useFavoriteQuestions(
    page?: number,
    limit?: number,
    options?: Omit<UseQueryOptions<PaginatedQuestions>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: qnaKeys.favoriteQuestions(),
        queryFn: () => qnaService.getFavoriteQuestions(page, limit),
        staleTime: 2 * 60 * 1000, // 2 minutes
        ...options,
    });
}

/**
 * Hook to fetch following questions
 */
export function useFollowingQuestions(
    page?: number,
    limit?: number,
    options?: Omit<UseQueryOptions<PaginatedQuestions>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: qnaKeys.followingQuestions(),
        queryFn: () => qnaService.getFollowingQuestions(page, limit),
        staleTime: 2 * 60 * 1000, // 2 minutes
        ...options,
    });
}

/**
 * Hook to create a question
 */
export function useCreateQuestion() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateQuestionDto) => qnaService.createQuestion(data),
        onSuccess: () => {
            // Invalidate all questions queries (including filtered ones)
            queryClient.invalidateQueries({ queryKey: ['qna', 'questions'] });
            queryClient.invalidateQueries({ queryKey: qnaKeys.myQuestions() });
            queryClient.invalidateQueries({ queryKey: qnaKeys.quota() });
            queryClient.invalidateQueries({ queryKey: ['usage-stats'] });

            // Also refetch active queries immediately
            queryClient.refetchQueries({ queryKey: ['qna', 'questions'], type: 'active' });
        },
    });
}

/**
 * Hook to update a question
 */
export function useUpdateQuestion() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateQuestionDto }) =>
            qnaService.updateQuestion(id, data),
        onSuccess: (_, variables) => {
            // Invalidate specific question and lists
            queryClient.invalidateQueries({ queryKey: qnaKeys.question(variables.id) });
            queryClient.invalidateQueries({ queryKey: qnaKeys.questions() });
            queryClient.invalidateQueries({ queryKey: qnaKeys.myQuestions() });
        },
    });
}

/**
 * Hook to delete a question
 */
export function useDeleteQuestion() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => qnaService.deleteQuestion(id),
        onSuccess: () => {
            // Invalidate questions lists
            queryClient.invalidateQueries({ queryKey: qnaKeys.questions() });
            queryClient.invalidateQueries({ queryKey: qnaKeys.myQuestions() });
        },
    });
}

// ============================================================================
// ANSWERS
// ============================================================================

/**
 * Hook to fetch answers for a question
 */
export function useAnswers(
    questionId: string,
    sort?: 'best' | 'votes' | 'recent',
    options?: Omit<UseQueryOptions<Answer[]>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: qnaKeys.answers(questionId, sort),
        queryFn: () => qnaService.getAnswers(questionId, sort),
        staleTime: 0, // Always refetch when invalidated
        ...options,
    });
}

/**
 * Hook to fetch user's own answers
 */
export function useMyAnswers(
    page?: number,
    limit?: number,
    options?: Omit<UseQueryOptions<Answer[]>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: qnaKeys.myAnswers(),
        queryFn: () => qnaService.getMyAnswers(page, limit),
        staleTime: 2 * 60 * 1000, // 2 minutes
        ...options,
    });
}

/**
 * Hook to create an answer
 */
export function useCreateAnswer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ questionId, data }: { questionId: string; data: CreateAnswerDto }) =>
            qnaService.createAnswer(questionId, data),
        onSuccess: (_, variables) => {
            // Invalidate answers list and question
            queryClient.invalidateQueries({ queryKey: qnaKeys.answers(variables.questionId) });
            queryClient.invalidateQueries({ queryKey: qnaKeys.question(variables.questionId) });
            queryClient.invalidateQueries({ queryKey: qnaKeys.myAnswers() });
            queryClient.invalidateQueries({ queryKey: qnaKeys.reputation() });
            queryClient.invalidateQueries({ queryKey: qnaKeys.quota() });
        },
    });
}

/**
 * Hook to update an answer
 */
export function useUpdateAnswer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateAnswerDto }) =>
            qnaService.updateAnswer(id, data),
        onSuccess: () => {
            // Invalidate answers lists
            queryClient.invalidateQueries({ queryKey: ['qna', 'answers'] });
            queryClient.invalidateQueries({ queryKey: qnaKeys.myAnswers() });
        },
    });
}

/**
 * Hook to delete an answer
 */
export function useDeleteAnswer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => qnaService.deleteAnswer(id),
        onSuccess: () => {
            // Invalidate answers lists
            queryClient.invalidateQueries({ queryKey: ['qna', 'answers'] });
            queryClient.invalidateQueries({ queryKey: qnaKeys.myAnswers() });
        },
    });
}

/**
 * Hook to mark an answer as best
 */
export function useMarkBestAnswer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ answerId, questionId }: { answerId: string; questionId: string }) =>
            qnaService.markBestAnswer(questionId, answerId),
        onMutate: async ({ answerId, questionId }) => {
            console.log('🔧 onMutate - marking best answer:', { answerId, questionId });
            // No optimistic update - wait for server response
            return { answerId, questionId };
        },
        onError: (err, _variables, context) => {
            console.error('❌ Error marking best answer:', err);
            // No rollback needed since we don't do optimistic updates
        },
        onSuccess: async (data, variables) => {
            console.log('✅ onSuccess - API returned:', data);

            // Invalidate and immediately refetch
            console.log('🔄 Invalidating and refetching...');

            // Invalidate first
            queryClient.invalidateQueries({
                queryKey: ['qna', 'answers', variables.questionId]
            });
            queryClient.invalidateQueries({
                queryKey: qnaKeys.question(variables.questionId)
            });

            // Then force refetch active queries
            await queryClient.refetchQueries({
                queryKey: ['qna', 'answers', variables.questionId],
                type: 'active',
                exact: false
            });

            await queryClient.refetchQueries({
                queryKey: qnaKeys.question(variables.questionId),
                type: 'active'
            });

            queryClient.invalidateQueries({ queryKey: qnaKeys.reputation() });

            console.log('✅ Refetch completed');
        },
        onSettled: (_, __, variables) => {
            // Backup invalidation
            queryClient.invalidateQueries({ queryKey: ['qna', 'answers', variables.questionId] });
            queryClient.invalidateQueries({ queryKey: qnaKeys.question(variables.questionId) });
        },
    });
}

// ============================================================================
// VOTES
// ============================================================================

/**
 * Hook to get user's vote on an answer
 */
export function useUserVote(
    answerId: string,
    options?: Omit<UseQueryOptions<{ voteType: string | null }>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: qnaKeys.userVote(answerId),
        queryFn: () => qnaService.getUserVote(answerId),
        staleTime: 5 * 60 * 1000, // 5 minutes
        ...options,
    });
}

/**
 * Hook to vote on an answer
 */
export function useVoteAnswer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ answerId, data }: { answerId: string; data: VoteDto }) =>
            qnaService.voteAnswer(answerId, data),
        onMutate: async ({ answerId, data }) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['qna', 'answers'] });

            // Snapshot previous values
            const previousAnswers = queryClient.getQueriesData({ queryKey: ['qna', 'answers'] });

            // Optimistically update all answer queries
            queryClient.setQueriesData<Answer[]>(
                { queryKey: ['qna', 'answers'] },
                (old) => {
                    if (!old) return old;
                    return old.map((answer) => {
                        if (answer.id !== answerId) return answer;

                        const currentVote = answer.userVote ?? null;
                        const newVote = data.voteType;
                        let voteCountDelta = 0;

                        // Calculate vote count change
                        if (!currentVote) {
                            // No previous vote
                            voteCountDelta = newVote === VoteType.UPVOTE ? 1 : -1;
                        } else if (currentVote === newVote) {
                            // Removing vote (clicking same button)
                            voteCountDelta = currentVote === VoteType.UPVOTE ? -1 : 1;
                        } else {
                            // Changing vote
                            voteCountDelta = newVote === VoteType.UPVOTE ? 2 : -2;
                        }

                        return {
                            ...answer,
                            userVote: currentVote === newVote ? null : newVote,
                            voteCount: answer.voteCount + voteCountDelta,
                        };
                    });
                }
            );

            return { previousAnswers, answerId };
        },
        onError: (_err, _variables, context) => {
            // Rollback on error
            if (context?.previousAnswers) {
                context.previousAnswers.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },
        onSettled: (_, __, variables) => {
            // Refetch to ensure consistency
            queryClient.invalidateQueries({ queryKey: ['qna', 'answers'] });
            queryClient.invalidateQueries({ queryKey: qnaKeys.reputation() });
        },
    });
}

/**
 * Hook to remove vote from an answer
 */
export function useRemoveVote() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (answerId: string) => qnaService.removeVote(answerId),
        onMutate: async (answerId) => {
            await queryClient.cancelQueries({ queryKey: ['qna', 'answers'] });
            const previousAnswers = queryClient.getQueriesData({ queryKey: ['qna', 'answers'] });

            queryClient.setQueriesData<Answer[]>(
                { queryKey: ['qna', 'answers'] },
                (old) => {
                    if (!old) return old;
                    return old.map((answer) => {
                        if (answer.id !== answerId || !answer.userVote) return answer;
                        const voteCountDelta = answer.userVote === VoteType.UPVOTE ? -1 : 1;
                        return {
                            ...answer,
                            userVote: null,
                            voteCount: answer.voteCount + voteCountDelta,
                        };
                    });
                }
            );

            return { previousAnswers };
        },
        onError: (_err, _answerId, context) => {
            if (context?.previousAnswers) {
                context.previousAnswers.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },
        onSettled: (_, __, answerId) => {
            queryClient.invalidateQueries({ queryKey: qnaKeys.userVote(answerId) });
            queryClient.invalidateQueries({ queryKey: ['qna', 'answers'] });
            queryClient.invalidateQueries({ queryKey: qnaKeys.reputation() });
        },
    });
}

// ============================================================================
// COMMENTS
// ============================================================================

/**
 * Hook to fetch question comments
 */
export function useQuestionComments(
    questionId: string,
    options?: Omit<UseQueryOptions<QuestionComment[]>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: qnaKeys.questionComments(questionId),
        queryFn: () => qnaService.getQuestionComments(questionId),
        staleTime: 2 * 60 * 1000, // 2 minutes
        ...options,
    });
}

/**
 * Hook to fetch answer comments
 */
export function useAnswerComments(
    answerId: string,
    options?: Omit<UseQueryOptions<AnswerComment[]>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: qnaKeys.answerComments(answerId),
        queryFn: () => qnaService.getAnswerComments(answerId),
        staleTime: 2 * 60 * 1000, // 2 minutes
        ...options,
    });
}

/**
 * Hook to create a question comment
 */
export function useCreateQuestionComment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ questionId, data }: { questionId: string; data: CreateCommentDto }) =>
            qnaService.createQuestionComment(questionId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: qnaKeys.questionComments(variables.questionId) });
            queryClient.invalidateQueries({ queryKey: qnaKeys.question(variables.questionId) });
        },
    });
}

/**
 * Hook to create an answer comment
 */
export function useCreateAnswerComment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ answerId, data }: { answerId: string; data: CreateCommentDto }) =>
            qnaService.createAnswerComment(answerId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: qnaKeys.answerComments(variables.answerId) });
        },
    });
}

/**
 * Hook to delete a comment
 */
export function useDeleteComment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => qnaService.deleteComment(id),
        onSuccess: () => {
            // Invalidate all comments
            queryClient.invalidateQueries({ queryKey: ['qna', 'question-comments'] });
            queryClient.invalidateQueries({ queryKey: ['qna', 'answer-comments'] });
        },
    });
}

// ============================================================================
// INTERACTIONS (Favorite, Follow)
// ============================================================================

/**
 * Hook to favorite a question
 */
export function useFavoriteQuestion() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (questionId: string) => qnaService.favoriteQuestion(questionId),
        onMutate: async (questionId) => {
            // Optimistically update question
            await queryClient.cancelQueries({ queryKey: qnaKeys.question(questionId) });
            const previousQuestion = queryClient.getQueryData(qnaKeys.question(questionId));

            queryClient.setQueryData<Question>(qnaKeys.question(questionId), (old) => {
                if (!old) return old;
                return { ...old, isFavorited: true };
            });

            return { previousQuestion, questionId };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousQuestion) {
                queryClient.setQueryData(qnaKeys.question(context.questionId), context.previousQuestion);
            }
        },
        onSettled: (_, __, questionId) => {
            queryClient.invalidateQueries({ queryKey: qnaKeys.question(questionId) });
            queryClient.invalidateQueries({ queryKey: qnaKeys.favoriteQuestions() });
        },
    });
}

/**
 * Hook to unfavorite a question
 */
export function useUnfavoriteQuestion() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (questionId: string) => qnaService.unfavoriteQuestion(questionId),
        onMutate: async (questionId) => {
            await queryClient.cancelQueries({ queryKey: qnaKeys.question(questionId) });
            const previousQuestion = queryClient.getQueryData(qnaKeys.question(questionId));

            queryClient.setQueryData<Question>(qnaKeys.question(questionId), (old) => {
                if (!old) return old;
                return { ...old, isFavorited: false };
            });

            return { previousQuestion, questionId };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousQuestion) {
                queryClient.setQueryData(qnaKeys.question(context.questionId), context.previousQuestion);
            }
        },
        onSettled: (_, __, questionId) => {
            queryClient.invalidateQueries({ queryKey: qnaKeys.question(questionId) });
            queryClient.invalidateQueries({ queryKey: qnaKeys.favoriteQuestions() });
        },
    });
}

/**
 * Hook to follow a question
 */
export function useFollowQuestion() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (questionId: string) => qnaService.followQuestion(questionId),
        onMutate: async (questionId) => {
            await queryClient.cancelQueries({ queryKey: qnaKeys.question(questionId) });
            const previousQuestion = queryClient.getQueryData(qnaKeys.question(questionId));

            queryClient.setQueryData<Question>(qnaKeys.question(questionId), (old) => {
                if (!old) return old;
                return { ...old, isFollowing: true };
            });

            return { previousQuestion, questionId };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousQuestion) {
                queryClient.setQueryData(qnaKeys.question(context.questionId), context.previousQuestion);
            }
        },
        onSettled: (_, __, questionId) => {
            queryClient.invalidateQueries({ queryKey: qnaKeys.question(questionId) });
            queryClient.invalidateQueries({ queryKey: qnaKeys.followingQuestions() });
        },
    });
}

/**
 * Hook to unfollow a question
 */
export function useUnfollowQuestion() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (questionId: string) => qnaService.unfollowQuestion(questionId),
        onMutate: async (questionId) => {
            await queryClient.cancelQueries({ queryKey: qnaKeys.question(questionId) });
            const previousQuestion = queryClient.getQueryData(qnaKeys.question(questionId));

            queryClient.setQueryData<Question>(qnaKeys.question(questionId), (old) => {
                if (!old) return old;
                return { ...old, isFollowing: false };
            });

            return { previousQuestion, questionId };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousQuestion) {
                queryClient.setQueryData(qnaKeys.question(context.questionId), context.previousQuestion);
            }
        },
        onSettled: (_, __, questionId) => {
            queryClient.invalidateQueries({ queryKey: qnaKeys.question(questionId) });
            queryClient.invalidateQueries({ queryKey: qnaKeys.followingQuestions() });
        },
    });
}

/**
 * Hook to follow a user
 */
export function useFollowUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (userId: string) => qnaService.followUser(userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['qna', 'users'] });
        },
    });
}

/**
 * Hook to unfollow a user
 */
export function useUnfollowUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (userId: string) => qnaService.unfollowUser(userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['qna', 'users'] });
        },
    });
}

// ============================================================================
// REPUTATION & BADGES
// ============================================================================

/**
 * Hook to fetch user reputation
 */
export function useReputation(
    userId?: string,
    options?: Omit<UseQueryOptions<ReputationDetail>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: qnaKeys.reputation(userId),
        queryFn: () => userId ? qnaService.getUserReputation(userId) : qnaService.getMyReputation(),
        staleTime: 5 * 60 * 1000, // 5 minutes
        ...options,
    });
}

/**
 * Hook to fetch leaderboard
 */
export function useLeaderboard(
    page?: number,
    limit?: number,
    options?: Omit<UseQueryOptions<Leaderboard>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: qnaKeys.leaderboard(page),
        queryFn: () => qnaService.getLeaderboard(page, limit),
        staleTime: 10 * 60 * 1000, // 10 minutes
        ...options,
    });
}

/**
 * Hook to fetch all available badges
 */
export function useBadges(
    options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: qnaKeys.badges(),
        queryFn: () => qnaService.getAllBadges(),
        staleTime: 30 * 60 * 1000, // 30 minutes
        ...options,
    });
}

/**
 * Hook to fetch user's earned badges
 */
export function useMyBadges(
    options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: qnaKeys.myBadges(),
        queryFn: () => qnaService.getMyBadges(),
        staleTime: 5 * 60 * 1000, // 5 minutes
        ...options,
    });
}

// ============================================================================
// MODERATION
// ============================================================================

/**
 * Hook to report content
 */
export function useReportContent() {
    return useMutation({
        mutationFn: (data: ReportContentDto) => qnaService.reportContent(data),
    });
}

export function useBlockedUsers() {
    return useQuery({
        queryKey: qnaKeys.blockedUsers(),
        queryFn: () => qnaService.getBlockedUsers(),
    });
}

export function useBlockUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ targetUserId, reason }: { targetUserId: string; reason?: string }) =>
            qnaService.blockUser(targetUserId, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['qna', 'questions'] });
            queryClient.invalidateQueries({ queryKey: ['qna', 'answers'] });
            queryClient.invalidateQueries({ queryKey: ['qna', 'question-comments'] });
            queryClient.invalidateQueries({ queryKey: ['qna', 'answer-comments'] });
            queryClient.invalidateQueries({ queryKey: qnaKeys.blockedUsers() });
        },
    });
}

export function useUnblockUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (targetUserId: string) => qnaService.unblockUser(targetUserId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['qna', 'questions'] });
            queryClient.invalidateQueries({ queryKey: ['qna', 'answers'] });
            queryClient.invalidateQueries({ queryKey: qnaKeys.blockedUsers() });
        },
    });
}

// ============================================================================
// QUOTA
// ============================================================================

/**
 * Hook to fetch QnA quota
 */
export function useQnaQuota(
    options?: Omit<UseQueryOptions<QnaQuota>, 'queryKey' | 'queryFn'>
) {
    return useQuery({
        queryKey: qnaKeys.quota(),
        queryFn: () => qnaService.getQuota(),
        staleTime: 1 * 60 * 1000, // 1 minute
        ...options,
    });
}

// ============================================================================
// SHARING
// ============================================================================

/**
 * Hook to get share link
 */
export function useShareLink(questionId: string) {
    return useQuery({
        queryKey: ['qna', 'share-link', questionId],
        queryFn: () => qnaService.getShareLink(questionId),
        staleTime: 60 * 60 * 1000, // 1 hour
        enabled: !!questionId,
    });
}

/**
 * Hook to get share metadata
 */
export function useShareMetadata(questionId: string) {
    return useQuery({
        queryKey: ['qna', 'share-metadata', questionId],
        queryFn: () => qnaService.getShareMetadata(questionId),
        staleTime: 60 * 60 * 1000, // 1 hour
        enabled: !!questionId,
    });
}
