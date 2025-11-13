import { Controller, Get, Post, Param, Body, Headers } from '@nestjs/common';
import { AppService } from './app.service';
import { RedisService } from './redis.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly redisService: RedisService
  ) {}

  @Get('health')
  getHealth() {
    return { status: 'ok', service: 'api', timestamp: new Date().toISOString() };
  }

  @Get('info')
  getInfo() {
    return {
      name: 'Belo API Service',
      version: '1.0.0',
      description: 'Simple NestJS API for Belo microservices',
      endpoints: ['/health', '/info', '/me', '/items']
    };
  }

  @Get('me')
  getCurrentUser(@Headers('X-User') username?: string) {
    return {
      username: username || 'anonymous',
      authenticated: !!username,
      source: 'Belo-auth'
    };
  }

  @Get('items')
  getItems() {
    return this.appService.getItems();
  }

  @Post('keys')
  async setKey(@Body() body: { key: string; value: string; ttl?: number }) {
    await this.redisService.set(body.key, body.value, body.ttl);
    return { success: true, key: body.key };
  }

  @Get('keys/:key')
  async getKey(@Param('key') key: string) {
    const value = await this.redisService.get(key);
    if (value === null) {
      return { found: false, key };
    }
    return { found: true, key, value };
  }
}