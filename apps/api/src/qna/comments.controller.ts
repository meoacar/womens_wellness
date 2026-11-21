import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    UseGuards,
    Request,
    HttpCode,
    HttpStatus,
    BadRequestException,
    UsePipes,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { QnaService } from './qna.service';
import { CreateCommentDto } from './dto';
import { OwnerGuard } from './guards';
import { SanitizePipe } from './pipes';

@Controller('qna')
@UseGuards(AuthGuard('jwt'))
export class CommentsController {
    constructor(private readonly qnaService: QnaService) { }

    @Post('questions/:id/comments')
    @HttpCode(HttpStatus.CREATED)
    @Throttle({ default: { limit: 20, ttl: 3600000 } }) // 20 comments per hour
    @UsePipes(new SanitizePipe())
    async createQuestionComment(
        @Request() req,
        @Param('id') id: string,
        @Body() dto: CreateCommentDto,
    ) {
        if (!id || id.length < 10) {
            throw new BadRequestException('Geçersiz soru ID');
        }
        return this.qnaService.createQuestionComment(id, req.user.id, dto);
    }

    @Get('questions/:id/comments')
    async getQuestionComments(@Request() req, @Param('id') id: string) {
        if (!id || id.length < 10) {
            throw new BadRequestException('Geçersiz soru ID');
        }
        return this.qnaService.getQuestionComments(id, req.user?.id);
    }

    @Post('answers/:id/comments')
    @HttpCode(HttpStatus.CREATED)
    @Throttle({ default: { limit: 20, ttl: 3600000 } }) // 20 comments per hour
    @UsePipes(new SanitizePipe())
    async createAnswerComment(
        @Request() req,
        @Param('id') id: string,
        @Body() dto: CreateCommentDto,
    ) {
        if (!id || id.length < 10) {
            throw new BadRequestException('Geçersiz cevap ID');
        }
        return this.qnaService.createAnswerComment(id, req.user.id, dto);
    }

    @Get('answers/:id/comments')
    async getAnswerComments(@Request() req, @Param('id') id: string) {
        if (!id || id.length < 10) {
            throw new BadRequestException('Geçersiz cevap ID');
        }
        return this.qnaService.getAnswerComments(id, req.user?.id);
    }

    @Delete('comments/question/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(OwnerGuard)
    @Throttle({ default: { limit: 20, ttl: 3600000 } }) // 20 deletes per hour
    async deleteQuestionComment(@Request() req, @Param('id') id: string) {
        if (!id || id.length < 10) {
            throw new BadRequestException('Geçersiz yorum ID');
        }
        await this.qnaService.deleteQuestionComment(id, req.user.id);
    }

    @Delete('comments/answer/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(OwnerGuard)
    @Throttle({ default: { limit: 20, ttl: 3600000 } }) // 20 deletes per hour
    async deleteAnswerComment(@Request() req, @Param('id') id: string) {
        if (!id || id.length < 10) {
            throw new BadRequestException('Geçersiz yorum ID');
        }
        await this.qnaService.deleteAnswerComment(id, req.user.id);
    }
}
