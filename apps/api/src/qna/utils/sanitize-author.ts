export interface RawAuthorProfile {
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
    profilePictureUrl?: string | null;
}

export interface RawAuthorUser {
    id: string;
    username?: string | null;
    profile?: RawAuthorProfile | null;
    reputation?: {
        totalPoints?: number | null;
    } | null;
}

export interface PublicAuthorUser {
    id?: string;
    username: string | null;
    displayName: string;
    profilePictureUrl: string | null;
    reputation?: number;
}

export interface AnonymityContext {
    isAnonymousQuestion?: boolean;
    questionOwnerId?: string | null;
}

export const ANONYMOUS_USER_DISPLAY: PublicAuthorUser = {
    username: null,
    displayName: 'Anonim Kullanıcı',
    profilePictureUrl: null,
};

export const ANONYMOUS_OP_USER_DISPLAY: PublicAuthorUser = {
    username: null,
    displayName: 'Soru Sahibi (Anonim)',
    profilePictureUrl: null,
};

export function buildPublicDisplayName(user?: RawAuthorUser | null): string {
    if (!user) return 'Anonim Kullanıcı';
    const fullName =
        user.profile?.firstName && user.profile?.lastName
            ? `${user.profile.firstName} ${user.profile.lastName}`.trim()
            : '';
    return fullName || user.profile?.displayName || user.username || 'Topluluk Üyesi';
}

export function sanitizePublicAuthor(user?: RawAuthorUser | null): PublicAuthorUser | undefined {
    if (!user) return undefined;
    return {
        id: user.id,
        username: user.username ?? null,
        displayName: buildPublicDisplayName(user),
        profilePictureUrl: user.profile?.profilePictureUrl ?? null,
        ...(user.reputation !== undefined
            ? { reputation: user.reputation?.totalPoints ?? 0 }
            : {}),
    };
}

export function sanitizeAnswerResponse<T extends Record<string, any>>(
    answer: T,
    viewerUserId?: string,
    context?: AnonymityContext,
): Record<string, any> {
    const resolvedContext: AnonymityContext = context ?? {
        isAnonymousQuestion: Boolean(answer.question?.isAnonymous),
        questionOwnerId: answer.question?.userId ?? null,
    };

    const isAnonymousOp = Boolean(
        resolvedContext.isAnonymousQuestion &&
            resolvedContext.questionOwnerId &&
            answer.userId === resolvedContext.questionOwnerId,
    );
    const isOwner = Boolean(viewerUserId && answer.userId === viewerUserId);

    const sanitizedQuestion = answer.question
        ? (() => {
              const { userId: _qOwnerId, ...questionRest } = answer.question;
              return questionRest;
          })()
        : undefined;

    if (isAnonymousOp) {
        const { userId: _hiddenUserId, user: _hiddenUser, question: _q, ...rest } = answer;
        return {
            ...rest,
            ...(sanitizedQuestion ? { question: sanitizedQuestion } : {}),
            user: { ...ANONYMOUS_OP_USER_DISPLAY },
            isAnonymousAuthor: true,
            isOwner,
        };
    }

    const { user: rawUser, question: _q, ...rest } = answer;
    return {
        ...rest,
        ...(sanitizedQuestion ? { question: sanitizedQuestion } : {}),
        ...(rawUser !== undefined ? { user: sanitizePublicAuthor(rawUser) } : {}),
        isOwner,
    };
}

export function sanitizeCommentResponse<T extends Record<string, any>>(
    comment: T,
    viewerUserId?: string,
    context?: AnonymityContext,
): Record<string, any> {
    const isAnonymousOp = Boolean(
        context?.isAnonymousQuestion &&
            context?.questionOwnerId &&
            comment.userId === context.questionOwnerId,
    );
    const isOwner = Boolean(viewerUserId && comment.userId === viewerUserId);

    if (isAnonymousOp) {
        const { userId: _hiddenUserId, user: _hiddenUser, ...rest } = comment;
        return {
            ...rest,
            user: { ...ANONYMOUS_OP_USER_DISPLAY },
            isAnonymousAuthor: true,
            isOwner,
        };
    }

    const { user: rawUser, ...rest } = comment;
    return {
        ...rest,
        ...(rawUser !== undefined ? { user: sanitizePublicAuthor(rawUser) } : {}),
        isOwner,
    };
}

export function sanitizeQuestionResponse<T extends Record<string, any>>(
    question: T,
    viewerUserId?: string,
): Record<string, any> {
    const isOwner = Boolean(viewerUserId && question.userId === viewerUserId);
    const realOwnerId = question.userId;

    const sanitizedAnswers = Array.isArray(question.answers)
        ? question.answers.map((answer: Record<string, any>) =>
              sanitizeAnswerResponse(answer, viewerUserId, {
                  isAnonymousQuestion: Boolean(question.isAnonymous),
                  questionOwnerId: realOwnerId,
              }),
          )
        : undefined;

    if (question.isAnonymous) {
        const { userId: _hiddenUserId, user: _hiddenUser, answers: _a, ...rest } = question;
        return {
            ...rest,
            user: { ...ANONYMOUS_USER_DISPLAY },
            ...(sanitizedAnswers ? { answers: sanitizedAnswers } : {}),
            isOwner,
        };
    }

    const { user: rawUser, answers: _a, ...rest } = question;
    return {
        ...rest,
        ...(rawUser !== undefined ? { user: sanitizePublicAuthor(rawUser) } : {}),
        ...(sanitizedAnswers ? { answers: sanitizedAnswers } : {}),
        isOwner,
    };
}
