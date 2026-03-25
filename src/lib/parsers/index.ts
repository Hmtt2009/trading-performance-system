import { parseIBKRExecutions } from './ibkr-parser';
import { parseSchwabCSV } from './schwab';
import { parseTDAmeritradeCSV } from './tdameritrade';
import { parseWebullCSV } from './webull';
import { classifyParseError } from './error-classifier';
import type { ParseResult } from '@/types';

type BrokerType = 'ibkr' | 'schwab' | 'tdameritrade' | 'webull' | 'unknown';

/**
 * Auto-detect broker from CSV content by inspecting header rows.
 */
export function detectBroker(csvContent: string): BrokerType {
  const allLines = csvContent.split(/\r?\n/);
  // Scan first 50 lines for non-IBKR brokers and Flex Query format
  const head = allLines.slice(0, 50).join('\n');
  const headUpper = head.toUpperCase();

  // Schwab: header contains "Fees & Comm"
  if (head.includes('Fees & Comm') || head.includes('Fees &amp; Comm')) {
    return 'schwab';
  }

  // TD Ameritrade: header contains "TRANSACTION ID"
  if (headUpper.includes('TRANSACTION ID')) {
    return 'tdameritrade';
  }

  // Webull: header contains "Trade Time" and "Filled Qty"
  if (head.includes('Trade Time') && head.includes('Filled Qty')) {
    return 'webull';
  }

  // IBKR Activity Statement: scan ALL lines for "Trades" section header,
  // since Activity Statements have many sections before Trades (often 200+ lines)
  for (const line of allLines) {
    if (
      (line.startsWith('"Trades"') || line.startsWith('Trades,')) &&
      line.toLowerCase().includes('header')
    ) {
      return 'ibkr';
    }
  }

  // IBKR Flex Query: check first 50 lines for trade-related headers
  if (
    (headUpper.includes('ASSETCATEGORY') || headUpper.includes('ASSET CATEGORY')) &&
    headUpper.includes('SYMBOL') &&
    (headUpper.includes('QUANTITY') || headUpper.includes('QTY'))
  ) {
    return 'ibkr';
  }

  return 'unknown';
}

/**
 * Parse a broker CSV file, auto-detecting the broker format.
 * Supports: IBKR, Schwab, TD Ameritrade, Webull.
 */
export function parseTradeCSV(
  csvContent: string,
  existingHashes: Set<string> = new Set()
): ParseResult {
  const broker = detectBroker(csvContent);

  if (broker === 'unknown') {
    const classification = classifyParseError(csvContent);
    return {
      executions: [],
      trades: [],
      errors: [{ row: 0, message: `${classification.message} ${classification.suggestion}` }],
      duplicateHashes: [],
      metadata: {
        brokerFormat: 'unknown',
        totalRows: csvContent.split(/\r?\n/).filter((l) => l.trim()).length,
        parsedRows: 0,
        skippedRows: 0,
        errorRows: 1,
        optionsSkipped: 0,
      },
    };
  }

  let result: ParseResult;
  switch (broker) {
    case 'ibkr':
      result = parseIBKRExecutions(csvContent, existingHashes);
      break;
    case 'schwab':
      result = parseSchwabCSV(csvContent, existingHashes);
      break;
    case 'tdameritrade':
      result = parseTDAmeritradeCSV(csvContent, existingHashes);
      break;
    case 'webull':
      result = parseWebullCSV(csvContent, existingHashes);
      break;
  }

  // When a broker parser returns 0 trades with errors, enhance with a classified suggestion
  if (result.trades.length === 0 && result.errors.length > 0) {
    const classification = classifyParseError(csvContent);
    if (result.errors[0]) {
      result.errors[0].message = `${result.errors[0].message} ${classification.suggestion}`;
    }
  }

  return result;
}

export { parseIBKRExecutions } from './ibkr-parser';
export { parseSchwabCSV } from './schwab';
export { parseTDAmeritradeCSV } from './tdameritrade';
export { parseWebullCSV } from './webull';
