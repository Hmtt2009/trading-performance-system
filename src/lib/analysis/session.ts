import type { ParsedTrade, BaselineData, SessionAnalysis, CostOfBehavior, PatternType } from '@/types';
import { detectPatterns } from './patterns';

/**
 * Analyze a single trading session (one day's trades).
 */
export function analyzeSession(
  trades: ParsedTrade[],
  baseline: BaselineData,
  date: string
): SessionAnalysis {
  const closedTrades = trades.filter((t) => !t.isOpen && t.netPnl !== null);

  const winningTrades = closedTrades.filter((t) => t.netPnl! > 0).length;
  const losingTrades = closedTrades.filter((t) => t.netPnl! <= 0).length;
  const grossPnl = closedTrades.reduce((s, t) => s + (t.grossPnl || 0), 0);
  const netPnl = closedTrades.reduce((s, t) => s + (t.netPnl || 0), 0);
  const winRate = closedTrades.length > 0 ? winningTrades / closedTrades.length : 0;

  const patterns = detectPatterns(trades, baseline);
  const behaviorCost = patterns.reduce((s, p) => {
    // Only count negative impacts (losses) as behavior cost
    // Positive impacts (profitable but flagged trades) are not costs
    if (p.patternType === 'premature_exit') {
      return s + p.dollarImpact; // Always positive = profit left on table
    }
    return s + Math.max(0, -p.dollarImpact); // Only count losses
  }, 0);

  return {
    sessionDate: date,
    totalTrades: closedTrades.length,
    winningTrades,
    losingTrades,
    grossPnl: Math.round(grossPnl * 100) / 100,
    netPnl: Math.round(netPnl * 100) / 100,
    winRate: Math.round(winRate * 10000) / 10000,
    patterns,
    behaviorCost: Math.round(behaviorCost * 100) / 100,
    trades,
  };
}

/**
 * Analyze multiple sessions and compute aggregate "Cost of Behavior".
 */
export function computeCostOfBehavior(
  sessions: SessionAnalysis[]
): CostOfBehavior {
  const allPatterns = sessions.flatMap((s) => s.patterns);
  const actualPnl = sessions.reduce((s, sess) => s + sess.netPnl, 0);

  // Group by pattern type
  const byType = new Map<string, { instances: number; totalImpact: number }>();
  for (const p of allPatterns) {
    const existing = byType.get(p.patternType) || { instances: 0, totalImpact: 0 };
    existing.instances++;
    if (p.patternType === 'premature_exit') {
      existing.totalImpact += p.dollarImpact; // Always positive = profit left on table
    } else {
      existing.totalImpact += Math.max(0, -p.dollarImpact); // Only count losses
    }
    byType.set(p.patternType, existing);
  }

  const totalBehaviorCost = [...byType.values()].reduce(
    (s, v) => s + v.totalImpact,
    0
  );

  // Simulated P&L = actual P&L + behavior cost (since cost is negative impact)
  const simulatedPnl = actualPnl + totalBehaviorCost;

  return {
    totalBehaviorCost: Math.round(totalBehaviorCost * 100) / 100,
    actualPnl: Math.round(actualPnl * 100) / 100,
    simulatedPnl: Math.round(simulatedPnl * 100) / 100,
    byPattern: [...byType.entries()].map(([type, data]) => ({
      patternType: type as PatternType,
      instances: data.instances,
      totalImpact: Math.round(data.totalImpact * 100) / 100,
    })),
  };
}
