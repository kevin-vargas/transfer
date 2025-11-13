import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { RiskService, RiskAssessment } from '../services/risk.service';

@Controller('users')
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Get(':id/risk')
  async getUserRisk(@Param('id') id: string): Promise<RiskAssessment> {
    if (!id || id.trim() === '') {
      throw new HttpException('User ID is required', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.riskService.assessUserRisk(id);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to assess user risk',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}