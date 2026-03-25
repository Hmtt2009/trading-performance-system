export * from './database';
import type { PatternType, ConfidenceLevel, Severity } from './database';

// Parser types

export interface RawExecution {
  symbol: string;
  dateTime: Date;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  commission: number;
  assetCategory: string;
  currency: string;
  accountId: string;
  rawRow: Record<string, string>;
}

export interface ParseResult {
  executions: RawExecution[];
  trades: ParsedTrade[];
  errors: ParseError[];
  duplicateHashes: string[];
  metadata: {
    brokerFormat: string;
    totalRows: number;
    parsedRows: number;
    skippedRows: number;
    errorRows: number;
    optionsSkipped: number;
  };
}

export interface ParsedTrade {
  symbol: string;
  direction: 'long' | 'short';
  entryTime: Date;
  exitTime: Date | null;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  totalCommission: number;
  grossPnl: number | null;
  netPnl: number | null;
  pnlPercent: number | null;
  holdTimeMinutes: number | null;
  positionValue: number;
  isOpen: boolean;
  executionHash: string;
  executions: RawExecution[];
}

export interface ParseError {
  row: number;
  message: string;
  rawData?: string;
}

// Analysis types

export interface BaselineData {
  avgTradesPerDay: number;
  stddevTradesPerDay: number;
  avgPositionSize: number;
  stddevPositionSize: number;
  avgHoldTimeMinutes: number;
  avgTimeBetweenTradesMinutes: number;
  avgWinningHoldTimeMinutes: number;
  avgLosingHoldTimeMinutes: number;
  overallWinRate: number;
  totalTradesAnalyzed: number;
  performanceByHour: Record<string, { trades: number; winRate: number; avgPnl: number; totalPnl: number }>;
  performanceByDow: Record<string, { trades: number; winRate: number; avgPnl: number; totalPnl: number }>;
}

export interface PostExitData {
  exitPrice: number;
  priceAt1h: number | null;
  priceAt2h: number | null;
  priceAt4h: number | null;
  maxMovePercent: number;
  direction: 'up' | 'down' | 'flat';
}

export interface PatternInstance {
  patternType: PatternType;
  confidence: ConfidenceLevel;
  severity: Severity;
  triggerTradeIndex: number;
  involvedTradeIndices: number[];
  dollarImpact: number;
  description: string;
  detectionData: Record<string, unknown>;
}

export interface SessionAnalysis {
  sessionDate: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  grossPnl: number;
  netPnl: number;
  winRate: number;
  patterns: PatternInstance[];
  behaviorCost: number;
  trades: ParsedTrade[];
}

export interface CostOfBehavior {
  totalBehaviorCost: number;
  actualPnl: number;
  simulatedPnl: number;
  byPattern: {
    patternType: PatternType;
    instances: number;
    totalImpact: number;
  }[];
}

export interface EdgeScorecard {
  byHour: Record<string, ScoreEntry>;
  byDow: Record<string, ScoreEntry>;
  byHoldTime: Record<string, ScoreEntry>;
  byTicker: Record<string, ScoreEntry>;
  strengths: string[];
  leaks: string[];
  doMore: string[];
  doLess: string[];
}

export interface ScoreEntry {
  trades: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  profitFactor: number;
}

// Broker format auto-learning types

export interface ColumnMapping {
  symbol: string;
  dateTime: string;
  side: string | null;
  quantity: string;
  price: string;
  commission: string | null;
  proceeds: string | null;
  currency: string | null;
  accountId: string | null;
  assetCategory: string | null;
}
