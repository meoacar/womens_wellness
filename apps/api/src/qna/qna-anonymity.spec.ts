import { QnaService } from './qna.service';
import { SharingService } from './sharing.service';
import { VoteService } from './vote.service';
import { sanitizeQuestionResponse, sanitizeAnswerResponse, sanitizeCommentResponse } from './utils/sanitize-author';

describe('QnA Anonymity & Privacy Enforcement', () => {
    const anonOwner = {
        id: 'user-anon-owner',
        username: 'secret_user',
        email: 'secret@example.com',
        profile: {
            firstName: 'Gizli',
            lastName: 'Kişi',
            profilePictureUrl: 'https://cdn.example.com/secret.jpg',
        },
        reputation: { totalPoints: 240 },
    };

    const otherAnswerer = {
        id: 'user-helper',
        username: 'dr_ayse',
        email: 'ayse@example.com',
        profile: {
            firstName: 'Ayşe',
            lastName: 'Yılmaz',
            profilePictureUrl: 'https://cdn.example.com/ayse.jpg',
        },
        reputation: { totalPoints: 500 },
    };

    it('strips userId, id, email, username, name, avatar, and reputation from anonymous question detail and answers by OP', () => {
        const rawQuestion = {
            id: 'q-anon-1',
            userId: anonOwner.id,
            title: 'Gizli Soru',
            content: 'Soru içeriği',
            isAnonymous: true,
            user: anonOwner,
            answers: [
                {
                    id: 'a-op',
                    questionId: 'q-anon-1',
                    userId: anonOwner.id,
                    content: 'Kendi cevabım',
                    user: anonOwner,
                },
                {
                    id: 'a-helper',
                    questionId: 'q-anon-1',
                    userId: otherAnswerer.id,
                    content: 'Yardım cevabı',
                    user: otherAnswerer,
                },
            ],
        };

        const sanitizedForOther = sanitizeQuestionResponse(rawQuestion, 'viewer-xyz');
        expect(sanitizedForOther.userId).toBeUndefined();
        expect(sanitizedForOther.isOwner).toBe(false);
        expect(sanitizedForOther.user).toEqual({
            username: null,
            displayName: 'Anonim Kullanıcı',
            profilePictureUrl: null,
        });
        expect((sanitizedForOther.user as any).id).toBeUndefined();
        expect((sanitizedForOther.user as any).email).toBeUndefined();
        expect((sanitizedForOther.user as any).reputation).toBeUndefined();

        // Answer posted by anonymous question owner is also anonymized
        const [opAns, helperAns] = sanitizedForOther.answers;
        expect(opAns.userId).toBeUndefined();
        expect(opAns.user).toEqual({
            username: null,
            displayName: 'Soru Sahibi (Anonim)',
            profilePictureUrl: null,
        });
        expect((opAns.user as any).email).toBeUndefined();

        // Answer by another user retains public display name but NEVER exposes email
        expect(helperAns.userId).toBe(otherAnswerer.id);
        expect(helperAns.user).toEqual({
            id: otherAnswerer.id,
            username: 'dr_ayse',
            displayName: 'Ayşe Yılmaz',
            profilePictureUrl: 'https://cdn.example.com/ayse.jpg',
            reputation: 500,
        });
        expect((helperAns.user as any).email).toBeUndefined();

        // Owner still gets isOwner=true without exposing userId
        const sanitizedForOwner = sanitizeQuestionResponse(rawQuestion, anonOwner.id);
        expect(sanitizedForOwner.userId).toBeUndefined();
        expect(sanitizedForOwner.isOwner).toBe(true);
    });

    it('never leaks email even on non-anonymous questions, answers, or comments', () => {
        const publicQuestion = {
            id: 'q-pub-1',
            userId: otherAnswerer.id,
            title: 'Normal Soru',
            content: 'İçerik',
            isAnonymous: false,
            user: otherAnswerer,
            answers: [],
        };

        const qOut = sanitizeQuestionResponse(publicQuestion, 'viewer-1');
        expect((qOut.user as any).email).toBeUndefined();
        expect(qOut.user.displayName).toBe('Ayşe Yılmaz');

        const cOut = sanitizeCommentResponse(
            { id: 'c-1', userId: anonOwner.id, content: 'Yorum', user: anonOwner },
            'viewer-1',
            { isAnonymousQuestion: true, questionOwnerId: anonOwner.id },
        );
        expect(cOut.userId).toBeUndefined();
        expect(cOut.user.displayName).toBe('Soru Sahibi (Anonim)');
        expect((cOut.user as any).email).toBeUndefined();
    });

    it('QnaService.getQuestionById returns sanitized anonymous payload and never selects email', async () => {
        const prisma = {
            question: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 'q-anon-1',
                    userId: anonOwner.id,
                    title: 'Gizli',
                    content: 'Detay',
                    isAnonymous: true,
                    user: {
                        id: anonOwner.id,
                        username: anonOwner.username,
                        profile: anonOwner.profile,
                        reputation: anonOwner.reputation,
                    },
                    answers: [],
                    _count: { answers: 0, comments: 0, favorites: 0, followers: 0 },
                }),
                update: jest.fn().mockResolvedValue({}),
            },
            questionFavorite: { findUnique: jest.fn().mockResolvedValue(null) },
            questionFollower: { findUnique: jest.fn().mockResolvedValue(null) },
        } as any;

        const service = new QnaService(prisma, {} as any, {} as any, {} as any);
        const result = await service.getQuestionById('q-anon-1', 'viewer-1');

        const findArgs = prisma.question.findUnique.mock.calls[0][0];
        expect(findArgs.include.user.select.email).toBeUndefined();
        expect(findArgs.include.answers.include.user.select.email).toBeUndefined();
        expect(result.userId).toBeUndefined();
        expect(result.user).toEqual({
            username: null,
            displayName: 'Anonim Kullanıcı',
            profilePictureUrl: null,
        });
    });

    it('SharingService strips profile picture and username for anonymous content', async () => {
        const prisma = {
            question: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 'q-anon-1',
                    title: 'Anonim Başlık',
                    content: 'İçerik',
                    isAnonymous: true,
                    user: {
                        username: 'secret_user',
                        profile: { profilePictureUrl: 'https://cdn.example.com/secret.jpg' },
                    },
                    _count: { answers: 2 },
                }),
            },
            answer: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 'a-op',
                    userId: anonOwner.id,
                    content: 'OP cevabı',
                    question: {
                        id: 'q-anon-1',
                        title: 'Anonim Başlık',
                        isAnonymous: true,
                        userId: anonOwner.id,
                    },
                    user: {
                        username: 'secret_user',
                        profile: { profilePictureUrl: 'https://cdn.example.com/secret.jpg' },
                    },
                }),
            },
        } as any;
        const config = { get: jest.fn().mockReturnValue('https://kadinatlasi.app') } as any;
        const sharing = new SharingService(prisma, config);

        const qMeta = await sharing.getQuestionShareMetadata('q-anon-1');
        expect(qMeta.image).toBeUndefined();

        const aMeta = await sharing.getAnswerShareMetadata('a-op');
        expect(aMeta.image).toBeUndefined();
        expect(aMeta.title).not.toContain('secret_user');
        expect(aMeta.title).toContain('Anonim kullanıcı');
    });

    it('VoteService.getTopAnswers strips identity for anonymous question OP and strips question.userId', async () => {
        const prisma = {
            answer: {
                findMany: jest.fn().mockResolvedValue([
                    {
                        id: 'a-op',
                        questionId: 'q-anon-1',
                        userId: anonOwner.id,
                        content: 'Cevap',
                        question: { id: 'q-anon-1', isAnonymous: true, userId: anonOwner.id },
                        user: anonOwner,
                        _count: { comments: 0 },
                    },
                ]),
            },
        } as any;

        const voteService = new VoteService(prisma, {} as any, {} as any);
        const top = await voteService.getTopAnswers('q-anon-1');

        expect(top[0].userId).toBeUndefined();
        expect(top[0].question.userId).toBeUndefined();
        expect(top[0].user.displayName).toBe('Soru Sahibi (Anonim)');
        expect(top[0].user.email).toBeUndefined();
    });

    it('QnaService.getAnswers and sanitizeAnswerResponse omit email', async () => {
        const ans = sanitizeAnswerResponse(
            {
                id: 'a-1',
                userId: otherAnswerer.id,
                content: 'Test',
                question: { id: 'q-2', isAnonymous: false, userId: 'someone' },
                user: otherAnswerer,
            },
            'viewer-1',
        );
        expect(ans.question.userId).toBeUndefined();
        expect(ans.user.email).toBeUndefined();
    });
});
