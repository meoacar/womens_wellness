import {
    Controller,
    Get,
    Param,
    Query,
    UseGuards,
    Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReputationService } from './reputation.service';
import { GetLeaderboardDto, GetReputationHistoryDto } from './dto/reputation.dto';

@Controller('qna/reputation')
@UseGuards(AuthGuard('jwt'))
export class ReputationController {
    constructor(private readonly reputationService: ReputationService) { }

    /**
     * Get current user's reputation
     * GET /api/qna/reputation/me
     */
    @Get('me')
    async getMyReputation(@Request() req) {
        const userId = req.user.id || req.user.sub;
        return this.reputationService.getUserReputation(userId);
    }

    /**
     * Get current user's reputation history
     * GET /api/qna/reputation/me/history
     */
    @Get('me/history')
    async getMyReputationHistory(
        @Request() req,
        @Query() dto: GetReputationHistoryDto,
    ) {
        const userId = req.user.id || req.user.sub;
        return this.reputationService.getReputationHistory(
            userId,
            dto.limit,
        );
    }

    /**
     * Get current user's badges
     * GET /api/qna/reputation/me/badges
     */
    @Get('me/badges')
    async getMyBadges(@Request() req) {
        const userId = req.user.id || req.user.sub;
        return this.reputationService.getUserBadges(userId);
    }

    /**
     * Get specific user's reputation
     * GET /api/qna/reputation/:userId
     */
    @Get(':userId')
    async getUserReputation(@Param('userId') userId: string) {
        return this.reputationService.getUserReputation(userId);
    }

    /**
     * Get leaderboard
     * GET /api/qna/reputation/leaderboard
     */
    @Get('leaderboard/top')
    async getLeaderboard(@Query() dto: GetLeaderboardDto) {
        return this.reputationService.getLeaderboard(dto.limit);
    }

    /**
     * Get all available badges
     * GET /api/qna/reputation/badges/all
     */
    @Get('badges/all')
    async getAllBadges() {
        return this.reputationService.getAllBadges();
    }
}
