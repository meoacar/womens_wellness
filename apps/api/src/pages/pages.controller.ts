import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PagesService, CreatePageDto, UpdatePageDto } from './pages.service';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('pages')
export class PagesController {
    constructor(private readonly pagesService: PagesService) { }

    // Public endpoint - Get all active pages (rate limited)
    @Get()
    @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests per minute
    async findAll(@Query('isActive') isActive?: string) {
        const isActiveFilter = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
        return this.pagesService.findAll(isActiveFilter);
    }

    // Public endpoint - Get page by slug (rate limited)
    @Get('slug/:slug')
    @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests per minute
    async findBySlug(@Param('slug') slug: string) {
        return this.pagesService.findBySlug(slug);
    }

    // Admin endpoints - Protected with JWT + Admin Guard
    @Get('admin/list')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async adminFindAll(@Query('isActive') isActive?: string) {
        const isActiveFilter = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
        return this.pagesService.findAll(isActiveFilter);
    }

    @Get('admin/templates')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async adminGetTemplates() {
        return this.pagesService.getTemplates();
    }

    @Post('admin/restore-defaults')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async adminRestoreDefaults(@Body() body?: { slug?: string }) {
        return this.pagesService.restoreDefaultBySlug(body?.slug || 'ALL');
    }

    @Get('admin/:id')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async findById(@Param('id') id: string) {
        return this.pagesService.findById(id);
    }

    @Post()
    @UseGuards(JwtAuthGuard, AdminGuard)
    async create(@Body() data: CreatePageDto) {
        return this.pagesService.create(data);
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async update(@Param('id') id: string, @Body() data: UpdatePageDto) {
        return this.pagesService.update(id, data);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, AdminGuard)
    async delete(@Param('id') id: string) {
        return this.pagesService.delete(id);
    }
}
