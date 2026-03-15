import { parse } from 'csv-parse/sync';
import CryptoJS from 'crypto-js';
import type { RawExecution, ParsedTrade, ParseError, ParseResult } from '@/types';

// IBKR Flex Query column name mappings (handles variations)
const COLUMN_MAP: Record<string, string[]> = {
  symbol: ['Symbol', 'symbol', 'Underlying Symbol'],
  dateTime: ['DateTime', 'Date/Time', 'TradeDate', 'Date'],
  tradeTime: ['TradeTime', 'Time'],
  quantity: ['Quantity', 'quantity', 'Qty'],
  price: ['Price', 'T. Price', 'Trade Price', 'price'],
  proceeds: ['Proceeds', 'proceeds'],
  commission: ['Commission', 'Comm/Fee', 'IBCommission', 'commission'],
  side: ['Buy/Sell', 'Side', 'side'],
  assetCategory: ['AssetCategory', 'Asset Category', 'Asset Class', 'SecurityType'],
  currency: ['Currency', 'CurrencyPrimary', 'currency'],
  accountId: ['AccountId', 'Account', 'ClientAccountID'],
  netCash: ['NetCash', 'Net Cash'],
};

function findColumn(headers: string[], fieldAliases: string[]): string | null {
  for (const alias of fieldAliases) {
    const found = headers.find(
      (h) => h.trim().toLowerCase() === alias.toLowerCase()
    );
    if (found) return found;
  }
  return null;
}

function resolveColumns(headers: string[]): Record<string, string | null> {
  const resolved: Record<string, string | null> = {};
  for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
    resolved[field] = findColumn(headers, aliases);
  }
  return resolved;
}

function parseDateTime(row: Record<string, string>, cols: Record<string, string | null>): Date | null {
  // Try combined DateTime column first
  const dtCol = cols.dateTime;
  if (dtCol && row[dtCol]) {
    const raw = row[dtCol].trim();
    // IBKR formats: "2024-03-15, 10:30:00" or "20240315;103000" or "2024-03-15 10:30:00"
    const cleaned = raw.replace(/[,;]/g, ' ').replace(/\s+/g, ' ').trim();
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) return date;

    // Try YYYYMMDD HHMMSS format
    const match = raw.match(/(\d{4})(\d{2})(\d{2})\D*(\d{2})(\d{2})(\d{2})/);
    if (match) {
      return new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`);
    }
  }

  // Try separate date + time columns
  const dateCol = cols.dateTime;
  const timeCol = cols.tradeTime;
  if (dateCol && timeCol && row[dateCol] && row[timeCol]) {
    const dateStr = row[dateCol].trim();
    const timeStr = row[timeCol].trim();
    const combined = `${dateStr} ${timeStr}`.replace(/[,;]/g, ' ');
    const date = new Date(combined);
    if (!isNaN(date.getTime())) return date;
  }

  return null;
}

function parseSide(value: string): 'buy' | 'sell' | null {
  const v = value.trim().toUpperCase();
  if (v === 'BUY' || v === 'BOT' || v === 'B') return 'buy';
  if (v === 'SELL' || v === 'SLD' || v === 'S') return 'sell';
  return null;
}

function generateExecutionHash(exec: RawExecution): string {
  const data = `${exec.symbol}|${exec.dateTime.toISOString()}|${exec.side}|${exec.quantity}|${exec.price}`;
  return CryptoJS.SHA256(data).toString();
}

/**
 * Detect if the CSV content is a valid IBKR Flex Query export.
 * IBKR files may have header/metadata rows before the actual trade data.
 */
function findTradeDataStart(lines: string[]): { startIndex: number; format: string } | null {
  // Pass 1: Look for Activity Statement format ("Trades,Header,..." row).
  // Must be checked first — other sections (e.g. Mark-to-Market) also contain
  // "symbol", "quantity", "price" keywords and would false-match the Flex Query check.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      (line.startsWith('"Trades"') || line.startsWith('Trades,')) &&
      line.toLowerCase().includes('header')
    ) {
      return { startIndex: i, format: 'ibkr-activity-statement' };
    }
  }

  // Pass 2: Fall back to Flex Query direct export (simple CSV with trade headers)
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (
      (lower.includes('symbol') || lower.includes('underlying')) &&
      (lower.includes('quantity') || lower.includes('qty')) &&
      (lower.includes('price') || lower.includes('t. price'))
    ) {
      return { startIndex: i, format: 'ibkr-flex-query' };
    }
  }

  return null;
}

/**
 * CSV-escape a cell value: quote it if it contains commas, quotes, or newlines.
 */
function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * For Activity Statement format, strip section prefix columns ("Trades","Data",...)
 * and rebuild clean CSV from header + data rows only.
 */
function preprocessActivityStatement(lines: string[], startIndex: number): string {
  const result: string[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Stop at next section
    if (i > startIndex && !line.startsWith('"Trades"') && !line.startsWith('Trades,')) {
      break;
    }

    // Parse the line to extract the row type
    let cells: string[];
    try {
      cells = parse(line, { relax_column_count: true })[0] as string[];
    } catch {
      continue;
    }

    if (!cells || cells.length < 3) continue;

    const rowType = cells[1]?.trim().toLowerCase();

    if (rowType === 'header' || rowType === 'data') {
      // Skip section name (0), row type (1), and DataDiscriminator column/value (2)
      // Re-escape values that contain commas (e.g. Date/Time: "2026-01-02, 14:06:43")
      result.push(cells.slice(3).map(csvEscape).join(','));
    }
    // Skip SubTotal, Total, Notes rows
  }

  return result.join('\n');
}

/**
 * Parse IBKR CSV executions from raw CSV content.
 */
export function parseIBKRExecutions(
  csvContent: string,
  existingHashes: Set<string> = new Set()
): ParseResult {
  const errors: ParseError[] = [];
  const executions: RawExecution[] = [];
  const duplicateHashes: string[] = [];
  let optionsSkipped = 0;

  // Split into lines to find the trade data section
  const allLines = csvContent.split(/\r?\n/);
  const tradeSection = findTradeDataStart(allLines);

  if (!tradeSection) {
    return {
      executions: [],
      trades: [],
      errors: [{ row: 0, message: 'Unrecognized file format. This doesn\'t look like an IBKR export. Please use Flex Query → Trades or an Activity Statement.' }],
      duplicateHashes: [],
      metadata: {
        brokerFormat: 'unknown',
        totalRows: allLines.length,
        parsedRows: 0,
        skippedRows: 0,
        errorRows: 1,
        optionsSkipped: 0,
      },
    };
  }

  // Build the CSV content for the trades section
  let tradeLines: string;
  if (tradeSection.format === 'ibkr-activity-statement') {
    // Activity Statement: strip section prefix columns
    tradeLines = preprocessActivityStatement(allLines, tradeSection.startIndex);
  } else {
    // Flex Query: find end of trades section
    let endIndex = allLines.length;
    for (let i = tradeSection.startIndex + 1; i < allLines.length; i++) {
      const line = allLines[i].trim();
      if (line === '') {
        endIndex = i;
        break;
      }
    }
    tradeLines = allLines.slice(tradeSection.startIndex, endIndex).join('\n');
  }

  // Parse CSV
  let records: Record<string, string>[];
  try {
    records = parse(tradeLines, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    });
  } catch (e) {
    return {
      executions: [],
      trades: [],
      errors: [{ row: 0, message: `CSV parsing failed: ${e instanceof Error ? e.message : 'Unknown error'}` }],
      duplicateHashes: [],
      metadata: {
        brokerFormat: tradeSection.format,
        totalRows: allLines.length,
        parsedRows: 0,
        skippedRows: 0,
        errorRows: 1,
        optionsSkipped: 0,
      },
    };
  }

  if (records.length === 0) {
    return {
      executions: [],
      trades: [],
      errors: [{ row: 0, message: 'No trade data found in file.' }],
      duplicateHashes: [],
      metadata: {
        brokerFormat: tradeSection.format,
        totalRows: allLines.length,
        parsedRows: 0,
        skippedRows: 0,
        errorRows: 0,
        optionsSkipped: 0,
      },
    };
  }

  // Resolve column names
  const headers = Object.keys(records[0]);
  const cols = resolveColumns(headers);

  // Validate required columns
  const requiredFields = ['symbol', 'quantity', 'price'];
  const missing = requiredFields.filter((f) => !cols[f]);
  if (missing.length > 0) {
    return {
      executions: [],
      trades: [],
      errors: [{
        row: 0,
        message: `Missing required columns: ${missing.join(', ')}. Found columns: ${headers.join(', ')}`
      }],
      duplicateHashes: [],
      metadata: {
        brokerFormat: tradeSection.format,
        totalRows: records.length,
        parsedRows: 0,
        skippedRows: 0,
        errorRows: 1,
        optionsSkipped: 0,
      },
    };
  }

  let parsedRows = 0;
  let skippedRows = 0;

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = tradeSection.startIndex + i + 2; // 1-based + header

    // Skip sub-total / total rows (IBKR Activity Statement)
    const firstValue = Object.values(row)[0] || '';
    if (
      firstValue.toLowerCase().includes('total') ||
      firstValue.toLowerCase().includes('subtotal')
    ) {
      skippedRows++;
      continue;
    }

    // Filter: stocks only (MVP)
    const assetCol = cols.assetCategory;
    if (assetCol && row[assetCol]) {
      const asset = row[assetCol].trim().toUpperCase();
      if (asset === 'OPT' || asset === 'FOP' || asset === 'FUT' || asset === 'OPTION' || asset === 'OPTIONS') {
        optionsSkipped++;
        skippedRows++;
        continue;
      }
      // Allow STK, STOCK, or empty (assume stock)
    }

    // Filter: USD only (MVP)
    const currCol = cols.currency;
    if (currCol && row[currCol] && row[currCol].trim().toUpperCase() !== 'USD') {
      skippedRows++;
      continue;
    }

    // Parse fields
    const symbol = cols.symbol ? row[cols.symbol]?.trim() : null;
    if (!symbol) {
      errors.push({ row: rowNum, message: 'Missing symbol', rawData: JSON.stringify(row) });
      continue;
    }

    const dateTime = parseDateTime(row, cols);
    if (!dateTime) {
      errors.push({ row: rowNum, message: 'Could not parse date/time', rawData: JSON.stringify(row) });
      continue;
    }

    const quantity = Math.abs(parseFloat(row[cols.quantity!] || ''));
    if (isNaN(quantity) || quantity <= 0) {
      errors.push({ row: rowNum, message: 'Invalid quantity', rawData: JSON.stringify(row) });
      continue;
    }

    const price = parseFloat(row[cols.price!] || '');
    if (isNaN(price)) {
      errors.push({ row: rowNum, message: 'Invalid price', rawData: JSON.stringify(row) });
      continue;
    }

    // Side: try explicit column, then infer from quantity sign
    let side: 'buy' | 'sell' | null = null;
    if (cols.side && row[cols.side]) {
      side = parseSide(row[cols.side]);
    }
    if (!side) {
      // IBKR sometimes uses signed quantity: positive = buy, negative = sell
      const rawQty = parseFloat(row[cols.quantity!] || '0');
      side = rawQty >= 0 ? 'buy' : 'sell';
    }

    const commission = Math.abs(parseFloat(
      (cols.commission && row[cols.commission]) || '0'
    ));

    const exec: RawExecution = {
      symbol,
      dateTime,
      side,
      quantity,
      price,
      commission,
      assetCategory: (assetCol && row[assetCol]) || 'STK',
      currency: (currCol && row[currCol]) || 'USD',
      accountId: (cols.accountId && row[cols.accountId]) || '',
      rawRow: row,
    };

    // Check for duplicates
    const hash = generateExecutionHash(exec);
    if (existingHashes.has(hash)) {
      duplicateHashes.push(hash);
      skippedRows++;
      continue;
    }

    executions.push(exec);
    parsedRows++;
  }

  // Group executions into trades
  const trades = groupExecutionsIntoTrades(executions);

  return {
    executions,
    trades,
    errors,
    duplicateHashes,
    metadata: {
      brokerFormat: tradeSection.format,
      totalRows: records.length,
      parsedRows,
      skippedRows,
      errorRows: errors.length,
      optionsSkipped,
    },
  };
}

/**
 * Group raw executions into logical trades.
 * Same symbol, same day → match buys to sells chronologically.
 * Handles partial fills and scaling in/out.
 */
function groupExecutionsIntoTrades(executions: RawExecution[]): ParsedTrade[] {
  // Group by symbol + date
  const groups = new Map<string, RawExecution[]>();

  for (const exec of executions) {
    const dateStr = exec.dateTime.toISOString().split('T')[0];
    const key = `${exec.symbol}|${dateStr}`;
    const group = groups.get(key) || [];
    group.push(exec);
    groups.set(key, group);
  }

  const trades: ParsedTrade[] = [];

  for (const [, groupExecs] of groups) {
    // Sort by time
    const sorted = [...groupExecs].sort(
      (a, b) => a.dateTime.getTime() - b.dateTime.getTime()
    );

    const tradeList = matchExecutionsToTrades(sorted);
    trades.push(...tradeList);
  }

  // Sort all trades by entry time
  trades.sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());

  return trades;
}

/**
 * Match buy and sell executions into completed trades.
 * Uses FIFO matching within same symbol + same day.
 */
function matchExecutionsToTrades(executions: RawExecution[]): ParsedTrade[] {
  const trades: ParsedTrade[] = [];

  // Separate into buys and sells
  const buys: RawExecution[] = [];
  const sells: RawExecution[] = [];

  for (const exec of executions) {
    if (exec.side === 'buy') {
      buys.push(exec);
    } else {
      sells.push(exec);
    }
  }

  // If all buys or all sells, create an open trade
  if (buys.length === 0 || sells.length === 0) {
    const allExecs = buys.length > 0 ? buys : sells;
    if (allExecs.length === 0) return trades;

    const direction = buys.length > 0 ? 'long' : 'short';
    const totalQty = allExecs.reduce((s, e) => s + e.quantity, 0);
    const vwapEntry = allExecs.reduce((s, e) => s + e.price * e.quantity, 0) / totalQty;
    const totalComm = allExecs.reduce((s, e) => s + e.commission, 0);

    trades.push({
      symbol: allExecs[0].symbol,
      direction,
      entryTime: allExecs[0].dateTime,
      exitTime: null,
      entryPrice: round(vwapEntry, 4),
      exitPrice: null,
      quantity: totalQty,
      totalCommission: round(totalComm, 4),
      grossPnl: null,
      netPnl: null,
      pnlPercent: null,
      holdTimeMinutes: null,
      positionValue: round(vwapEntry * totalQty, 4),
      isOpen: true,
      executionHash: generateTradeHash(allExecs),
      executions: allExecs,
    });
    return trades;
  }

  // Determine direction: if first execution is a buy, it's a long trade
  // If first execution is a sell, it's a short trade
  const firstExec = executions[0];
  const isLong = firstExec.side === 'buy';
  const entryExecs = isLong ? buys : sells;
  const exitExecs = isLong ? sells : buys;

  // Calculate totals
  const entryQty = entryExecs.reduce((s, e) => s + e.quantity, 0);
  const exitQty = exitExecs.reduce((s, e) => s + e.quantity, 0);
  const matchedQty = Math.min(entryQty, exitQty);

  if (matchedQty === 0) return trades;

  // VWAP prices
  const vwapEntry = calculateVWAP(entryExecs, matchedQty);
  const vwapExit = calculateVWAP(exitExecs, matchedQty);

  const totalComm = [...entryExecs, ...exitExecs].reduce((s, e) => s + e.commission, 0);

  const grossPnl = isLong
    ? (vwapExit - vwapEntry) * matchedQty
    : (vwapEntry - vwapExit) * matchedQty;

  const netPnl = grossPnl - totalComm;
  const pnlPercent = (grossPnl / (vwapEntry * matchedQty)) * 100;

  const entryTime = entryExecs[0].dateTime;
  const exitTime = exitExecs[exitExecs.length - 1].dateTime;
  const holdTimeMinutes = Math.round(
    (exitTime.getTime() - entryTime.getTime()) / 60000
  );

  const allExecs = [...entryExecs, ...exitExecs];

  trades.push({
    symbol: firstExec.symbol,
    direction: isLong ? 'long' : 'short',
    entryTime,
    exitTime,
    entryPrice: round(vwapEntry, 4),
    exitPrice: round(vwapExit, 4),
    quantity: matchedQty,
    totalCommission: round(totalComm, 4),
    grossPnl: round(grossPnl, 4),
    netPnl: round(netPnl, 4),
    pnlPercent: round(pnlPercent, 4),
    holdTimeMinutes,
    positionValue: round(vwapEntry * matchedQty, 4),
    isOpen: entryQty !== exitQty,
    executionHash: generateTradeHash(allExecs),
    executions: allExecs,
  });

  // Handle remaining unmatched quantity (open position)
  if (entryQty > exitQty) {
    const remainingQty = entryQty - exitQty;
    // Get the executions that form the unmatched portion
    const remainingExecs = getUnmatchedExecutions(entryExecs, exitQty);
    if (remainingExecs.length > 0) {
      const remainVwap = calculateVWAP(remainingExecs, remainingQty);
      trades.push({
        symbol: firstExec.symbol,
        direction: isLong ? 'long' : 'short',
        entryTime: remainingExecs[0].dateTime,
        exitTime: null,
        entryPrice: round(remainVwap, 4),
        exitPrice: null,
        quantity: remainingQty,
        totalCommission: 0,
        grossPnl: null,
        netPnl: null,
        pnlPercent: null,
        holdTimeMinutes: null,
        positionValue: round(remainVwap * remainingQty, 4),
        isOpen: true,
        executionHash: generateTradeHash(remainingExecs),
        executions: remainingExecs,
      });
    }
  }

  return trades;
}

/**
 * Calculate VWAP for a set of executions up to a maximum quantity.
 */
function calculateVWAP(executions: RawExecution[], maxQty: number): number {
  let totalCost = 0;
  let totalQty = 0;

  for (const exec of executions) {
    const qty = Math.min(exec.quantity, maxQty - totalQty);
    totalCost += exec.price * qty;
    totalQty += qty;
    if (totalQty >= maxQty) break;
  }

  return totalQty > 0 ? totalCost / totalQty : 0;
}

/**
 * Get the unmatched portion of entry executions after FIFO matching.
 */
function getUnmatchedExecutions(
  entryExecs: RawExecution[],
  matchedQty: number
): RawExecution[] {
  let remaining = matchedQty;
  const unmatched: RawExecution[] = [];

  for (const exec of entryExecs) {
    if (remaining >= exec.quantity) {
      remaining -= exec.quantity;
    } else if (remaining > 0) {
      // Partial: create a modified execution with remaining quantity
      unmatched.push({
        ...exec,
        quantity: exec.quantity - remaining,
      });
      remaining = 0;
    } else {
      unmatched.push(exec);
    }
  }

  return unmatched;
}

function generateTradeHash(executions: RawExecution[]): string {
  const data = executions
    .map((e) => `${e.symbol}|${e.dateTime.toISOString()}|${e.side}|${e.quantity}|${e.price}`)
    .sort()
    .join('||');
  return CryptoJS.SHA256(data).toString();
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
