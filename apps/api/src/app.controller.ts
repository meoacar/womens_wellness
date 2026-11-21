import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get(['healthz', 'health'])
  async healthCheck(@Res({ passthrough: true }) res?: FastifyReply) {
    const health = await this.appService.getHealthStatus();
    if (health.status === 'unhealthy' && res) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return health;
  }

  @Get('public/site-summary')
  async getPublicSiteSummary() {
    return this.appService.getPublicSiteSummary();
  }
}
