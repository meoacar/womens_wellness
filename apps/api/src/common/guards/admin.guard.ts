import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Guard to check if user has explicitly assigned admin privileges (`user.isAdmin`).
 */
@Injectable()
export class AdminGuard implements CanActivate {
    constructor(private prisma: PrismaService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const userId = request.user?.id;

        if (!userId) {
            throw new ForbiddenException('Kimlik doğrulaması gerekli');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { isAdmin: true, status: true },
        });

        if (!user || user.status !== 'ACTIVE') {
            throw new ForbiddenException('Kullanıcı bulunamadı');
        }

        if (!user.isAdmin) {
            throw new ForbiddenException('Bu işlem için admin yetkisi gerekli');
        }

        return true;
    }
}
