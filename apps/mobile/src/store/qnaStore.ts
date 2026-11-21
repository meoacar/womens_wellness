import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QuestionCategory, QuestionStatus, Question } from '@/types/qna';

interface QnaFilters {
    category?: QuestionCategory;
    tags?: string[];
    status?: QuestionStatus;
    sort?: 'recent' | 'popular' | 'unanswered';
    search?: string;
}

interface QnaStore {
    // Filters
    filters: QnaFilters;
    setFilters: (filters: Partial<QnaFilters>) => void;
    resetFilters: () => void;

    // Search
    searchQuery: string;
    setSearchQuery: (query: string) => void;

    // Selected category for filtering
    selectedCategory?: QuestionCategory;
    setSelectedCategory: (category?: QuestionCategory) => void;

    // Sort preference
    sortBy: 'recent' | 'popular' | 'unanswered';
    setSortBy: (sort: 'recent' | 'popular' | 'unanswered') => void;

    // Draft question (for saving locally)
    draftQuestion?: {
        title: string;
        content: string;
        category?: QuestionCategory;
        tags?: string[];
        isAnonymous?: boolean;
    };
    setDraftQuestion: (draft?: QnaStore['draftQuestion']) => void;
    clearDraftQuestion: () => void;

    // UI state
    showAnonymousMode: boolean;
    setShowAnonymousMode: (show: boolean) => void;

    // Recently viewed questions (for offline support)
    recentlyViewed: string[];
    addRecentlyViewed: (questionId: string) => void;
    clearRecentlyViewed: () => void;

    // Cached questions (for offline support)
    cachedQuestions: Record<string, Question>;
    cacheQuestion: (question: Question) => void;
    getCachedQuestion: (id: string) => Question | undefined;
    clearCache: () => void;

    // Clear all user-scoped persisted Q&A drafts/caches on logout
    clearAll: () => Promise<void>;

    // Active filters count (for UI badge)
    getActiveFiltersCount: () => number;
}

const defaultFilters: QnaFilters = {
    sort: 'recent',
};

export const useQnaStore = create<QnaStore>()(
    persist(
        (set, get) => ({
            // Filters
            filters: defaultFilters,
            setFilters: (filters) =>
                set((state) => ({
                    filters: { ...state.filters, ...filters },
                })),
            resetFilters: () => set({ filters: defaultFilters }),

            // Search
            searchQuery: '',
            setSearchQuery: (query) => set({ searchQuery: query }),

            // Selected category
            selectedCategory: undefined,
            setSelectedCategory: (category) => set({ selectedCategory: category }),

            // Sort preference
            sortBy: 'recent',
            setSortBy: (sort) => set({ sortBy: sort }),

            // Draft question
            draftQuestion: undefined,
            setDraftQuestion: (draft) => set({ draftQuestion: draft }),
            clearDraftQuestion: () => set({ draftQuestion: undefined }),

            // UI state
            showAnonymousMode: false,
            setShowAnonymousMode: (show) => set({ showAnonymousMode: show }),

            // Recently viewed
            recentlyViewed: [],
            addRecentlyViewed: (questionId) =>
                set((state) => ({
                    recentlyViewed: [
                        questionId,
                        ...state.recentlyViewed.filter((id) => id !== questionId),
                    ].slice(0, 20), // Keep last 20
                })),
            clearRecentlyViewed: () => set({ recentlyViewed: [] }),

            // Cached questions
            cachedQuestions: {},
            cacheQuestion: (question) =>
                set((state) => ({
                    cachedQuestions: {
                        ...state.cachedQuestions,
                        [question.id]: question,
                    },
                })),
            getCachedQuestion: (id) => get().cachedQuestions[id],
            clearCache: () => set({ cachedQuestions: {} }),

            clearAll: async () => {
                set({
                    filters: defaultFilters,
                    searchQuery: '',
                    selectedCategory: undefined,
                    sortBy: 'recent',
                    draftQuestion: undefined,
                    showAnonymousMode: false,
                    recentlyViewed: [],
                    cachedQuestions: {},
                });
                await AsyncStorage.removeItem('qna-store').catch(() => undefined);
            },

            // Active filters count
            getActiveFiltersCount: () => {
                const { filters, selectedCategory } = get();
                let count = 0;
                if (filters.category || selectedCategory) count++;
                if (filters.tags && filters.tags.length > 0) count++;
                if (filters.status) count++;
                if (filters.search) count++;
                return count;
            },
        }),
        {
            name: 'qna-store',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                // Only persist these fields
                sortBy: state.sortBy,
                draftQuestion: state.draftQuestion,
                recentlyViewed: state.recentlyViewed,
                cachedQuestions: state.cachedQuestions,
            }),
        }
    )
);
