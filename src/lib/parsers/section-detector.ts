/**
 * Multi-Section File Handler
 *
 * Scans CSV files that contain multiple sections (e.g., IBKR Activity Statements)
 * and extracts only the trade data section. Handles:
 *   - Single-section files (most brokers)
 *   - Multi-section files with separator lines or explicit section headers
 *   - IBKR Activity Statement format ("SectionName","Header/Data",...)
 */

export interface FileSection {
  name: string;
  startRow: number;
  endRow: number;
  headerRow: number | null;
  isTradeSection: boolean;
}

export interface SectionAnalysis {
  sections: FileSection[];
  tradeSections: FileSection[];
  csvContent: string;        // The extracted trade section content (headers + data rows)
  headerRowIndex: number;    // Global row index of the trade header
  format: 'single-section' | 'multi-section' | 'ibkr-activity-statement';
}

// ---------------------------------------------------------------------------
// Section name patterns
// ---------------------------------------------------------------------------

/** Section names that indicate trade data */
const TRADE_SECTION_NAMES = [
  'trades',
  'transaction history',
  'order history',
  'trade history',
  'executed orders',
  'executions',
];

/** Section names that should be skipped (not trades) */
const NON_TRADE_SECTION_NAMES = [
  'account information',
  'account summary',
  'cash balance',
  'cash report',
  'balance',
  'dividends',
  'interest',
  'withholding tax',
  'fees',
  'other fees',
  'open positions',
  'positions',
  'mark-to-market',
  'realized p&l summary',
  'realized & unrealized performance summary',
  'financial instrument information',
  'notes',
  'codes',
  'net asset value',
  'change in nav',
  'statement',
  'transfers',
];

/** Keywords that identify a header row (trade columns) */
const HEADER_KEYWORDS = [
  'symbol', 'date', 'quantity', 'price', 'side',
  'action', 'shares', 'ticker', 'qty', 'commission',
  'buy/sell', 'trade price', 't. price',
];

// Minimum number of header keywords required to classify a row as a header
const MIN_HEADER_KEYWORDS = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a CSV line naively into cells, respecting quoted fields.
 * This is intentionally lightweight — we only need it for section detection,
 * not for full CSV parsing (csv-parse handles that downstream).
 */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

/** Check if a string is a separator line (e.g. `---`, `===`, or empty) */
function isSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === '') return true;
  if (/^-{3,}$/.test(trimmed)) return true;
  if (/^={3,}$/.test(trimmed)) return true;
  return false;
}

/** Normalise a section name for comparison (lowercase, trimmed) */
function normaliseName(name: string): string {
  return name.replace(/^["']+|["']+$/g, '').trim().toLowerCase();
}

/** Does this normalised name match any entry in the list? */
function matchesList(name: string, list: string[]): boolean {
  const n = normaliseName(name);
  return list.some((entry) => n === entry || n.startsWith(entry));
}

/**
 * Check whether a row of cells looks like a trade-data header row.
 * Returns `true` if at least MIN_HEADER_KEYWORDS keywords appear.
 */
function isHeaderRow(cells: string[]): boolean {
  const lower = cells.map((c) => c.toLowerCase().replace(/["']/g, ''));
  let hits = 0;
  for (const kw of HEADER_KEYWORDS) {
    if (lower.some((cell) => cell === kw || cell.includes(kw))) {
      hits++;
    }
  }
  return hits >= MIN_HEADER_KEYWORDS;
}

/**
 * Check whether a row consists mostly of non-numeric string values,
 * which is a secondary heuristic for header detection.
 */
function isMostlyNonNumeric(cells: string[]): boolean {
  if (cells.length === 0) return false;
  let nonNumericCount = 0;
  for (const cell of cells) {
    const cleaned = cell.replace(/["']/g, '').trim();
    if (cleaned === '') continue;
    if (isNaN(Number(cleaned))) {
      nonNumericCount++;
    }
  }
  // At least 60% non-numeric
  return nonNumericCount / cells.length >= 0.6;
}

// ---------------------------------------------------------------------------
// IBKR Activity Statement detection
// ---------------------------------------------------------------------------

function isIBKRActivityStatement(lines: string[]): boolean {
  for (const line of lines) {
    if (
      (line.startsWith('"Trades"') || line.startsWith('Trades,')) &&
      line.toLowerCase().includes('header')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Parse an IBKR Activity Statement into sections.
 * IBKR format: `"SectionName","Header",...` then `"SectionName","Data",...`
 */
function parseIBKRSections(lines: string[]): FileSection[] {
  const sections: FileSection[] = [];
  let currentSection: FileSection | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cells = splitCsvLine(line);
    if (cells.length < 2) continue;

    const sectionName = normaliseName(cells[0]);
    const rowType = normaliseName(cells[1]);

    if (rowType === 'header') {
      // Close previous section
      if (currentSection) {
        currentSection.endRow = i - 1;
        sections.push(currentSection);
      }

      const isTrade = matchesList(sectionName, TRADE_SECTION_NAMES);

      currentSection = {
        name: cells[0].replace(/^["']+|["']+$/g, '').trim(),
        startRow: i,
        endRow: i, // will be updated
        headerRow: i,
        isTradeSection: isTrade,
      };
    }
  }

  // Close last section
  if (currentSection) {
    currentSection.endRow = lines.length - 1;
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Extract trade-section CSV content from an IBKR Activity Statement.
 * Strips the section-name and row-type prefix columns ("Trades","Data",...).
 */
function extractIBKRTradeContent(lines: string[], section: FileSection): string {
  const result: string[] = [];
  let payloadStartIndex: number | null = null;
  let hasDataDiscriminator = false;

  for (let i = section.startRow; i <= section.endRow; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cells = splitCsvLine(line);
    if (cells.length < 3) continue;

    const rowType = normaliseName(cells[1]);
    if (rowType !== 'header' && rowType !== 'data') continue;

    if (payloadStartIndex === null) {
      const thirdCell = normaliseName(cells[2]);
      hasDataDiscriminator = thirdCell === 'datadiscriminator';
      payloadStartIndex = hasDataDiscriminator ? 3 : 2;
    }

    // For the purpose of section-detector, we include both header and data rows
    // and skip subtotals / totals (already filtered by rowType check above)
    const payload = cells.slice(payloadStartIndex);
    result.push(payload.map(csvEscape).join(','));
  }

  return result.join('\n');
}

/** CSV-escape a cell value */
function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Generic multi-section detection
// ---------------------------------------------------------------------------

/**
 * Detect sections in a generic multi-section file.
 * Sections are separated by separator lines (`---`, `===`, blank lines used
 * as boundaries) or by recognisable section-header labels.
 */
function parseGenericSections(lines: string[]): FileSection[] {
  const sections: FileSection[] = [];
  let currentSection: FileSection | null = null;
  let pendingSectionName: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Separator line — close the current section
    if (isSeparatorLine(trimmed)) {
      if (currentSection) {
        currentSection.endRow = i - 1;
        if (currentSection.endRow >= currentSection.startRow) {
          sections.push(currentSection);
        }
        currentSection = null;
      }
      continue;
    }

    const cells = splitCsvLine(trimmed);

    // Check if this is a standalone section label (single cell on a line, non-numeric)
    if (cells.length === 1 && cells[0] !== '' && isNaN(Number(cells[0]))) {
      const name = cells[0];
      // Close current section first
      if (currentSection) {
        currentSection.endRow = i - 1;
        if (currentSection.endRow >= currentSection.startRow) {
          sections.push(currentSection);
        }
        currentSection = null;
      }
      pendingSectionName = name;
      continue;
    }

    // Start a new section if we have a pending name or no current section
    if (!currentSection) {
      const sectionName = pendingSectionName || `Section at row ${i}`;
      pendingSectionName = null;

      const isTrade = matchesList(sectionName, TRADE_SECTION_NAMES);
      const isNonTrade = matchesList(sectionName, NON_TRADE_SECTION_NAMES);

      let headerRow: number | null = null;
      if (isHeaderRow(cells) && isMostlyNonNumeric(cells)) {
        headerRow = i;
      }

      currentSection = {
        name: sectionName,
        startRow: i,
        endRow: i,
        headerRow,
        isTradeSection: isTrade && !isNonTrade,
      };
    } else {
      // Extend current section
      currentSection.endRow = i;

      // If we haven't found a header row yet and this looks like one, mark it
      if (currentSection.headerRow === null && isHeaderRow(cells) && isMostlyNonNumeric(cells)) {
        currentSection.headerRow = i;
      }
    }
  }

  // Close last section
  if (currentSection) {
    currentSection.endRow = lines.length - 1;
    // Trim trailing blank lines
    while (currentSection.endRow > currentSection.startRow && lines[currentSection.endRow].trim() === '') {
      currentSection.endRow--;
    }
    if (currentSection.endRow >= currentSection.startRow) {
      sections.push(currentSection);
    }
  }

  return sections;
}

/**
 * For sections that don't have an explicit trade label, check if the section
 * itself contains a header row with trade-related columns.
 */
function inferTradeSections(sections: FileSection[], lines: string[]): void {
  for (const section of sections) {
    if (section.isTradeSection) continue; // already identified

    // Don't re-check sections explicitly identified as non-trade
    if (matchesList(section.name, NON_TRADE_SECTION_NAMES)) continue;

    // Check if the section has a header row with trade keywords
    if (section.headerRow !== null) {
      const cells = splitCsvLine(lines[section.headerRow].trim());
      if (isHeaderRow(cells)) {
        section.isTradeSection = true;
      }
    }
  }
}

/**
 * Extract the CSV content from a generic section (header row + data rows).
 */
function extractGenericSectionContent(lines: string[], section: FileSection): string {
  const start = section.headerRow !== null ? section.headerRow : section.startRow;
  const rows: string[] = [];
  for (let i = start; i <= section.endRow; i++) {
    const trimmed = lines[i].trim();
    if (trimmed !== '') {
      rows.push(lines[i]);
    }
  }
  return rows.join('\n');
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Analyse a CSV file to detect sections and extract trade data.
 *
 * Supports:
 * - Single-section files (just headers + data)
 * - Multi-section files with separator lines or section labels
 * - IBKR Activity Statements ("SectionName","Header/Data",...)
 */
export function analyzeFileSections(csvContent: string): SectionAnalysis {
  const lines = csvContent.split(/\r?\n/);

  // --- IBKR Activity Statement ---
  if (isIBKRActivityStatement(lines)) {
    const sections = parseIBKRSections(lines);
    const tradeSections = sections.filter((s) => s.isTradeSection);

    let extractedContent = '';
    let headerRowIndex = 0;

    if (tradeSections.length > 0) {
      const primary = tradeSections[0];
      extractedContent = extractIBKRTradeContent(lines, primary);
      headerRowIndex = primary.headerRow ?? primary.startRow;
    }

    return {
      sections,
      tradeSections,
      csvContent: extractedContent,
      headerRowIndex,
      format: 'ibkr-activity-statement',
    };
  }

  // --- Generic multi-section or single-section ---
  const sections = parseGenericSections(lines);

  // Infer trade sections from header keywords if not explicitly labelled
  inferTradeSections(sections, lines);

  const tradeSections = sections.filter((s) => s.isTradeSection);

  // Determine format
  const hasSeparators = lines.some((l) => /^-{3,}$/.test(l.trim()) || /^={3,}$/.test(l.trim()));
  const isMultiSection = sections.length > 1 || hasSeparators;

  // If no sections were explicitly identified as trade sections,
  // treat the entire file as a single trade section (most common case)
  if (tradeSections.length === 0) {
    // Single section: use the first section that has a header row, or the first section overall
    const candidate = sections.find((s) => s.headerRow !== null) || sections[0];

    if (candidate) {
      candidate.isTradeSection = true;
      tradeSections.push(candidate);
    }

    const extractedContent = candidate
      ? extractGenericSectionContent(lines, candidate)
      : '';
    const headerRowIndex = candidate?.headerRow ?? 0;

    return {
      sections,
      tradeSections,
      csvContent: extractedContent,
      headerRowIndex,
      format: isMultiSection ? 'multi-section' : 'single-section',
    };
  }

  // Extract content from the first (primary) trade section
  const primary = tradeSections[0];
  const extractedContent = extractGenericSectionContent(lines, primary);
  const headerRowIndex = primary.headerRow ?? primary.startRow;

  return {
    sections,
    tradeSections,
    csvContent: extractedContent,
    headerRowIndex,
    format: isMultiSection ? 'multi-section' : 'single-section',
  };
}
