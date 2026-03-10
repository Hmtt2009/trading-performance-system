import type { SessionAnalysis, BaselineData } from '@/types';

/**
 * Build the structured input for the AI debrief prompt.
 * The LLM receives facts only — it explains, never analyzes.
 */
export function buildDebriefInput(
  session: SessionAnalysis,
  baseline: BaselineData
): Record<string, unknown> {
  const trades = session.trades
    .filter((t) => !t.isOpen && t.netPnl !== null)
    .map((t) => ({
      symbol: t.symbol,
      direction: t.direction,
      entryTime: t.entryTime.toISOString(),
      exitTime: t.exitTime?.toISOString(),
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      quantity: t.quantity,
      netPnl: t.netPnl,
      holdTimeMinutes: t.holdTimeMinutes,
      positionValue: t.positionValue,
    }));

  return {
    sessionDate: session.sessionDate,
    summary: {
      totalTrades: session.totalTrades,
      winningTrades: session.winningTrades,
      losingTrades: session.losingTrades,
      netPnl: session.netPnl,
      winRate: session.winRate,
    },
    trades,
    patterns: session.patterns.map((p) => ({
      type: p.patternType,
      confidence: p.confidence,
      severity: p.severity,
      dollarImpact: p.dollarImpact,
      description: p.description,
    })),
    behaviorCost: session.behaviorCost,
    baseline: {
      avgTradesPerDay: baseline.avgTradesPerDay,
      avgPositionSize: baseline.avgPositionSize,
      avgHoldTimeMinutes: baseline.avgHoldTimeMinutes,
      overallWinRate: baseline.overallWinRate,
    },
  };
}

/**
 * Build the system prompt for the AI debrief.
 */
export function getDebriefSystemPrompt(): string {
  return `You are a professional trading performance coach. You analyze structured trading data and deliver honest, specific, actionable feedback.

You are direct but warm. You reference specific trades by ticker and time. You never invent data. You only use the facts provided.

Rules:
- Reference trades by ticker and time (e.g., "Your AAPL trade at 10:47 AM")
- Use actual dollar amounts from the data
- If a pattern has medium confidence, say "possible" or "likely"
- Do not lecture. Be specific and useful.
- Keep it under 400 words.
- Do not use emojis.`;
}

/**
 * Build the user prompt for the AI debrief.
 */
export function getDebriefUserPrompt(input: Record<string, unknown>): string {
  return `Here is today's trading session data:

${JSON.stringify(input, null, 2)}

Generate a coaching debrief with this structure:
1. Session summary (1-2 sentences: net result + key observation)
2. What went well (specific trades with evidence)
3. What went wrong (specific patterns with evidence)
4. Cost of behavior today (the dollar amount behavioral patterns cost)
5. One specific, actionable recommendation for next session`;
}
