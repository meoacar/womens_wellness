import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HomeService } from './home.service';
import {
  DailyCardsService,
  DailyMicroCard,
  MicroCardTone,
} from './daily-cards.service';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('home')
@UseGuards(AuthGuard('jwt'))
export class HomeController {
  constructor(
    private readonly homeService: HomeService,
    private readonly dailyCardsService: DailyCardsService,
  ) {}

  @Get('snapshot')
  async getHomeSnapshot(
    @Request() req,
    @Query('locale') locale: string = 'tr',
  ) {
    return this.homeService.getHomeSnapshot(req.user.id, locale);
  }

  @Post('cards/dismiss')
  async dismissCard(
    @Request() req,
    @Body() body: { cardId: string; days?: number },
  ) {
    await this.homeService.dismissCard(req.user.id, body.cardId, body.days || 7);
    return { success: true };
  }

  @Post('cards/pin')
  async pinCard(@Request() req, @Body() body: { cardId: string }) {
    await this.homeService.pinCard(req.user.id, body.cardId);
    return { success: true };
  }

  @Post('cards/unpin')
  async unpinCard(@Request() req, @Body() body: { cardId: string }) {
    await this.homeService.unpinCard(req.user.id, body.cardId);
    return { success: true };
  }

  @Post('pills/set-visible')
  async setVisiblePills(
    @Request() req,
    @Body() body: { pillIds: string[] },
  ) {
    await this.homeService.setVisiblePills(req.user.id, body.pillIds);
    return { success: true };
  }

  @Get('daily-cards')
  async getDailyCards(
    @Query('phase') phase?: string,
    @Query('tone') tone?: MicroCardTone,
  ) {
    return this.dailyCardsService.getDailyDeck(
      phase,
      tone === 'scientific' ? 'scientific' : 'fun',
    );
  }

  @Get('admin/daily-cards')
  @UseGuards(AdminGuard)
  async getAdminDailyCards() {
    return this.dailyCardsService.getAllCards();
  }

  @Put('admin/daily-cards')
  @UseGuards(AdminGuard)
  async updateAdminDailyCards(@Body() body: { cards: DailyMicroCard[] }) {
    return this.dailyCardsService.saveAllCards(body.cards);
  }

  @Post('admin/daily-cards/reset')
  @UseGuards(AdminGuard)
  async resetAdminDailyCards() {
    return this.dailyCardsService.resetDefaults();
  }
}
