import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    HttpCode,
    HttpStatus,
    BadRequestException,
    UsePipes,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import * as fs from 'fs';
import * as path from 'path';
import { QnaService } from './qna.service';
import { CreateQuestionDto, AdminCreateQuestionDto, UpdateQuestionDto, AdminUpdateQuestionDto, QuestionFiltersDto } from './dto';
import { OwnerGuard, AdminGuard } from './guards';
import { SanitizePipe } from './pipes';
import {
    MAX_UPLOAD_IMAGE_BYTES,
    generateSafeUploadFilename,
    readStreamWithLimit,
    resolveUploadsDir,
    sanitizeAndReencodeProfileImage,
} from '../common/utils/uploads';

@Controller('qna/questions')
@UseGuards(AuthGuard('jwt'))
export class QuestionsController {
    constructor(private readonly qnaService: QnaService) { }

    @Post('admin')
    @HttpCode(HttpStatus.CREATED)
    @UseGuards(AdminGuard)
    @UsePipes(new SanitizePipe())
    async adminCreateQuestion(@Request() req, @Body() dto: AdminCreateQuestionDto) {
        const userId = req.user.id || req.user.sub;
        return this.qnaService.adminCreateQuestion(userId, dto);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 questions per hour
    @UsePipes(new SanitizePipe())
    async createQuestion(@Request() req, @Body() dto: CreateQuestionDto) {
        const userId = req.user.id || req.user.sub;
        return this.qnaService.createQuestion(userId, dto);
    }

    @Post('upload-image')
    @Throttle({ default: { limit: 20, ttl: 3600000 } })
    async uploadImage(@Request() req: any) {
        const data = await req.file();
        if (!data) {
            throw new BadRequestException('Resim dosyası gereklidir');
        }

        let rawBuffer: Buffer;
        try {
            rawBuffer = await readStreamWithLimit(data.file, MAX_UPLOAD_IMAGE_BYTES);
        } catch (readError: any) {
            throw new BadRequestException(
                readError?.message || 'Resim boyutu sınırı aşıldı',
            );
        }

        let processedImage;
        try {
            processedImage = await sanitizeAndReencodeProfileImage(rawBuffer);
        } catch {
            throw new BadRequestException(
                'Geçersiz veya desteklenmeyen resim formatı (jpg, png, gif, webp)',
            );
        }

        const filename = generateSafeUploadFilename(processedImage.extension);
        const uploadDir = path.join(resolveUploadsDir(), 'qna');
        await fs.promises.mkdir(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, filename);
        await fs.promises.writeFile(filePath, processedImage.buffer, { mode: 0o644 });

        const relativePath = path.posix.join('qna', filename);
        const defaultApiBase =
            process.env.NODE_ENV === 'production'
                ? 'https://api.kadinatlasi.com'
                : 'http://localhost:4000';
        const baseUrl = (process.env.API_BASE_URL || defaultApiBase).replace(/\/+$/, '');
        return {
            imageUrl: `${baseUrl}/uploads/${relativePath}`,
        };
    }

    @Get()
    async getQuestions(@Request() req, @Query() filters: QuestionFiltersDto) {
        const userId = req.user.id || req.user.sub;
        return this.qnaService.getQuestions(filters, userId);
    }

    @Get('my')
    async getMyQuestions(@Request() req, @Query() filters: QuestionFiltersDto) {
        const userId = req.user.id || req.user.sub;
        return this.qnaService.getMyQuestions(userId, filters);
    }

    @Get('favorites')
    async getFavoriteQuestions(@Request() req, @Query() filters: QuestionFiltersDto) {
        const userId = req.user.id || req.user.sub;
        return this.qnaService.getFavoriteQuestions(userId, filters);
    }

    @Get('following')
    async getFollowingQuestions(@Request() req, @Query() filters: QuestionFiltersDto) {
        const userId = req.user.id || req.user.sub;
        return this.qnaService.getFollowingQuestions(userId, filters);
    }

    @Get('quota/status')
    async getQuotaStatus(@Request() req) {
        const userId = req.user.id || req.user.sub;
        return this.qnaService.getQuotaStatus(userId);
    }

    @Get(':id')
    async getQuestion(@Request() req, @Param('id') id: string) {
        if (!id || id.length < 10) {
            throw new BadRequestException('Geçersiz soru ID');
        }
        return this.qnaService.getQuestionById(id, req.user.id);
    }

    @Patch(':id/admin')
    @UseGuards(AdminGuard)
    @UsePipes(new SanitizePipe())
    async adminUpdateQuestion(
        @Param('id') id: string,
        @Body() dto: AdminUpdateQuestionDto,
    ) {
        if (!id || id.length < 10) {
            throw new BadRequestException('Geçersiz soru ID');
        }
        return this.qnaService.adminUpdateQuestion(id, dto);
    }

    @Delete(':id/admin')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(AdminGuard)
    async adminDeleteQuestion(@Param('id') id: string) {
        if (!id || id.length < 10) {
            throw new BadRequestException('Geçersiz soru ID');
        }
        await this.qnaService.adminDeleteQuestion(id);
    }

    @Patch(':id')
    @UseGuards(OwnerGuard)
    @Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 updates per hour
    @UsePipes(new SanitizePipe())
    async updateQuestion(
        @Request() req,
        @Param('id') id: string,
        @Body() dto: UpdateQuestionDto,
    ) {
        if (!id || id.length < 10) {
            throw new BadRequestException('Geçersiz soru ID');
        }
        return this.qnaService.updateQuestion(id, req.user.id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(OwnerGuard)
    @Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 deletes per hour
    async deleteQuestion(@Request() req, @Param('id') id: string) {
        if (!id || id.length < 10) {
            throw new BadRequestException('Geçersiz soru ID');
        }
        await this.qnaService.deleteQuestion(id, req.user.id);
    }

    @Post(':id/favorite')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 30, ttl: 3600000 } }) // 30 favorites per hour
    async favoriteQuestion(@Request() req, @Param('id') id: string) {
        if (!id || id.length < 10) {
            throw new BadRequestException('Geçersiz soru ID');
        }
        await this.qnaService.favoriteQuestion(id, req.user.id);
        return { success: true };
    }

    @Delete(':id/favorite')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 30, ttl: 3600000 } }) // 30 unfavorites per hour
    async unfavoriteQuestion(@Request() req, @Param('id') id: string) {
        if (!id || id.length < 10) {
            throw new BadRequestException('Geçersiz soru ID');
        }
        await this.qnaService.unfavoriteQuestion(id, req.user.id);
        return { success: true };
    }

    @Post(':id/follow')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 30, ttl: 3600000 } }) // 30 follows per hour
    async followQuestion(@Request() req, @Param('id') id: string) {
        if (!id || id.length < 10) {
            throw new BadRequestException('Geçersiz soru ID');
        }
        await this.qnaService.followQuestion(id, req.user.id);
        return { success: true };
    }

    @Delete(':id/follow')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 30, ttl: 3600000 } }) // 30 unfollows per hour
    async unfollowQuestion(@Request() req, @Param('id') id: string) {
        if (!id || id.length < 10) {
            throw new BadRequestException('Geçersiz soru ID');
        }
        await this.qnaService.unfollowQuestion(id, req.user.id);
        return { success: true };
    }
}
