import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { DailyCardsService } from './daily-cards.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MetricsModule } from '../metrics/metrics.module';
import { CyclesModule } from '../cycles/cycles.module';
import { WaterModule } from '../water/water.module';
import { PregnancyModule } from '../pregnancy/pregnancy.module';
import { WellnessModule } from '../wellness/wellness.module';
import { DiscoverModule } from '../discover/discover.module';

@Module({
  imports: [PrismaModule, MetricsModule, CyclesModule, WaterModule, PregnancyModule, WellnessModule, DiscoverModule],
  controllers: [HomeController],
  providers: [HomeService, DailyCardsService],
  exports: [HomeService, DailyCardsService],
})
export class HomeModule { }
