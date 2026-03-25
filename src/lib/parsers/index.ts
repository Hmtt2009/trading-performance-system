import { parseIBKRExecutions } from './ibkr-parser';
import { parseSchwabCSV } from './schwab';
import { parseTDAmeritradeCSV } from './tdameritrade';
import { parseWebullCSV } from './webull';
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

  switch (broker) {
    case 'ibkr':
      return parseIBKRExecutions(csvContent, existingHashes);
    case 'schwab':
      return parseSchwabCSV(csvContent, existingHashes);
    case 'tdameritrade':
      return parseTDAmeritradeCSV(csvContent, existingHashes);
    case 'webull':
      return parseWebullCSV(csvContent, existingHashes);
    default:
      return {
        executions: [],
        trades: [],
        errors: [{
          row: 0,
          message: 'Unrecognized broker format. Supports IBKR, Schwab, TD Ameritrade, Webull.',
        }],
        duplicateHashes: [],
        metadata: {
          brokerFormat: 'unknown',
          totalRows: 0,
          parsedRows: 0,
          skippedRows: 0,
          errorRows: 1,
          optionsSkipped: 0,
        },
      };
  }
}

export { parseIBKRExecutions } from './ibkr-parser';
export { parseSchwabCSV } from './schwab';
export { parseTDAmeritradeCSV } from './tdameritrade';
export { parseWebullCSV } from './webull';
export { parseWithMapping, extractCSVPreview } from './manual-parser';
export type { ColumnMapping } from './manual-parser';
