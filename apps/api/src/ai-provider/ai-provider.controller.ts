import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../common/guards/admin.guard';
import { AIProviderService, CreateAIProviderDto, UpdateAIProviderDto } from './ai-provider.service';
import { AIProvider } from '@prisma/client';

@Controller('ai-providers')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class AIProviderController {
    constructor(private readonly aiProviderService: AIProviderService) { }

    @Get()
    async getAll() {
        const providers = await this.aiProviderService.getAll();
        // Mask API keys in response
        return providers.map((p) => ({
            ...p,
            apiKey: this.maskApiKey(p.apiKey),
        }));
    }

    @Get('active')
    async getActive() {
        const providers = await this.aiProviderService.getActive();
        return providers.map((p) => ({
            ...p,
            apiKey: this.maskApiKey(p.apiKey),
        }));
    }

    @Get('runtime/status')
    async getRuntimeStatus() {
        return this.aiProviderService.getRuntimeStatus();
    }

    @Get(':provider')
    async getOne(@Param('provider') provider: AIProvider) {
        const config = await this.aiProviderService.getByProvider(provider);
        if (!config) {
            throw new NotFoundException(`AI sağlayıcı bulunamadı: ${provider}`);
        }
        return {
            ...config,
            apiKey: this.maskApiKey(config.apiKey),
        };
    }

    @Post()
    async create(@Body() data: CreateAIProviderDto) {
        const created = await this.aiProviderService.create(data);
        return {
            ...created,
            apiKey: this.maskApiKey(created.apiKey),
        };
    }

    @Put(':provider')
    async update(
        @Param('provider') provider: AIProvider,
        @Body() data: UpdateAIProviderDto,
    ) {
        const updated = await this.aiProviderService.update(provider, data);
        return {
            ...updated,
            apiKey: this.maskApiKey(updated.apiKey),
        };
    }

    @Post(':provider/toggle')
    async toggleActive(@Param('provider') provider: AIProvider) {
        const updated = await this.aiProviderService.toggleActive(provider);
        return {
            ...updated,
            apiKey: this.maskApiKey(updated.apiKey),
        };
    }

    @Post(':provider/test')
    async testConnection(
        @Param('provider') provider: AIProvider,
        @Body() body?: { prompt?: string },
    ) {
        return this.aiProviderService.testConnection(provider, body?.prompt);
    }

    @Delete(':provider')
    async delete(@Param('provider') provider: AIProvider) {
        await this.aiProviderService.delete(provider);
        return { success: true };
    }

    private maskApiKey(apiKey: string): string {
        if (!apiKey || apiKey.length < 8) return '***';
        return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
    }
}
