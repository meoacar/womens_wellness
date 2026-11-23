// QnA Community Types

export enum QuestionCategory {
    MENSTRUAL_HEALTH = 'MENSTRUAL_HEALTH',
    PREGNANCY = 'PREGNANCY',
    FERTILITY = 'FERTILITY',
    NUTRITION = 'NUTRITION',
    EXERCISE = 'EXERCISE',
    MENTAL_HEALTH = 'MENTAL_HEALTH',
    SLEEP = 'SLEEP',
    CONTRACEPTION = 'CONTRACEPTION',
    PMS = 'PMS',
    MENOPAUSE = 'MENOPAUSE',
    SEXUAL_HEALTH = 'SEXUAL_HEALTH',
    GENERAL = 'GENERAL',
}

export enum QuestionStatus {
    OPEN = 'OPEN',
    ANSWERED = 'ANSWERED',
    CLOSED = 'CLOSED',
}

export enum VoteType {
    UPVOTE = 'UPVOTE',
    DOWNVOTE = 'DOWNVOTE',
}

export enum ContentType {
    QUESTION = 'QUESTION',
    ANSWER = 'ANSWER',
    COMMENT = 'COMMENT',
}

export enum ReportStatus {
    PENDING = 'PENDING',
    REVIEWED = 'REVIEWED',
    RESOLVED = 'RESOLVED',
    DISMISSED = 'DISMISSED',
}

export interface QuestionAuthor {
    id: string;
    username?: string;
    displayName: string;
    profilePictureUrl?: string;
    reputation?: number;
    isPremium?: boolean;
}

export interface Question {
    id: string;
    userId: string;
    title: string;
    content: string;
    category: QuestionCategory;
    tags: string[];
    isAnonymous: boolean;
    status: QuestionStatus;
    viewCount: number;
    isPremium: boolean;
    imageUrls?: string[];
    createdAt: string;
    updatedAt: string;
    user?: QuestionAuthor;
    _count?: {
        answers: number;
        favorites: number;
        followers: number;
        comments: number;
    };
    isFavorited?: boolean;
    isFollowing?: boolean;
}

export interface Answer {
    id: string;
    questionId: string;
    userId: string;
    content: string;
    isBestAnswer: boolean;
    voteCount: number;
    imageUrls?: string[];
    createdAt: string;
    updatedAt: string;
    user?: QuestionAuthor;
    _count?: {
        comments: number;
    };
    userVote?: VoteType | null;
}

export interface Comment {
    id: string;
    userId: string;
    content: string;
    createdAt: string;
    user?: QuestionAuthor;
}

export interface QuestionComment extends Comment {
    questionId: string;
}

export interface AnswerComment extends Comment {
    answerId: string;
}

export interface Vote {
    id: string;
    answerId: string;
    userId: string;
    voteType: VoteType;
    createdAt: string;
}

export interface VoteResult {
    voteType: VoteType;
    voteCount: number;
}

export interface UserReputation {
    id: string;
    userId: string;
    totalPoints: number;
    questionsAsked: number;
    answersGiven: number;
    bestAnswers: number;
    upvotesReceived: number;
    createdAt: string;
    updatedAt: string;
}

export interface ReputationHistory {
    id: string;
    reputationId: string;
    points: number;
    reason: string;
    metadata?: any;
    createdAt: string;
}

export interface Badge {
    id: string;
    key: string;
    nameTr: string;
    nameEn: string;
    description: string;
    iconUrl?: string;
    requirement: any;
    createdAt: string;
}

export interface UserBadge {
    id: string;
    reputationId: string;
    badgeId: string;
    earnedAt: string;
    badge: Badge;
}

export interface ContentReport {
    id: string;
    contentId: string;
    contentType: ContentType;
    reporterId: string;
    reason: string;
    description?: string;
    status: ReportStatus;
    reviewedBy?: string;
    reviewedAt?: string;
    createdAt: string;
}

export interface QnaQuota {
    questionsAsked: number;
    limit: number;
    remaining: number;
    isPremium: boolean;
    resetsAt: string;
    imagesUsed?: number;
    imageLimit?: number;
    imageRemaining?: number;
    imageResetsAt?: string;
}

// DTOs
export interface CreateQuestionDto {
    title: string;
    content: string;
    category: QuestionCategory;
    tags?: string[];
    isAnonymous?: boolean;
    imageUrls?: string[];
}

export interface UpdateQuestionDto {
    title?: string;
    content?: string;
    category?: QuestionCategory;
    tags?: string[];
    status?: QuestionStatus;
}

export interface CreateAnswerDto {
    content: string;
    imageUrls?: string[];
}

export interface UpdateAnswerDto {
    content: string;
}

export interface CreateCommentDto {
    content: string;
}

export interface VoteDto {
    voteType: VoteType;
}

export interface ReportContentDto {
    contentId: string;
    contentType: ContentType;
    reason: string;
    description?: string;
}

// Query Filters
export interface QuestionFilters {
    category?: QuestionCategory;
    tags?: string[];
    status?: QuestionStatus;
    sort?: 'recent' | 'popular' | 'unanswered';
    search?: string;
    page?: number;
    limit?: number;
}

export interface AnswerFilters {
    sort?: 'best' | 'votes' | 'recent';
}

// Paginated Responses
export interface PaginatedQuestions {
    questions: Question[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface PaginatedAnswers {
    answers: Answer[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

// Reputation & Leaderboard
export interface ReputationDetail {
    reputation: UserReputation;
    badges: UserBadge[];
    history: ReputationHistory[];
}

export interface LeaderboardEntry {
    userId: string;
    username: string;
    displayName: string;
    profilePictureUrl?: string;
    reputation: number;
    answersGiven: number;
    bestAnswers: number;
    rank: number;
}

export interface Leaderboard {
    entries: LeaderboardEntry[];
    total: number;
    page: number;
    limit: number;
}

// Analytics
export interface QnaMetrics {
    totalQuestions: number;
    questionsToday: number;
    questionsThisWeek: number;
    averageAnswersPerQuestion: number;
    unansweredQuestions: number;
    totalAnswers: number;
    answersToday: number;
    averageTimeToFirstAnswer: number;
    bestAnswerRate: number;
    totalVotes: number;
    totalComments: number;
    totalFavorites: number;
    totalFollows: number;
    activeUsers: number;
    categoryBreakdown: Record<QuestionCategory, number>;
}

// Share
export interface ShareMetadata {
    title: string;
    description: string;
    imageUrl?: string;
    url: string;
}
