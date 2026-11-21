import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PostpartumController } from './postpartum.controller';
import { PostpartumService } from './postpartum.service';

@Module({
  imports: [PrismaModule],
  controllers: [PostpartumController],
  providers: [PostpartumService],
  exports: [PostpartumService],
})
export class PostpartumModule {}
