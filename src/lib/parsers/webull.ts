import CryptoJS from 'crypto-js';
import type { RawExecution, ParsedTrade, ParseError, ParseResult } from '@/types';

/**
 * Parse Webull CSV trade history export.
 * Expected headers include: Symbol, Trade Time, Side, Filled Qty, Avg Price, Status, Order Type
 * Also handles: Symbol, Trade Time, Side, Filled Qty, Filled Price, Total, Fee
 */
export function parseWebullCSV(
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

  // Find the header row (contains "Trade Time" and "Filled Qty")
  let headerIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (lines[i].includes('Trade Time') && lines[i].includes('Filled Qty')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    return emptyResult('Could not find Webull CSV headers.', lines.length);
  }

  const headers = parseCSVLine(lines[headerIndex]).map((h) => h.trim());
  const findCol = (names: string[]) => {
    for (const name of names) {
      const idx = headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const symbolIdx = findCol(['Symbol', 'Ticker']);
  const timeIdx = findCol(['Trade Time', 'Filled Time', 'Time']);
  const sideIdx = findCol(['Side', 'Action', 'Type']);
  const qtyIdx = findCol(['Filled Qty', 'Filled Quantity', 'Qty', 'Quantity']);
  const priceIdx = findCol(['Avg Price', 'Filled Price', 'Price']);
  const feeIdx = findCol(['Fee', 'Commission', 'Fees']);
  const statusIdx = findCol(['Status']);

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

    // Skip non-filled orders
    if (statusIdx >= 0) {
      const status = (cols[statusIdx] || '').trim().toUpperCase();
      if (status && status !== 'FILLED' && status !== 'PARTIALLY FILLED') {
        skippedRows++;
        continue;
      }
    }

    const symbol = cols[symbolIdx]?.trim();
    if (!symbol) {
      errors.push({ row: rowNum, message: 'Missing symbol' });
      continue;
    }

    // Skip options
    if (symbol.length > 6 && /\d{6}[CP]\d+/.test(symbol)) {
      optionsSkipped++;
      skippedRows++;
      continue;
    }

    const timeStr = timeIdx >= 0 ? cols[timeIdx]?.trim() : '';
    const dateTime = parseWebullDate(timeStr);
    if (!dateTime) {
      errors.push({ row: rowNum, message: `Invalid date: ${timeStr}` });
      continue;
    }

    const qtyStr = cols[qtyIdx]?.replace(/,/g, '').trim() || '0';
    const quantity = Math.abs(parseFloat(qtyStr));
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

    const feeStr = feeIdx >= 0 ? cols[feeIdx]?.replace(/[$,]/g, '').trim() : '0';
    const commission = Math.abs(parseFloat(feeStr || '0') || 0);

    let side: 'buy' | 'sell' = 'buy';
    if (sideIdx >= 0) {
      const sideStr = (cols[sideIdx] || '').trim().toUpperCase();
      if (sideStr === 'SELL' || sideStr === 'S' || sideStr === 'SLD') {
        side = 'sell';
      }
    }

    const rawRow: Record<string, string> = {};
    headers.forEach((h, idx) => { rawRow[h] = cols[idx] || ''; });

    const exec: RawExecution = {
      symbol,
      dateTime,
      side,
      quantity,
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
      brokerFormat: 'webull',
      totalRows: lines.length - headerIndex - 1,
      parsedRows,
      skippedRows,
      errorRows: errors.length,
      optionsSkipped,
    },
  };
}

function parseWebullDate(raw: string): Date | null {
  if (!raw) return null;
  const cleaned = raw.replace(/"/g, '').trim();
  // Webull formats:
  // "01/15/2024 09:30:15 EST"
  // "2024-01-15T09:30:15"
  // "01/15/2024 09:30:15"

  // Strip timezone abbreviation
  const noTz = cleaned.replace(/\s+(EST|EDT|CST|CDT|MST|MDT|PST|PDT)$/i, '');

  // Try MM/DD/YYYY HH:MM:SS
  const match = noTz.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):?(\d{2})?$/);
  if (match) {
    const [, month, day, year, hour, min, sec] = match;
    const d = new Date(
      `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${min}:${(sec || '00')}`
    );
    if (!isNaN(d.getTime())) return d;
  }

  // Try ISO format
  const d = new Date(noTz);
  return isNaN(d.getTime()) ? null : d;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
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
  return CryptoJS.SHA256(data).toString();
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

function matchExecutionsToTrades(executions: RawExecution[]): ParsedTrade[] {
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

  const vwapEntry = entryExecs.reduce((s, e) => s + e.price * e.quantity, 0) / entryQty;
  const vwapExit = exitExecs.reduce((s, e) => s + e.price * e.quantity, 0) / exitQty;
  const totalComm = [...entryExecs, ...exitExecs].reduce((s, e) => s + e.commission, 0);
  const grossPnl = isLong
    ? (vwapExit - vwapEntry) * matchedQty
    : (vwapEntry - vwapExit) * matchedQty;
  const netPnl = grossPnl - totalComm;
  const entryTime = entryExecs[0].dateTime;
  const exitTime = exitExecs[exitExecs.length - 1].dateTime;
  const holdTimeMinutes = Math.round((exitTime.getTime() - entryTime.getTime()) / 60000);
  const pnlPercent = (grossPnl / (vwapEntry * matchedQty)) * 100;

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
    executionHash: generateTradeHash([...entryExecs, ...exitExecs]),
    executions: [...entryExecs, ...exitExecs],
  });

  return trades;
}

function emptyResult(message: string, totalRows: number): ParseResult {
  return {
    executions: [],
    trades: [],
    errors: [{ row: 0, message }],
    duplicateHashes: [],
    metadata: {
      brokerFormat: 'webull',
      totalRows,
      parsedRows: 0,
      skippedRows: 0,
      errorRows: 1,
      optionsSkipped: 0,
    },
  };
}
