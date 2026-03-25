/**
 * Error classifier for trade CSV parsing failures.
 *
 * When the main parser cannot identify a broker format or returns zero trades,
 * this module inspects the raw CSV content and returns a specific, actionable
 * error message so the user knows exactly what went wrong and how to fix it.
 */

export interface ParseErrorClassification {
  errorType:
    | 'no_trades'
    | 'no_columns'
    | 'wrong_report_type'
    | 'non_us_market'
    | 'empty_file'
    | 'not_csv'
    | 'unknown_format';
  message: string;
  suggestion: string;
  detectedContentType?: string;
}

// ---------------------------------------------------------------------------
// Report-type keyword groups (case-insensitive matching)
// ---------------------------------------------------------------------------

const REPORT_KEYWORDS: { type: string; label: string; keywords: string[] }[] = [
  {
    type: 'positions',
    label: 'positions report',
    keywords: ['open positions', 'position', 'market value', 'unrealized p&l', 'unrealized pnl'],
  },
  {
    type: 'balance',
    label: 'balance statement',
    keywords: ['cash balance', 'balance', 'net asset value', 'account balance'],
  },
  {
    type: 'dividends',
    label: 'dividend report',
    keywords: ['dividend', 'dividends', 'interest income', 'withholding tax'],
  },
];

// Common trade-related column names (case-insensitive)
const TRADE_COLUMN_KEYWORDS = [
  'symbol',
  'ticker',
  'side',
  'buy/sell',
  'quantity',
  'qty',
  'price',
  'commission',
  'order',
  'trade',
  'action',
  'filled',
];

// Non-US market suffixes that appear in symbols
const NON_US_SUFFIXES = ['.L', '.HK', '.T', '.SS', '.SZ', '.TO', '.AX', '.PA', '.DE', '.MC'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function looksLikeCSV(content: string): boolean {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return false;

  // A CSV should have at least some commas
  const commaLines = lines.filter((l) => l.includes(','));
  return commaLines.length / lines.length > 0.3;
}

function looksLikeJSON(content: string): boolean {
  const trimmed = content.trim();
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
}

function looksLikeXML(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.startsWith('<?xml') || trimmed.startsWith('<');
}

function looksLikePDF(content: string): boolean {
  return content.trimStart().startsWith('%PDF');
}

function getNonBlankLines(content: string): string[] {
  return content.split(/\r?\n/).filter((l) => l.trim());
}

function detectReportType(content: string): { type: string; label: string } | null {
  const upper = content.toUpperCase();
  for (const group of REPORT_KEYWORDS) {
    for (const kw of group.keywords) {
      if (upper.includes(kw.toUpperCase())) {
        return { type: group.type, label: group.label };
      }
    }
  }
  return null;
}

function hasTradeColumns(headerLine: string): boolean {
  const upper = headerLine.toUpperCase();
  let matches = 0;
  for (const kw of TRADE_COLUMN_KEYWORDS) {
    if (upper.includes(kw.toUpperCase())) {
      matches++;
    }
  }
  // Require at least 2 trade-related columns to consider it trade-like
  return matches >= 2;
}

function hasNonUSSymbols(content: string): boolean {
  const lines = getNonBlankLines(content);
  if (lines.length < 2) return false;

  // Skip header line, check data lines
  const dataLines = lines.slice(1);
  let nonUSCount = 0;
  let symbolCandidates = 0;

  for (const line of dataLines) {
    const fields = line.split(',');
    for (const field of fields) {
      const trimmed = field.trim().replace(/^"|"$/g, '');
      // Symbol-like: short alphanumeric string that could have a suffix
      if (/^[A-Z0-9]{1,10}\.[A-Z]{1,3}$/i.test(trimmed)) {
        symbolCandidates++;
        for (const suffix of NON_US_SUFFIXES) {
          if (trimmed.toUpperCase().endsWith(suffix)) {
            nonUSCount++;
            break;
          }
        }
      }
    }
  }

  return nonUSCount > 0 && symbolCandidates > 0;
}

// ---------------------------------------------------------------------------
// Main classifier
// ---------------------------------------------------------------------------

export function classifyParseError(csvContent: string): ParseErrorClassification {
  // 1. Empty file
  if (!csvContent || !csvContent.trim()) {
    return {
      errorType: 'empty_file',
      message: 'The uploaded file is empty.',
      suggestion: 'Please check that you downloaded the correct file from your broker.',
    };
  }

  // 2. Detect non-CSV formats first (before CSV heuristic, since JSON/XML can contain commas)
  if (looksLikeJSON(csvContent)) {
    return {
      errorType: 'not_csv',
      message: "This doesn't appear to be a CSV file.",
      suggestion: 'Please export your trades as CSV format. Most brokers offer this under Reports or History.',
      detectedContentType: 'JSON',
    };
  }
  if (looksLikePDF(csvContent)) {
    return {
      errorType: 'not_csv',
      message: "This doesn't appear to be a CSV file.",
      suggestion: 'Please export your trades as CSV format. Most brokers offer this under Reports or History.',
      detectedContentType: 'PDF',
    };
  }
  if (looksLikeXML(csvContent)) {
    return {
      errorType: 'not_csv',
      message: "This doesn't appear to be a CSV file.",
      suggestion: 'Please export your trades as CSV format. Most brokers offer this under Reports or History.',
      detectedContentType: 'XML',
    };
  }

  // 3. Check if it looks like CSV at all (has commas in a reasonable number of lines)
  if (!looksLikeCSV(csvContent)) {
    const lines = getNonBlankLines(csvContent);
    // A single line with no commas and no recognizable structure is ambiguous;
    // classify as unknown_format rather than not_csv
    if (lines.length <= 1) {
      return {
        errorType: 'unknown_format',
        message: "We couldn't identify your broker format.",
        suggestion: 'Currently supported: IBKR, Schwab, TD Ameritrade, Webull. See our export guide for instructions.',
      };
    }
    return {
      errorType: 'not_csv',
      message: "This doesn't appear to be a CSV file.",
      suggestion: 'Please export your trades as CSV format. Most brokers offer this under Reports or History.',
    };
  }

  const lines = getNonBlankLines(csvContent);

  // 4. Wrong report type (positions, balance, dividends)
  const reportType = detectReportType(csvContent);
  if (reportType) {
    return {
      errorType: 'wrong_report_type',
      message: `This appears to be a ${reportType.label}, not a trade history.`,
      suggestion: 'Please export your Trade History or Transaction History instead.',
      detectedContentType: reportType.label,
    };
  }

  // 5. Non-US market symbols
  if (hasNonUSSymbols(csvContent)) {
    return {
      errorType: 'non_us_market',
      message: 'This appears to contain non-US market trades.',
      suggestion: 'Flinch currently supports US stocks only. Please export only your US equity trades.',
    };
  }

  // 6. Has trade-like columns but no data rows → no_trades
  const headerLine = lines[0] || '';
  if (hasTradeColumns(headerLine)) {
    if (lines.length <= 1) {
      return {
        errorType: 'no_trades',
        message: 'No trades found in this file.',
        suggestion: 'Check that you selected the correct date range and that the export includes executed trades.',
      };
    }

    // Has header + data rows but we still couldn't parse → no_trades
    return {
      errorType: 'no_trades',
      message: 'No trades found in this file.',
      suggestion: 'Check that you selected the correct date range and that the export includes executed trades.',
    };
  }

  // 7. Has rows but columns don't match any known pattern → no_columns
  if (lines.length > 1) {
    const rowCount = lines.length - 1; // subtract header
    return {
      errorType: 'no_columns',
      message: `Found ${rowCount} row${rowCount !== 1 ? 's' : ''} but couldn't identify trade columns.`,
      suggestion: 'You can manually map your columns. Currently auto-detected: IBKR, Schwab, TD Ameritrade, Webull.',
    };
  }

  // 8. Fallback
  return {
    errorType: 'unknown_format',
    message: "We couldn't identify your broker format.",
    suggestion: 'Currently supported: IBKR, Schwab, TD Ameritrade, Webull. See our export guide for instructions.',
  };
}
