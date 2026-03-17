import { createHash } from 'crypto';
import type { RawExecution, ParsedTrade, ParseError, ParseResult } from '@/types';

/**
 * Parse Schwab CSV transaction history export.
 * Expected headers include: Date, Action, Symbol, Description, Quantity, Price, Fees & Comm, Amount
 */
export function parseSchwabCSV(
  csvContent: string,
  existingHashes: Set<string> = new Set()
): ParseResult {
  const errors: ParseError[] = [];
  const executions: RawExecution[] = [];
  const duplicateHashes: string[] = [];
  let optionsSkipped = 0;
  let skippedRows = 0;

  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return emptyResult('File has no data rows.', lines.length);
  }

  // Find the header row (contains "Fees & Comm")
  let headerIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (lines[i].includes('Fees & Comm') || lines[i].includes('Fees &amp; Comm')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    return emptyResult('Could not find Schwab CSV headers.', lines.length);
  }

  const headers = parseCSVLine(lines[headerIndex]).map((h) => h.trim());
  const col = (name: string) => headers.indexOf(name);

  const dateIdx = col('Date');
  const actionIdx = col('Action');
  const symbolIdx = col('Symbol');
  const qtyIdx = col('Quantity');
  const priceIdx = col('Price');
  const feesIdx = headers.findIndex((h) => h.includes('Fees'));
  const amountIdx = col('Amount');

  if (symbolIdx === -1 || qtyIdx === -1 || priceIdx === -1) {
    return emptyResult(
      `Missing required columns. Found: ${headers.join(', ')}`,
      lines.length
    );
  }

  let parsedRows = 0;

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    const rowNum = i + 1;

    const action = actionIdx >= 0 ? cols[actionIdx]?.trim() : '';

    // Only process Buy/Sell actions
    if (!action) continue;
    const upperAction = action.toUpperCase();
    if (!upperAction.startsWith('BUY') && !upperAction.startsWith('SELL') &&
        !upperAction.includes('BOUGHT') && !upperAction.includes('SOLD')) {
      skippedRows++;
      continue;
    }

    const symbol = cols[symbolIdx]?.trim();
    if (!symbol) {
      errors.push({ row: rowNum, message: 'Missing symbol' });
      continue;
    }

    // Skip options (symbols with spaces or containing expiration dates)
    if (symbol.includes(' ') && /\d{2}\/\d{2}\/\d{4}/.test(symbol)) {
      optionsSkipped++;
      skippedRows++;
      continue;
    }

    const dateStr = dateIdx >= 0 ? cols[dateIdx]?.trim() : '';
    const dateTime = parseSchwabDate(dateStr);
    if (!dateTime) {
      errors.push({ row: rowNum, message: `Invalid date: ${dateStr}` });
      continue;
    }

    const quantity = parseFloat(cols[qtyIdx]?.replace(/,/g, '') || '0');
    if (!quantity || isNaN(quantity)) {
      errors.push({ row: rowNum, message: 'Invalid quantity' });
      continue;
    }

    const priceStr = cols[priceIdx]?.replace(/[$,]/g, '').trim() || '0';
    const price = parseFloat(priceStr);
    if (!price || isNaN(price)) {
      errors.push({ row: rowNum, message: 'Invalid price' });
      continue;
    }

    const feesStr = feesIdx >= 0 ? cols[feesIdx]?.replace(/[$,]/g, '').trim() : '0';
    const commission = Math.abs(parseFloat(feesStr || '0') || 0);

    const side: 'buy' | 'sell' = upperAction.startsWith('BUY') || upperAction.includes('BOUGHT')
      ? 'buy'
      : 'sell';

    const rawRow: Record<string, string> = {};
    headers.forEach((h, idx) => { rawRow[h] = cols[idx] || ''; });

    const exec: RawExecution = {
      symbol,
      dateTime,
      side,
      quantity: Math.abs(quantity),
      price,
      commission,
      assetCategory: 'STK',
      currency: 'USD',
      accountId: '',
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
      brokerFormat: 'schwab',
      totalRows: lines.length - headerIndex - 1,
      parsedRows,
      skippedRows,
      errorRows: errors.length,
      optionsSkipped,
    },
  };
}

function parseSchwabDate(raw: string): Date | null {
  if (!raw) return null;
  // Schwab format: "01/15/2024" or "01/15/2024 09:30:15 AM"
  const cleaned = raw.replace(/"/g, '').trim();
  // MM/DD/YYYY or MM/DD/YYYY HH:MM:SS
  const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(.+))?$/);
  if (match) {
    const [, month, day, year, time] = match;
    const dateStr = time
      ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${convertTo24h(time)}`
      : `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00`;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
}

function convertTo24h(time: string): string {
  const match = time.match(/^(\d{1,2}):(\d{2}):?(\d{2})?\s*(AM|PM)?$/i);
  if (!match) return '12:00:00';
  let [, h, m, s, ampm] = match;
  let hour = parseInt(h);
  if (ampm) {
    if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
  }
  return `${hour.toString().padStart(2, '0')}:${m}:${s || '00'}`;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // RFC 4180: escaped quote ("") inside a quoted field -> literal "
        current += '"';
        i++; // skip the second quote
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

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function groupIntoTrades(executions: RawExecution[]): ParsedTrade[] {
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

    if (position === 0 && current.length >= 2) {
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

  // VWAP: only average the first N shares (FIFO) where N = matchedQty
  const vwapEntry = calculateVWAP(entryExecs, matchedQty);
  const vwapExit = calculateVWAP(exitExecs, matchedQty);
  // Pro-rate commission based on matched quantity
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
  } else if (exitQty > entryQty) {
    console.warn(
      `[schwab-parser] Warning: exitQty (${exitQty}) > entryQty (${entryQty}) for ${executions[0].symbol}. ` +
      `${exitQty - entryQty} excess exit shares cannot be matched.`
    );
  }

  return trades;
}

/**
 * Calculate VWAP for a set of executions up to a maximum quantity (FIFO).
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

function emptyResult(message: string, totalRows: number): ParseResult {
  return {
    executions: [],
    trades: [],
    errors: [{ row: 0, message }],
    duplicateHashes: [],
    metadata: {
      brokerFormat: 'schwab',
      totalRows,
      parsedRows: 0,
      skippedRows: 0,
      errorRows: 1,
      optionsSkipped: 0,
    },
  };
}
