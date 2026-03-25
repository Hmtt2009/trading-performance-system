import { createHash } from 'crypto';
import type { RawExecution, ParsedTrade, ParseError, ParseResult } from '@/types';

/**
 * Column mapping provided by the user via the manual mapping UI.
 */
export interface ColumnMapping {
  symbol: string | null;
  dateTime: string | null;
  side: string | null;
  quantity: string | null;
  price: string | null;
  commission: string | null;
  proceeds: string | null;
  currency: string | null;
  accountId: string | null;
  assetCategory: string | null;
}

/**
 * Parse a CSV using an explicit column mapping (manual mapping mode).
 * Falls back to heuristics for side detection and date parsing.
 */
export function parseWithMapping(
  csvContent: string,
  mapping: ColumnMapping,
  headerRowIndex: number,
  existingHashes: Set<string>
): ParseResult {
  const errors: ParseError[] = [];
  const executions: RawExecution[] = [];
  const duplicateHashes: string[] = [];
  let skippedRows = 0;

  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < headerRowIndex + 2) {
    return emptyResult('File has no data rows after the header.', lines.length);
  }

  const headers = parseCSVLine(lines[headerRowIndex]).map((h) => h.trim());

  // Build column index lookup from the mapping
  const colIndex = (mappedName: string | null): number => {
    if (!mappedName) return -1;
    return headers.indexOf(mappedName);
  };

  const symbolIdx = colIndex(mapping.symbol);
  const dateTimeIdx = colIndex(mapping.dateTime);
  const sideIdx = colIndex(mapping.side);
  const qtyIdx = colIndex(mapping.quantity);
  const priceIdx = colIndex(mapping.price);
  const commIdx = colIndex(mapping.commission);
  const currencyIdx = colIndex(mapping.currency);
  const accountIdx = colIndex(mapping.accountId);
  const assetCatIdx = colIndex(mapping.assetCategory);

  // Validate required columns
  if (symbolIdx === -1) {
    return emptyResult('Symbol column not found in CSV headers.', lines.length);
  }
  if (dateTimeIdx === -1) {
    return emptyResult('Date/Time column not found in CSV headers.', lines.length);
  }
  if (qtyIdx === -1) {
    return emptyResult('Quantity column not found in CSV headers.', lines.length);
  }
  if (priceIdx === -1) {
    return emptyResult('Price column not found in CSV headers.', lines.length);
  }

  let parsedRows = 0;

  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    const rowNum = i + 1;

    // --- Symbol ---
    const symbol = cols[symbolIdx]?.trim();
    if (!symbol) {
      skippedRows++;
      continue;
    }

    // --- Date/Time ---
    const dateStr = cols[dateTimeIdx]?.trim();
    const dateTime = parseFlexibleDate(dateStr);
    if (!dateTime) {
      errors.push({ row: rowNum, message: `Invalid date: ${dateStr}` });
      continue;
    }

    // --- Quantity ---
    const rawQty = cols[qtyIdx]?.replace(/,/g, '').trim() || '0';
    const quantity = parseFloat(rawQty);
    if (!quantity || isNaN(quantity)) {
      errors.push({ row: rowNum, message: `Invalid quantity: ${rawQty}` });
      continue;
    }

    // --- Price ---
    const rawPrice = cols[priceIdx]?.replace(/[$,]/g, '').trim() || '0';
    const price = parseFloat(rawPrice);
    if (!price || isNaN(price) || price <= 0) {
      errors.push({ row: rowNum, message: `Invalid price: ${rawPrice}` });
      continue;
    }

    // --- Side ---
    let side: 'buy' | 'sell';
    if (sideIdx >= 0) {
      const sideStr = cols[sideIdx]?.trim().toUpperCase() || '';
      const detectedSide = parseSide(sideStr);
      if (detectedSide) {
        side = detectedSide;
      } else {
        // Fallback: try signed quantity
        side = quantity > 0 ? 'buy' : 'sell';
      }
    } else {
      // No side column mapped; use signed quantity
      side = quantity > 0 ? 'buy' : 'sell';
    }

    // --- Commission ---
    let commission = 0;
    if (commIdx >= 0) {
      const rawComm = cols[commIdx]?.replace(/[$,]/g, '').trim() || '0';
      commission = Math.abs(parseFloat(rawComm) || 0);
    }

    // --- Optional fields ---
    const currency = currencyIdx >= 0 ? (cols[currencyIdx]?.trim() || 'USD') : 'USD';
    const accountId = accountIdx >= 0 ? (cols[accountIdx]?.trim() || '') : '';
    const assetCategory = assetCatIdx >= 0 ? (cols[assetCatIdx]?.trim() || 'STK') : 'STK';

    const rawRow: Record<string, string> = {};
    headers.forEach((h, idx) => { rawRow[h] = cols[idx] || ''; });

    const exec: RawExecution = {
      symbol,
      dateTime,
      side,
      quantity: Math.abs(quantity),
      price,
      commission,
      assetCategory,
      currency,
      accountId,
      rawRow,
    };

    const hash = generateHash(exec);
    if (existingHashes.has(hash)) {
      duplicateHashes.push(hash);
      skippedRows++;
      continue;
    }

    executions.push(exec);
    parsedRows++;
  }

  const trades = groupIntoTrades(executions);

  return {
    executions,
    trades,
    errors,
    duplicateHashes,
    metadata: {
      brokerFormat: 'manual',
      totalRows: lines.length - headerRowIndex - 1,
      parsedRows,
      skippedRows,
      errorRows: errors.length,
      optionsSkipped: 0,
    },
  };
}

// ── Date parsing ──

function parseFlexibleDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const cleaned = raw.replace(/"/g, '').trim();
  if (!cleaned) return null;

  // Try ISO format first
  const isoMatch = cleaned.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (isoMatch) {
    const [, y, m, d, h, min, s] = isoMatch;
    const dateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${(h || '12').padStart(2, '0')}:${(min || '00').padStart(2, '0')}:${(s || '00').padStart(2, '0')}`;
    const dt = new Date(dateStr);
    if (!isNaN(dt.getTime())) return dt;
  }

  // YYYY/MM/DD
  const ymdSlash = cleaned.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(.+))?$/);
  if (ymdSlash) {
    const [, y, m, d, time] = ymdSlash;
    const timePart = time ? convertTo24h(time) : '12:00:00';
    const dateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${timePart}`;
    const dt = new Date(dateStr);
    if (!isNaN(dt.getTime())) return dt;
  }

  // MM/DD/YYYY
  const mdySlash = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(.+))?$/);
  if (mdySlash) {
    const [, m, d, y, time] = mdySlash;
    const timePart = time ? convertTo24h(time) : '12:00:00';
    const dateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${timePart}`;
    const dt = new Date(dateStr);
    if (!isNaN(dt.getTime())) return dt;
  }

  // MM-DD-YYYY
  const mdyDash = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(.+))?$/);
  if (mdyDash) {
    const [, m, d, y, time] = mdyDash;
    const timePart = time ? convertTo24h(time) : '12:00:00';
    const dateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${timePart}`;
    const dt = new Date(dateStr);
    if (!isNaN(dt.getTime())) return dt;
  }

  // Last resort: native Date constructor
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
}

function convertTo24h(time: string): string {
  const match = time.match(/^(\d{1,2}):(\d{2}):?(\d{2})?\s*(AM|PM)?$/i);
  if (!match) return '12:00:00';
  const [, h, m, s, ampm] = match;
  let hour = parseInt(h);
  if (ampm) {
    if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
  }
  return `${hour.toString().padStart(2, '0')}:${m}:${s || '00'}`;
}

// ── Side parsing ──

const BUY_KEYWORDS = new Set(['BUY', 'BOUGHT', 'BOT', 'B', 'LONG']);
const SELL_KEYWORDS = new Set(['SELL', 'SOLD', 'SLD', 'S', 'SHORT', 'SHRT']);

function parseSide(raw: string): 'buy' | 'sell' | null {
  const upper = raw.toUpperCase().trim();
  if (BUY_KEYWORDS.has(upper)) return 'buy';
  if (SELL_KEYWORDS.has(upper)) return 'sell';
  // Check if the string starts with a known keyword
  for (const kw of BUY_KEYWORDS) {
    if (upper.startsWith(kw)) return 'buy';
  }
  for (const kw of SELL_KEYWORDS) {
    if (upper.startsWith(kw)) return 'sell';
  }
  return null;
}

// ── CSV parsing ──

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// ── Hashing ──

function generateHash(exec: RawExecution): string {
  const data = `${exec.symbol}|${exec.dateTime.toISOString()}|${exec.side}|${exec.quantity}|${exec.price}`;
  return createHash('sha256').update(data).digest('hex');
}

function generateTradeHash(executions: RawExecution[]): string {
  const data = executions
    .map((e) => `${e.symbol}|${e.dateTime.toISOString()}|${e.side}|${e.quantity}|${e.price}`)
    .sort()
    .join('||');
  return createHash('sha256').update(data).digest('hex');
}

// ── Trade grouping (same logic as other parsers) ──

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function groupIntoTrades(executions: RawExecution[]): ParsedTrade[] {
  const groups = new Map<string, RawExecution[]>();
  for (const exec of executions) {
    const key = exec.symbol;
    const group = groups.get(key) || [];
    group.push(exec);
    groups.set(key, group);
  }

  const trades: ParsedTrade[] = [];
  for (const [, groupExecs] of groups) {
    const sorted = [...groupExecs].sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
    trades.push(...matchExecutionsToTrades(sorted));
  }
  trades.sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());
  return trades;
}

function splitIntoRoundTrips(executions: RawExecution[]): RawExecution[][] {
  const roundTrips: RawExecution[][] = [];
  let current: RawExecution[] = [];
  let position = 0;

  for (const exec of executions) {
    const signedQty = exec.side === 'buy' ? exec.quantity : -exec.quantity;
    current.push(exec);
    position += signedQty;

    if (Math.abs(position) < 0.0001 && current.length >= 2) {
      roundTrips.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    roundTrips.push(current);
  }

  return roundTrips;
}

function matchExecutionsToTrades(executions: RawExecution[]): ParsedTrade[] {
  const roundTrips = splitIntoRoundTrips(executions);
  const trades: ParsedTrade[] = [];
  for (const rtExecs of roundTrips) {
    trades.push(...matchRoundTrip(rtExecs));
  }
  return trades;
}

function matchRoundTrip(executions: RawExecution[]): ParsedTrade[] {
  const trades: ParsedTrade[] = [];
  const buys = executions.filter((e) => e.side === 'buy');
  const sells = executions.filter((e) => e.side === 'sell');

  if (buys.length === 0 || sells.length === 0) {
    const allExecs = buys.length > 0 ? buys : sells;
    if (allExecs.length === 0) return trades;
    const direction = buys.length > 0 ? 'long' : 'short';
    const totalQty = allExecs.reduce((s, e) => s + e.quantity, 0);
    const vwap = allExecs.reduce((s, e) => s + e.price * e.quantity, 0) / totalQty;
    const totalComm = allExecs.reduce((s, e) => s + e.commission, 0);
    trades.push({
      symbol: allExecs[0].symbol,
      direction: direction as 'long' | 'short',
      entryTime: allExecs[0].dateTime,
      exitTime: null,
      entryPrice: round(vwap, 4),
      exitPrice: null,
      quantity: totalQty,
      totalCommission: round(totalComm, 4),
      grossPnl: null,
      netPnl: null,
      pnlPercent: null,
      holdTimeMinutes: null,
      positionValue: round(vwap * totalQty, 4),
      isOpen: true,
      executionHash: generateTradeHash(allExecs),
      executions: allExecs,
    });
    return trades;
  }

  const isLong = executions[0].side === 'buy';
  const entryExecs = isLong ? buys : sells;
  const exitExecs = isLong ? sells : buys;

  const entryQty = entryExecs.reduce((s, e) => s + e.quantity, 0);
  const exitQty = exitExecs.reduce((s, e) => s + e.quantity, 0);
  const matchedQty = Math.min(entryQty, exitQty);

  if (matchedQty === 0) return trades;

  const vwapEntry = calculateVWAP(entryExecs, matchedQty);
  const vwapExit = calculateVWAP(exitExecs, matchedQty);
  const entryCommRate = matchedQty / entryQty;
  const exitCommRate = exitQty > 0 ? matchedQty / exitQty : 1;
  const entryComm = entryExecs.reduce((s, e) => s + e.commission, 0) * entryCommRate;
  const exitComm = exitExecs.reduce((s, e) => s + e.commission, 0) * exitCommRate;
  const totalComm = entryComm + exitComm;
  const grossPnl = isLong
    ? (vwapExit - vwapEntry) * matchedQty
    : (vwapEntry - vwapExit) * matchedQty;
  const netPnl = grossPnl - totalComm;
  const entryTime = entryExecs[0].dateTime;
  const exitTime = exitExecs[exitExecs.length - 1].dateTime;
  const holdTimeMinutes = Math.round((exitTime.getTime() - entryTime.getTime()) / 60000);
  const pnlPercent = (grossPnl / (vwapEntry * matchedQty)) * 100;

  const allExecs = [...entryExecs, ...exitExecs];

  trades.push({
    symbol: executions[0].symbol,
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

  // Handle remaining unmatched quantity
  if (entryQty > exitQty) {
    const remainingQty = entryQty - exitQty;
    const remainingExecs = getUnmatchedExecutions(entryExecs, exitQty);
    if (remainingExecs.length > 0) {
      const remainVwap = calculateVWAP(remainingExecs, remainingQty);
      trades.push({
        symbol: executions[0].symbol,
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

function emptyResult(message: string, totalRows: number): ParseResult {
  return {
    executions: [],
    trades: [],
    errors: [{ row: 0, message }],
    duplicateHashes: [],
    metadata: {
      brokerFormat: 'manual',
      totalRows,
      parsedRows: 0,
      skippedRows: 0,
      errorRows: 1,
      optionsSkipped: 0,
    },
  };
}

/**
 * Extract headers and preview rows from raw CSV content.
 * Used by the upload API to send data to the ColumnMapper UI.
 */
export function extractCSVPreview(
  csvContent: string,
  headerRowIndex = 0
): { headers: string[]; previewRows: string[][] } {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < headerRowIndex + 1) {
    return { headers: [], previewRows: [] };
  }

  const headers = parseCSVLine(lines[headerRowIndex]).map((h) => h.trim());
  const previewRows: string[][] = [];
  for (let i = headerRowIndex + 1; i < Math.min(lines.length, headerRowIndex + 6); i++) {
    previewRows.push(parseCSVLine(lines[i]));
  }

  return { headers, previewRows };
}
