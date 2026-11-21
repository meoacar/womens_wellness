import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AdminGuard as QnaAdminGuard } from '../../qna/guards/admin.guard';

function createMockContext(userId?: string): ExecutionContext {
    return {
        switchToHttp: () => ({
            getRequest: () => ({
                user: userId ? { id: userId } : undefined,
            }),
        }),
    } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
    const originalAdminEmails = process.env.ADMIN_EMAILS;

    afterEach(() => {
        if (originalAdminEmails === undefined) {
            delete process.env.ADMIN_EMAILS;
        } else {
            process.env.ADMIN_EMAILS = originalAdminEmails;
        }
    });

    it('re-exports the unified AdminGuard from qna/guards', () => {
        expect(QnaAdminGuard).toBe(AdminGuard);
    });

    it('allows users with explicit isAdmin=true and ACTIVE status', async () => {
        const prisma = {
            user: {
                findUnique: jest.fn().mockResolvedValue({ isAdmin: true, status: 'ACTIVE' }),
            },
        } as any;
        const guard = new AdminGuard(prisma);

        await expect(guard.canActivate(createMockContext('user-1'))).resolves.toBe(true);
    });

    it.each([
        'admin@wellness.local',
        'someone@admin.wellnesscompanion.com',
        'admin@test.com',
        'test@test.com',
        'deneme54311@gmail.com',
    ])('denies %s when isAdmin=false even if ADMIN_EMAILS includes it', async (email) => {
        process.env.ADMIN_EMAILS = email;
        const prisma = {
            user: {
                findUnique: jest.fn().mockResolvedValue({ isAdmin: false, status: 'ACTIVE', email }),
            },
        } as any;
        const guard = new AdminGuard(prisma);

        await expect(guard.canActivate(createMockContext('user-2'))).rejects.toThrow(
            ForbiddenException,
        );
    });

    it('denies inactive users even if isAdmin=true', async () => {
        const prisma = {
            user: {
                findUnique: jest.fn().mockResolvedValue({ isAdmin: true, status: 'SUSPENDED' }),
            },
        } as any;
        const guard = new AdminGuard(prisma);

        await expect(guard.canActivate(createMockContext('user-3'))).rejects.toThrow(
            ForbiddenException,
        );
    });

    it('denies unauthenticated requests without user id', async () => {
        const prisma = { user: { findUnique: jest.fn() } } as any;
        const guard = new AdminGuard(prisma);

        await expect(guard.canActivate(createMockContext())).rejects.toThrow(ForbiddenException);
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
});
