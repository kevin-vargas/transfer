import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BalanceAudit, AuditOperation } from '../entities/balance-audit.entity';
import { User } from '../entities/user.entity';

export interface RiskAssessment {
  userId: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: string[];
  aiAnalysis?: string;
  recommendations: string[];
}

@Injectable()
export class RiskService {
  constructor(
    @InjectRepository(BalanceAudit)
    private balanceAuditRepository: Repository<BalanceAudit>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async assessUserRisk(userId: string): Promise<RiskAssessment> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const audits = await this.balanceAuditRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 100,
    });

    if (audits.length === 0) {
      return {
        userId,
        riskScore: 0,
        riskLevel: 'LOW',
        factors: ['No transaction history'],
        recommendations: ['Start using the account to establish patterns'],
      };
    }

    const metrics = this.calculateMetrics(audits, user);
    const algorithmicScore = this.calculateAlgorithmicRiskScore(metrics);
    
    let aiAnalysis = '';
    let finalScore = algorithmicScore;
    
    try {
      const aiResult = await this.getAIRiskAssessment(metrics);
      aiAnalysis = aiResult.analysis;
      finalScore = Math.round((algorithmicScore + aiResult.score) / 2);
    } catch (error) {
      console.error('AI analysis failed, using algorithmic score only:', error);
    }

    const riskLevel = this.determineRiskLevel(finalScore);
    const factors = this.identifyRiskFactors(metrics);
    const recommendations = this.generateRecommendations(riskLevel, factors);

    return {
      userId,
      riskScore: finalScore,
      riskLevel,
      factors,
      aiAnalysis,
      recommendations,
    };
  }

  private calculateMetrics(audits: BalanceAudit[], user: User) {
    const credits = audits.filter(a => a.operation === AuditOperation.CREDIT);
    const debits = audits.filter(a => a.operation === AuditOperation.DEBIT);
    
    const amounts = audits.map(a => Math.abs(a.amount));
    const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 0;

    return {
      totalTransactions: audits.length,
      creditCount: credits.length,
      debitCount: debits.length,
      maxAmount,
      currentBalance: user.balance,
      totalCredits: credits.reduce((sum, c) => sum + c.amount, 0),
      totalDebits: debits.reduce((sum, d) => sum + Math.abs(d.amount), 0),
    };
  }

  private calculateAlgorithmicRiskScore(metrics: any): number {
    let score = 0;

    if (metrics.maxAmount > 1000) score += 20;
    if (metrics.debitCount > metrics.creditCount * 2) score += 30;
    if (metrics.currentBalance < 0) score += 40;
    else if (metrics.currentBalance < 100) score += 10;

    return Math.min(score, 100);
  }

  private async getAIRiskAssessment(metrics: any): Promise<{score: number, analysis: string}> {
    const prompt = `Analyze this user's financial behavior and assess risk (0-100):
    
Balance: $${metrics.currentBalance}
Transactions: ${metrics.totalTransactions} total (${metrics.creditCount} credits, ${metrics.debitCount} debits)
Max amount: $${metrics.maxAmount}
Pattern: ${metrics.totalCredits > metrics.totalDebits ? 'Net income' : 'Net spending'}

Provide risk score (0-100) and brief analysis in this format:
SCORE: [number]
ANALYSIS: [2-3 sentences about risk factors and patterns]`;

    try {
      const response = await fetch('http://gem:8080/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error(`Gem service error: ${response.status}`);
      }

      const result = await response.json() as { result?: string };
      const aiResponse = result.result || '';
      
      const scoreMatch = aiResponse.match(/SCORE:\s*(\d+)/i);
      const analysisMatch = aiResponse.match(/ANALYSIS:\s*(.+)/i);
      
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 50;
      const analysis = analysisMatch ? analysisMatch[1].trim() : 'AI analysis unavailable';
      
      return { score: Math.min(Math.max(score, 0), 100), analysis };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get AI assessment: ${errorMessage}`);
    }
  }

  private determineRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
  }

  private identifyRiskFactors(metrics: any): string[] {
    const factors = [];
    
    if (metrics.maxAmount > 1000) factors.push('Large transaction amounts');
    if (metrics.debitCount > metrics.creditCount * 2) factors.push('Heavy spending pattern');
    if (metrics.currentBalance < 0) factors.push('Negative balance');
    if (metrics.currentBalance < 100 && metrics.currentBalance >= 0) factors.push('Low balance');
    
    return factors.length > 0 ? factors : ['Normal activity patterns'];
  }

  private generateRecommendations(riskLevel: string, factors: string[]): string[] {
    const recommendations = [];
    
    if (riskLevel === 'CRITICAL') {
      recommendations.push('Immediate review required');
      recommendations.push('Consider account restrictions');
    } else if (riskLevel === 'HIGH') {
      recommendations.push('Enhanced monitoring recommended');
      recommendations.push('Verify large transactions');
    } else if (riskLevel === 'MEDIUM') {
      recommendations.push('Regular monitoring sufficient');
    } else {
      recommendations.push('Standard monitoring');
    }
    
    if (factors.includes('Negative balance')) {
      recommendations.push('Address negative balance immediately');
    }
    
    if (factors.includes('High transaction frequency')) {
      recommendations.push('Review transaction patterns');
    }
    
    return recommendations;
  }
}