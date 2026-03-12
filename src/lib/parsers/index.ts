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
  // Check the first 10 lines for broker-specific signatures
  const lines = csvContent.split(/\r?\n/).slice(0, 15);
  const header = lines.join('\n');

  // IBKR: rows contain "Trades,Data,Order" or Activity Statement / Flex Query patterns
  if (
    header.includes('Trades,Data,Order') ||
    header.includes('"Trades","Data"') ||
    header.includes('"Trades","Header"')
  ) {
    return 'ibkr';
  }

  // Also check for IBKR Flex Query format (has Symbol + Quantity + Price headers)
  const headerUpper = header.toUpperCase();
  if (
    (headerUpper.includes('ASSETCATEGORY') || headerUpper.includes('ASSET CATEGORY')) &&
    headerUpper.includes('SYMBOL') &&
    (headerUpper.includes('QUANTITY') || headerUpper.includes('QTY'))
  ) {
    return 'ibkr';
  }

  // Schwab: header contains "Fees & Comm"
  if (header.includes('Fees & Comm') || header.includes('Fees &amp; Comm')) {
    return 'schwab';
  }

  // TD Ameritrade: header contains "TRANSACTION ID"
  if (headerUpper.includes('TRANSACTION ID')) {
    return 'tdameritrade';
  }

  // Webull: header contains "Trade Time" and "Filled Qty"
  if (header.includes('Trade Time') && header.includes('Filled Qty')) {
    return 'webull';
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
