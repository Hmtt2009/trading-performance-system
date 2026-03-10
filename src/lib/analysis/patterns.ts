import type { ParsedTrade, BaselineData, PatternInstance } from '@/types';

/**
 * Run all 4 MVP pattern detectors on a set of trades.
 * Trades should be sorted chronologically.
 */
export function detectPatterns(
  trades: ParsedTrade[],
  baseline: BaselineData
): PatternInstance[] {
  if (baseline.totalTradesAnalyzed < 15) {
    return []; // Not enough data for pattern detection
  }

  const closedTrades = trades.filter((t) => !t.isOpen && t.netPnl !== null);
  if (closedTrades.length === 0) return [];

  const sorted = [...closedTrades].sort(
    (a, b) => a.entryTime.getTime() - b.entryTime.getTime()
  );

  const patterns: PatternInstance[] = [];

  patterns.push(...detectOvertrading(sorted, baseline));
  patterns.push(...detectSizeEscalation(sorted, baseline));
  patterns.push(...detectRapidReentry(sorted, baseline));
  patterns.push(...detectPrematureExit(sorted, baseline));

  return deduplicateImpact(patterns);
}

// ============================================
// PATTERN 1: OVERTRADING
// ============================================

function detectOvertrading(
  trades: ParsedTrade[],
  baseline: BaselineData
): PatternInstance[] {
  const patterns: PatternInstance[] = [];
  const byDate = groupByDate(trades);

  const threshold = baseline.avgTradesPerDay + 2 * baseline.stddevTradesPerDay;
  // Minimum threshold of avgTradesPerDay + 3 to avoid flagging on low-stddev baselines
  const effectiveThreshold = Math.max(threshold, baseline.avgTradesPerDay + 3);

  for (const [date, dayTrades] of Object.entries(byDate)) {
    if (dayTrades.length <= effectiveThreshold) continue;

    const excessCount = Math.round(dayTrades.length - baseline.avgTradesPerDay);
    // The "excess" trades are the last N trades of the day
    const excessTrades = dayTrades.slice(-excessCount);
    const dollarImpact = excessTrades.reduce((s, t) => s + (t.netPnl || 0), 0);

    const allIndices = dayTrades.map((t) => trades.indexOf(t));
    const triggerIndex = allIndices[allIndices.length - 1];

    // Check for same-ticker churn
    const tickerCounts = new Map<string, ParsedTrade[]>();
    for (const t of dayTrades) {
      const arr = tickerCounts.get(t.symbol) || [];
      arr.push(t);
      tickerCounts.set(t.symbol, arr);
    }
    const churnTickers = [...tickerCounts.entries()]
      .filter(([, tTrades]) => {
        if (tTrades.length <= 3) return false;
        const first = tTrades[0].entryTime.getTime();
        const last = tTrades[tTrades.length - 1].entryTime.getTime();
        return (last - first) / 60000 < 60; // Within 60 minutes
      })
      .map(([ticker]) => ticker);

    let description = `Overtrading detected: ${dayTrades.length} trades on ${date} (your average is ${Math.round(baseline.avgTradesPerDay)})`;
    if (churnTickers.length > 0) {
      description += `. Same-ticker churn on: ${churnTickers.join(', ')}`;
    }

    patterns.push({
      patternType: 'overtrading',
      confidence: 'high',
      severity: excessCount > baseline.avgTradesPerDay ? 'severe' : 'moderate',
      triggerTradeIndex: triggerIndex,
      involvedTradeIndices: allIndices,
      dollarImpact,
      description,
      detectionData: {
        date,
        tradeCount: dayTrades.length,
        avgTradesPerDay: baseline.avgTradesPerDay,
        threshold: effectiveThreshold,
        excessCount,
        churnTickers,
      },
    });
  }

  return patterns;
}

// ============================================
// PATTERN 2: SIZE ESCALATION AFTER LOSSES (Tilt)
// ============================================

function detectSizeEscalation(
  trades: ParsedTrade[],
  baseline: BaselineData
): PatternInstance[] {
  const patterns: PatternInstance[] = [];

  for (let i = 2; i < trades.length; i++) {
    // Check for 2+ consecutive losses before this trade
    let consecutiveLosses = 0;
    let lossSum = 0;
    for (let j = i - 1; j >= 0; j--) {
      if (trades[j].netPnl !== null && trades[j].netPnl! < 0) {
        consecutiveLosses++;
        lossSum += trades[j].netPnl!;
      } else {
        break;
      }
    }

    if (consecutiveLosses < 2) continue;

    const currentSize = trades[i].positionValue;
    const sizeThreshold = baseline.avgPositionSize * 1.5;

    if (currentSize <= sizeThreshold) continue;

    // Calculate what P&L would have been at normal size
    const pnlPercent = trades[i].pnlPercent || 0;
    const normalPnl = (pnlPercent / 100) * baseline.avgPositionSize;
    const actualPnl = trades[i].netPnl || 0;
    const dollarImpact = actualPnl - normalPnl; // Negative if loss was amplified

    const involvedIndices = [];
    for (let j = i - consecutiveLosses; j <= i; j++) {
      involvedIndices.push(j);
    }

    const lossDetails = [];
    for (let j = i - consecutiveLosses; j < i; j++) {
      lossDetails.push(`$${Math.abs(trades[j].netPnl!).toFixed(0)}`);
    }

    patterns.push({
      patternType: 'size_escalation',
      confidence: 'high',
      severity: currentSize > baseline.avgPositionSize * 2 ? 'severe' : 'moderate',
      triggerTradeIndex: i,
      involvedTradeIndices: involvedIndices,
      dollarImpact: Math.round(dollarImpact * 100) / 100,
      description: `Size escalation after ${consecutiveLosses} consecutive losses. After losing ${lossDetails.join(', ')}, position size increased to $${currentSize.toFixed(0)} (your average is $${baseline.avgPositionSize.toFixed(0)})`,
      detectionData: {
        consecutiveLosses,
        totalLossBeforeEscalation: lossSum,
        currentSize,
        avgSize: baseline.avgPositionSize,
        sizeMultiple: currentSize / baseline.avgPositionSize,
      },
    });
  }

  return patterns;
}

// ============================================
// PATTERN 3: RAPID RE-ENTRY AFTER LOSS (Revenge)
// ============================================

function detectRapidReentry(
  trades: ParsedTrade[],
  baseline: BaselineData
): PatternInstance[] {
  const patterns: PatternInstance[] = [];

  if (baseline.avgTimeBetweenTradesMinutes <= 0) return patterns;

  const rapidThreshold = baseline.avgTimeBetweenTradesMinutes * 0.4;

  for (let i = 1; i < trades.length; i++) {
    const prevTrade = trades[i - 1];
    const currTrade = trades[i];

    // Previous trade must be a loss
    if (prevTrade.netPnl === null || prevTrade.netPnl >= 0) continue;

    // Must be same trading day
    const prevDate = prevTrade.entryTime.toISOString().split('T')[0];
    const currDate = currTrade.entryTime.toISOString().split('T')[0];
    if (prevDate !== currDate) continue;

    // Calculate time gap
    const prevEnd = prevTrade.exitTime || prevTrade.entryTime;
    const timeGap = (currTrade.entryTime.getTime() - prevEnd.getTime()) / 60000;

    if (timeGap >= rapidThreshold || timeGap < 0) continue;

    // Determine severity
    let severity: 'minor' | 'moderate' | 'severe' = 'moderate';
    if (
      currTrade.positionValue >= prevTrade.positionValue ||
      currTrade.symbol === prevTrade.symbol
    ) {
      severity = 'severe';
    }

    const dollarImpact = currTrade.netPnl || 0;

    let description = `Possible revenge trade: re-entered ${Math.round(timeGap)} minutes after a $${Math.abs(prevTrade.netPnl).toFixed(0)} loss`;
    description += `. Your average time between trades is ${Math.round(baseline.avgTimeBetweenTradesMinutes)} minutes.`;
    if (currTrade.symbol === prevTrade.symbol) {
      description += ` Same ticker (${currTrade.symbol}).`;
    }
    if (currTrade.positionValue > baseline.avgPositionSize) {
      description += ` Position size $${currTrade.positionValue.toFixed(0)} (above your $${baseline.avgPositionSize.toFixed(0)} average).`;
    }

    patterns.push({
      patternType: 'rapid_reentry',
      confidence: 'medium',
      severity,
      triggerTradeIndex: i,
      involvedTradeIndices: [i - 1, i],
      dollarImpact: Math.round(dollarImpact * 100) / 100,
      description,
      detectionData: {
        timeGapMinutes: timeGap,
        avgGapMinutes: baseline.avgTimeBetweenTradesMinutes,
        rapidThreshold,
        prevLoss: prevTrade.netPnl,
        sameTicker: currTrade.symbol === prevTrade.symbol,
        sizeIncrease: currTrade.positionValue >= prevTrade.positionValue,
      },
    });
  }

  return patterns;
}

// ============================================
// PATTERN 4: PREMATURE PROFIT TAKING
// ============================================

function detectPrematureExit(
  trades: ParsedTrade[],
  baseline: BaselineData
): PatternInstance[] {
  const patterns: PatternInstance[] = [];

  if (baseline.avgWinningHoldTimeMinutes <= 0) return patterns;

  const holdThreshold = baseline.avgWinningHoldTimeMinutes * 0.4;

  for (let i = 0; i < trades.length; i++) {
    const trade = trades[i];

    // Must be a winning trade
    if (trade.netPnl === null || trade.netPnl <= 0) continue;
    if (trade.holdTimeMinutes === null) continue;

    // Must be held significantly less than average winning hold time
    if (trade.holdTimeMinutes >= holdThreshold) continue;

    // For MVP, we estimate "left on table" based on the ratio of hold time
    // to average hold time. Full implementation would use EOD price.
    // Conservative estimate: the profit ratio the trader captured vs. what
    // they typically capture at their average hold time.
    const holdRatio = trade.holdTimeMinutes / baseline.avgWinningHoldTimeMinutes;
    const estimatedFullProfit = trade.netPnl / holdRatio;
    const leftOnTable = Math.max(0, estimatedFullProfit - trade.netPnl);

    // Only flag if left significant profit on the table (>50% of captured profit)
    if (leftOnTable < trade.netPnl * 0.5) continue;

    patterns.push({
      patternType: 'premature_exit',
      confidence: 'medium',
      severity: leftOnTable > trade.netPnl * 2 ? 'severe' : 'moderate',
      triggerTradeIndex: i,
      involvedTradeIndices: [i],
      dollarImpact: Math.round(leftOnTable * 100) / 100,
      description: `Early exit on ${trade.symbol}: took $${trade.netPnl.toFixed(0)} profit after ${trade.holdTimeMinutes} minutes (your average winning hold: ${Math.round(baseline.avgWinningHoldTimeMinutes)} minutes). Estimated ~$${Math.round(leftOnTable)} left on the table.`,
      detectionData: {
        holdTimeMinutes: trade.holdTimeMinutes,
        avgWinningHoldMinutes: baseline.avgWinningHoldTimeMinutes,
        holdRatio,
        capturedProfit: trade.netPnl,
        estimatedFullProfit,
        leftOnTable,
      },
    });
  }

  return patterns;
}

// ============================================
// UTILITIES
// ============================================

function groupByDate(
  trades: ParsedTrade[]
): Record<string, ParsedTrade[]> {
  const groups: Record<string, ParsedTrade[]> = {};
  for (const trade of trades) {
    const date = trade.entryTime.toISOString().split('T')[0];
    if (!groups[date]) groups[date] = [];
    groups[date].push(trade);
  }
  return groups;
}

/**
 * If a trade is flagged by multiple patterns, avoid double-counting dollar impact.
 * Keep the pattern with the largest absolute dollar impact as the primary.
 */
function deduplicateImpact(patterns: PatternInstance[]): PatternInstance[] {
  // Track which trade indices have been counted
  const counted = new Map<number, { impact: number; patternIdx: number }>();

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const triggerIdx = pattern.triggerTradeIndex;

    const existing = counted.get(triggerIdx);
    if (existing) {
      // Keep the one with larger absolute impact
      if (Math.abs(pattern.dollarImpact) > Math.abs(existing.impact)) {
        // Zero out the old one's impact
        patterns[existing.patternIdx].dollarImpact = 0;
        counted.set(triggerIdx, { impact: pattern.dollarImpact, patternIdx: i });
      } else {
        // Zero out this one's impact (keep the detection but not the dollar count)
        pattern.dollarImpact = 0;
      }
    } else {
      counted.set(triggerIdx, { impact: pattern.dollarImpact, patternIdx: i });
    }
  }

  return patterns;
}
