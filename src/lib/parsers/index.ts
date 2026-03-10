import { parseIBKRExecutions } from './ibkr-parser';
import type { ParseResult } from '@/types';

export type BrokerType = 'ibkr' | 'unknown';

/**
 * Detect broker format from CSV content.
 */
export function detectBroker(csvContent: string): BrokerType {
  const upper = csvContent.toUpperCase();

  // IBKR indicators
  if (
    upper.includes('INTERACTIVE BROKERS') ||
    upper.includes('IBKR') ||
    upper.includes('ASSETCATEGORY') ||
    upper.includes('CLIENTACCOUNTID') ||
    upper.includes('IBCOMMISSION') ||
    // Flex Query typical columns
    (upper.includes('SYMBOL') && upper.includes('QUANTITY') && upper.includes('T. PRICE'))
  ) {
    return 'ibkr';
  }

  return 'unknown';
}

/**
 * Parse trade CSV from any supported broker.
 * MVP: IBKR only.
 */
export function parseTradeCSV(
  csvContent: string,
  existingHashes: Set<string> = new Set()
): ParseResult {
  const broker = detectBroker(csvContent);

  switch (broker) {
    case 'ibkr':
      return parseIBKRExecutions(csvContent, existingHashes);
    default:
      return {
        executions: [],
        trades: [],
        errors: [{
          row: 0,
          message: 'Unrecognized broker format. Currently we support Interactive Brokers (IBKR) Flex Query exports only.',
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
