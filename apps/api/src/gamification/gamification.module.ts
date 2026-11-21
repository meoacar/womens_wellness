import { Module } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';
import { GamificationAdminController } from './gamification-admin.controller';
import { AchievementService } from './achievement.service';
import { InsightService } from './insight.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminGuard } from '../common/guards/admin.guard';

@Module({
    imports: [PrismaModule],
    controllers: [
        GamificationController,
        GamificationAdminController,
    ],
    providers: [GamificationService, AchievementService, InsightService, AdminGuard],
    exports: [GamificationService, AchievementService, InsightService],
})
export class GamificationModule { }
