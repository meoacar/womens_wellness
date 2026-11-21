import { GUARDS_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import * as gamificationControllerModule from './gamification.controller';
import { GamificationController } from './gamification.controller';
import { GamificationModule } from './gamification.module';

describe('Gamification seed endpoint security', () => {
  it('removes PublicGamificationController from exports and module controllers', () => {
    expect((gamificationControllerModule as any).PublicGamificationController).toBeUndefined();

    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, GamificationModule);
    expect(controllers).toEqual([
      GamificationController,
      expect.any(Function),
    ]);
    expect(controllers.map((c: any) => c.name)).not.toContain('PublicGamificationController');
  });

  it('requires JwtAuthGuard and AdminGuard on GamificationController.seedAchievements', () => {
    const classGuards = Reflect.getMetadata(GUARDS_METADATA, GamificationController);
    const methodGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      GamificationController.prototype.seedAchievements,
    );

    expect(classGuards).toEqual(expect.arrayContaining([JwtAuthGuard]));
    expect(methodGuards).toEqual(expect.arrayContaining([JwtAuthGuard, AdminGuard]));
  });
});
