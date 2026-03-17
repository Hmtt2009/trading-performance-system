import { describe, it, expect } from 'vitest';
import { buildDebriefInput, getDebriefSystemPrompt, getDebriefUserPrompt } from '@/lib/ai/debrief';
import type { ParsedTrade, SessionAnalysis, BaselineData, PatternInstance } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTrade(overrides: Partial<ParsedTrade> = {}): ParsedTrade {
  return {
    symbol: 'AAPL',
    direction: 'long',
    entryTime: new Date('2024-03-15T10:00:00'),
    exitTime: new Date('2024-03-15T10:30:00'),
    entryPrice: 170,
    exitPrice: 171,
    quantity: 100,
    totalCommission: 2,
    grossPnl: 100,
    netPnl: 98,
    pnlPercent: 0.5882,
    holdTimeMinutes: 30,
    positionValue: 17000,
    isOpen: false,
    executionHash: `hash-${Math.random()}`,
    executions: [],
    ...overrides,
  };
}

function makeBaseline(overrides: Partial<BaselineData> = {}): BaselineData {
  return {
    avgTradesPerDay: 5,
    stddevTradesPerDay: 1.2,
    avgPositionSize: 17000,
    stddevPositionSize: 3000,
    avgHoldTimeMinutes: 25,
    avgTimeBetweenTradesMinutes: 45,
    avgWinningHoldTimeMinutes: 30,
    avgLosingHoldTimeMinutes: 15,
    overallWinRate: 0.55,
    totalTradesAnalyzed: 100,
    performanceByHour: {},
    performanceByDow: {},
    ...overrides,
  };
}

function makeSession(overrides: Partial<SessionAnalysis> = {}): SessionAnalysis {
  return {
    sessionDate: '2024-03-15',
    totalTrades: 5,
    winningTrades: 3,
    losingTrades: 2,
    grossPnl: 320,
    netPnl: 310,
    winRate: 0.6,
    patterns: [],
    behaviorCost: 0,
    trades: [
      makeTrade({ symbol: 'AAPL', netPnl: 98, isOpen: false }),
      makeTrade({ symbol: 'MSFT', netPnl: 150, isOpen: false }),
      makeTrade({ symbol: 'TSLA', netPnl: -48, isOpen: false }),
      makeTrade({ symbol: 'GOOG', netPnl: 160, isOpen: false }),
      makeTrade({ symbol: 'NVDA', netPnl: -50, isOpen: false }),
    ],
    ...overrides,
  };
}

function makePattern(overrides: Partial<PatternInstance> = {}): PatternInstance {
  return {
    patternType: 'overtrading',
    confidence: 'high',
    severity: 'moderate',
    triggerTradeIndex: 6,
    involvedTradeIndices: [5, 6, 7],
    dollarImpact: -120,
    description: 'Exceeded baseline trade count by 2 standard deviations',
    detectionData: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildDebriefInput()
// ---------------------------------------------------------------------------

describe('buildDebriefInput', () => {
  it('should return correct top-level structure', () => {
    const session = makeSession();
    const baseline = makeBaseline();
    const result = buildDebriefInput(session, baseline);

    expect(result).toHaveProperty('sessionDate', '2024-03-15');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('trades');
    expect(result).toHaveProperty('patterns');
    expect(result).toHaveProperty('behaviorCost');
    expect(result).toHaveProperty('baseline');
  });

  it('should populate summary with correct values', () => {
    const session = makeSession({
      totalTrades: 8,
      winningTrades: 5,
      losingTrades: 3,
      netPnl: 450,
      winRate: 0.625,
    });
    const result = buildDebriefInput(session, makeBaseline());
    const summary = result.summary as Record<string, unknown>;

    expect(summary.totalTrades).toBe(8);
    expect(summary.winningTrades).toBe(5);
    expect(summary.losingTrades).toBe(3);
    expect(summary.netPnl).toBe(450);
    expect(summary.winRate).toBe(0.625);
  });

  it('should filter out open trades', () => {
    const session = makeSession({
      trades: [
        makeTrade({ symbol: 'AAPL', netPnl: 98, isOpen: false }),
        makeTrade({ symbol: 'MSFT', netPnl: null, isOpen: true }),
      ],
    });
    const result = buildDebriefInput(session, makeBaseline());
    const trades = result.trades as unknown[];

    // The open trade (isOpen: true) should be filtered out
    expect(trades).toHaveLength(1);
  });

  it('should filter out trades with null netPnl', () => {
    const session = makeSession({
      trades: [
        makeTrade({ symbol: 'AAPL', netPnl: 98, isOpen: false }),
        makeTrade({ symbol: 'MSFT', netPnl: null, isOpen: false }),
      ],
    });
    const result = buildDebriefInput(session, makeBaseline());
    const trades = result.trades as unknown[];

    expect(trades).toHaveLength(1);
  });

  it('should map trade fields correctly', () => {
    const entryTime = new Date('2024-03-15T10:47:00Z');
    const exitTime = new Date('2024-03-15T11:15:00Z');
    const session = makeSession({
      trades: [
        makeTrade({
          symbol: 'AAPL',
          direction: 'long',
          entryTime,
          exitTime,
          entryPrice: 170.5,
          exitPrice: 172.0,
          quantity: 200,
          netPnl: 298,
          holdTimeMinutes: 28,
          positionValue: 34100,
          isOpen: false,
        }),
      ],
    });

    const result = buildDebriefInput(session, makeBaseline());
    const trades = result.trades as Record<string, unknown>[];

    expect(trades).toHaveLength(1);
    expect(trades[0].symbol).toBe('AAPL');
    expect(trades[0].direction).toBe('long');
    expect(trades[0].entryTime).toBe(entryTime.toISOString());
    expect(trades[0].exitTime).toBe(exitTime.toISOString());
    expect(trades[0].entryPrice).toBe(170.5);
    expect(trades[0].exitPrice).toBe(172.0);
    expect(trades[0].quantity).toBe(200);
    expect(trades[0].netPnl).toBe(298);
    expect(trades[0].holdTimeMinutes).toBe(28);
    expect(trades[0].positionValue).toBe(34100);
  });

  it('should handle exitTime being null on a closed trade', () => {
    // Edge case: closed trade but exitTime is null
    const session = makeSession({
      trades: [
        makeTrade({ symbol: 'SPY', exitTime: null, netPnl: 50, isOpen: false }),
      ],
    });
    const result = buildDebriefInput(session, makeBaseline());
    const trades = result.trades as Record<string, unknown>[];

    expect(trades).toHaveLength(1);
    expect(trades[0].exitTime).toBeUndefined();
  });

  it('should map patterns correctly', () => {
    const session = makeSession({
      patterns: [
        makePattern({
          patternType: 'overtrading',
          confidence: 'high',
          severity: 'severe',
          dollarImpact: -250,
          description: 'Traded 12 times vs baseline of 5',
        }),
        makePattern({
          patternType: 'rapid_reentry',
          confidence: 'medium',
          severity: 'minor',
          dollarImpact: -80,
          description: 'Re-entered TSLA within 3 minutes after a loss',
        }),
      ],
    });

    const result = buildDebriefInput(session, makeBaseline());
    const patterns = result.patterns as Record<string, unknown>[];

    expect(patterns).toHaveLength(2);
    expect(patterns[0].type).toBe('overtrading');
    expect(patterns[0].confidence).toBe('high');
    expect(patterns[0].severity).toBe('severe');
    expect(patterns[0].dollarImpact).toBe(-250);
    expect(patterns[0].description).toBe('Traded 12 times vs baseline of 5');

    expect(patterns[1].type).toBe('rapid_reentry');
    expect(patterns[1].confidence).toBe('medium');
  });

  it('should include behaviorCost from session', () => {
    const session = makeSession({ behaviorCost: -330 });
    const result = buildDebriefInput(session, makeBaseline());

    expect(result.behaviorCost).toBe(-330);
  });

  it('should extract baseline subset correctly', () => {
    const baseline = makeBaseline({
      avgTradesPerDay: 6.5,
      avgPositionSize: 22000,
      avgHoldTimeMinutes: 18,
      overallWinRate: 0.58,
    });
    const result = buildDebriefInput(makeSession(), baseline);
    const baselineOutput = result.baseline as Record<string, unknown>;

    expect(baselineOutput.avgTradesPerDay).toBe(6.5);
    expect(baselineOutput.avgPositionSize).toBe(22000);
    expect(baselineOutput.avgHoldTimeMinutes).toBe(18);
    expect(baselineOutput.overallWinRate).toBe(0.58);
    // Should not leak extra baseline fields
    expect(baselineOutput).not.toHaveProperty('stddevTradesPerDay');
    expect(baselineOutput).not.toHaveProperty('stddevPositionSize');
    expect(baselineOutput).not.toHaveProperty('totalTradesAnalyzed');
  });

  // --- Edge case: day with no trades ---
  it('should handle a session with no trades', () => {
    const session = makeSession({
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      netPnl: 0,
      winRate: 0,
      trades: [],
      patterns: [],
      behaviorCost: 0,
    });
    const result = buildDebriefInput(session, makeBaseline());
    const trades = result.trades as unknown[];
    const patterns = result.patterns as unknown[];

    expect(trades).toHaveLength(0);
    expect(patterns).toHaveLength(0);
    expect((result.summary as Record<string, unknown>).totalTrades).toBe(0);
    expect(result.behaviorCost).toBe(0);
  });

  // --- Edge case: all winning trades ---
  it('should handle a session with all winning trades', () => {
    const winners = Array.from({ length: 4 }, (_, i) =>
      makeTrade({
        symbol: ['AAPL', 'MSFT', 'GOOG', 'AMZN'][i],
        netPnl: 100 + i * 50,
        isOpen: false,
      })
    );
    const session = makeSession({
      totalTrades: 4,
      winningTrades: 4,
      losingTrades: 0,
      netPnl: 700,
      winRate: 1.0,
      trades: winners,
      patterns: [],
      behaviorCost: 0,
    });
    const result = buildDebriefInput(session, makeBaseline());
    const summary = result.summary as Record<string, unknown>;

    expect(summary.winRate).toBe(1.0);
    expect(summary.losingTrades).toBe(0);
    expect((result.trades as unknown[]).length).toBe(4);
  });

  // --- Edge case: day with all four patterns detected ---
  it('should handle a session with all four pattern types', () => {
    const allPatterns: PatternInstance[] = [
      makePattern({ patternType: 'overtrading', dollarImpact: -200 }),
      makePattern({ patternType: 'size_escalation', dollarImpact: -150 }),
      makePattern({ patternType: 'rapid_reentry', dollarImpact: -100 }),
      makePattern({ patternType: 'premature_exit', dollarImpact: -75 }),
    ];
    const session = makeSession({
      patterns: allPatterns,
      behaviorCost: -525,
    });
    const result = buildDebriefInput(session, makeBaseline());
    const patterns = result.patterns as Record<string, unknown>[];

    expect(patterns).toHaveLength(4);
    const types = patterns.map((p) => p.type);
    expect(types).toContain('overtrading');
    expect(types).toContain('size_escalation');
    expect(types).toContain('rapid_reentry');
    expect(types).toContain('premature_exit');
  });
});

// ---------------------------------------------------------------------------
// getDebriefSystemPrompt()
// ---------------------------------------------------------------------------

describe('getDebriefSystemPrompt', () => {
  it('should return a non-empty string', () => {
    const prompt = getDebriefSystemPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('should contain the coaching role', () => {
    const prompt = getDebriefSystemPrompt();
    expect(prompt).toContain('trading performance coach');
  });

  it('should instruct to reference trades by ticker and time', () => {
    const prompt = getDebriefSystemPrompt();
    expect(prompt).toContain('ticker and time');
  });

  it('should instruct to use actual dollar amounts', () => {
    const prompt = getDebriefSystemPrompt();
    expect(prompt).toContain('dollar amounts');
  });

  it('should instruct medium confidence language', () => {
    const prompt = getDebriefSystemPrompt();
    expect(prompt).toContain('medium confidence');
    expect(prompt).toMatch(/possible|likely/);
  });

  it('should set a word limit', () => {
    const prompt = getDebriefSystemPrompt();
    expect(prompt).toContain('400 words');
  });

  it('should instruct not to use emojis', () => {
    const prompt = getDebriefSystemPrompt();
    expect(prompt.toLowerCase()).toContain('emojis');
  });

  it('should instruct not to invent data', () => {
    const prompt = getDebriefSystemPrompt();
    expect(prompt).toContain('never invent');
  });
});

// ---------------------------------------------------------------------------
// getDebriefUserPrompt()
// ---------------------------------------------------------------------------

describe('getDebriefUserPrompt', () => {
  it('should return a non-empty string', () => {
    const input = buildDebriefInput(makeSession(), makeBaseline());
    const prompt = getDebriefUserPrompt(input);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('should include the JSON-serialized session data', () => {
    const session = makeSession({ sessionDate: '2024-03-15', netPnl: 310 });
    const input = buildDebriefInput(session, makeBaseline());
    const prompt = getDebriefUserPrompt(input);

    expect(prompt).toContain('"sessionDate": "2024-03-15"');
    expect(prompt).toContain('"netPnl": 310');
  });

  it('should contain the five debrief sections in instructions', () => {
    const prompt = getDebriefUserPrompt({});
    expect(prompt).toContain('Session summary');
    expect(prompt).toContain('What went well');
    expect(prompt).toContain('What went wrong');
    expect(prompt).toContain('Cost of behavior');
    expect(prompt).toContain('actionable recommendation');
  });

  it('should embed trade symbols in the prompt for a normal day', () => {
    const session = makeSession();
    const input = buildDebriefInput(session, makeBaseline());
    const prompt = getDebriefUserPrompt(input);

    expect(prompt).toContain('AAPL');
    expect(prompt).toContain('MSFT');
    expect(prompt).toContain('TSLA');
  });

  it('should work with an empty input object', () => {
    const prompt = getDebriefUserPrompt({});
    expect(prompt).toContain('{}');
    expect(prompt).toContain('coaching debrief');
  });

  it('should include pattern data when patterns exist', () => {
    const session = makeSession({
      patterns: [
        makePattern({
          patternType: 'overtrading',
          confidence: 'high',
          dollarImpact: -200,
        }),
      ],
      behaviorCost: -200,
    });
    const input = buildDebriefInput(session, makeBaseline());
    const prompt = getDebriefUserPrompt(input);

    expect(prompt).toContain('"type": "overtrading"');
    expect(prompt).toContain('"confidence": "high"');
    expect(prompt).toContain('"dollarImpact": -200');
  });

  it('should include baseline data in the prompt', () => {
    const baseline = makeBaseline({
      avgTradesPerDay: 7.3,
      overallWinRate: 0.62,
    });
    const input = buildDebriefInput(makeSession(), baseline);
    const prompt = getDebriefUserPrompt(input);

    expect(prompt).toContain('"avgTradesPerDay": 7.3');
    expect(prompt).toContain('"overallWinRate": 0.62');
  });

  it('should produce valid JSON within the prompt for a complex session', () => {
    const session = makeSession({
      patterns: [
        makePattern({ patternType: 'size_escalation', confidence: 'medium' }),
        makePattern({ patternType: 'rapid_reentry', confidence: 'high' }),
      ],
      behaviorCost: -300,
    });
    const input = buildDebriefInput(session, makeBaseline());
    const prompt = getDebriefUserPrompt(input);

    // Extract the JSON block from the prompt — it sits between the intro line and the instruction line
    const jsonStart = prompt.indexOf('{');
    const jsonEnd = prompt.lastIndexOf('}');
    const jsonStr = prompt.slice(jsonStart, jsonEnd + 1);

    expect(() => JSON.parse(jsonStr)).not.toThrow();
  });

  it('should handle a zero-trade session gracefully', () => {
    const session = makeSession({
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      netPnl: 0,
      winRate: 0,
      trades: [],
      patterns: [],
      behaviorCost: 0,
    });
    const input = buildDebriefInput(session, makeBaseline());
    const prompt = getDebriefUserPrompt(input);

    expect(prompt).toContain('"totalTrades": 0');
    expect(prompt).toContain('"trades": []');
  });
});
