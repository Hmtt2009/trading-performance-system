/**
 * Universal Column Detector for CSV trade data.
 *
 * Detects column mappings from ANY US broker CSV by using a comprehensive
 * alias map, multi-strategy matching (exact, normalized, substring), data
 * sniffing, and confidence scoring.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

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

export interface DetectionResult {
  mapping: ColumnMapping;
  confidence: number; // 0-100
  headerRow: number; // which row contains the headers (0-based)
  dataStartRow: number; // which row data starts (0-based)
  unmappedHeaders: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Field definitions – required vs optional
// ---------------------------------------------------------------------------

type RequiredField = 'symbol' | 'dateTime' | 'quantity' | 'price';
type OptionalField = 'side' | 'commission' | 'proceeds' | 'currency' | 'accountId' | 'assetCategory';
type MappingField = RequiredField | OptionalField;

const REQUIRED_FIELDS: RequiredField[] = ['symbol', 'dateTime', 'quantity', 'price'];
const OPTIONAL_FIELDS: OptionalField[] = ['side', 'commission', 'proceeds', 'currency', 'accountId', 'assetCategory'];

// ---------------------------------------------------------------------------
// Comprehensive alias map
// ---------------------------------------------------------------------------

const COLUMN_ALIASES: Record<MappingField, string[]> = {
  symbol: [
    'Symbol', 'Ticker', 'Stock', 'Instrument', 'Security',
    'Underlying Symbol', 'Underlying', 'Stock Symbol', 'Sym',
  ],
  dateTime: [
    'Date', 'DateTime', 'Date/Time', 'Trade Date', 'Execution Time',
    'Time', 'TradeDate', 'Exec Date', 'Transaction Date',
    'Settlement Date', 'Activity Date', 'Trade Time',
  ],
  side: [
    'Action', 'Side', 'Buy/Sell', 'Type', 'Transaction Type',
    'B/S', 'Trade Type', 'Order Side', 'Direction', 'Description',
  ],
  quantity: [
    'Quantity', 'Qty', 'Shares', 'Amount', 'Size',
    'Filled Qty', 'Filled Quantity', 'Volume', 'Trade Quantity', 'Exec Qty',
  ],
  price: [
    'Price', 'Exec Price', 'T. Price', 'Fill Price', 'Avg Price',
    'Filled Price', 'Trade Price', 'Execution Price', 'Unit Price',
  ],
  commission: [
    'Commission', 'Comm', 'Comm/Fee', 'Fee', 'Fees',
    'Fees & Comm', 'IBCommission', 'Trading Fee', 'Brokerage Fee', 'Transaction Fee',
  ],
  proceeds: [
    'Proceeds', 'Net Amount', 'Total', 'Amount', 'Net Cash',
    'NetCash', 'Cost', 'Market Value',
  ],
  currency: ['Currency', 'CurrencyPrimary', 'Curr', 'CCY'],
  accountId: ['Account', 'AccountId', 'Account Number', 'Account ID', 'ClientAccountID'],
  assetCategory: [
    'AssetCategory', 'Asset Category', 'Asset Class',
    'SecurityType', 'Security Type', 'Product', 'Instrument Type',
  ],
};

// ---------------------------------------------------------------------------
// Match types & helpers
// ---------------------------------------------------------------------------

type MatchKind = 'exact' | 'normalized' | 'substring';

interface CandidateMatch {
  field: MappingField;
  header: string;
  alias: string;
  kind: MatchKind;
  /** Lower is better within a kind – used for tie-breaking */
  aliasIndex: number;
}

/** Normalize a string by lowercasing and removing spaces, hyphens, and underscores. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s_\-/&]/g, '');
}

/** Parse a single CSV line handling quoted fields. */
export function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

// ---------------------------------------------------------------------------
// Header row detection
// ---------------------------------------------------------------------------

/**
 * Score a row on how likely it is to be a header row.
 * We count how many alias hits we get and prefer rows with more text fields
 * and fewer numeric-only fields.
 */
function scoreAsHeaderRow(fields: string[]): number {
  let aliasHits = 0;
  let textFields = 0;

  for (const f of fields) {
    const trimmed = f.trim();
    if (trimmed === '') continue;

    // If this field is purely numeric (with optional $ or .), it's likely data
    if (/^[\$\-]?\d[\d.,]*$/.test(trimmed)) continue;

    textFields++;

    const normField = normalize(trimmed);
    const lowerField = trimmed.toLowerCase();

    for (const aliases of Object.values(COLUMN_ALIASES)) {
      for (const alias of aliases) {
        if (lowerField === alias.toLowerCase()) {
          aliasHits += 3;
          break;
        }
        if (normField === normalize(alias)) {
          aliasHits += 2;
          break;
        }
      }
    }
  }

  // A header row should have mostly text fields and at least some alias hits
  return aliasHits + (textFields >= 3 ? textFields : 0);
}

function findHeaderRow(lines: string[]): { index: number; headers: string[] } {
  let bestIndex = 0;
  let bestScore = -1;
  let bestHeaders: string[] = [];

  // Search within the first 20 lines
  const limit = Math.min(lines.length, 20);
  for (let i = 0; i < limit; i++) {
    const fields = parseCSVLine(lines[i]).map((f) => f.trim());
    if (fields.length < 3) continue; // too few columns to be a header

    const score = scoreAsHeaderRow(fields);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
      bestHeaders = fields;
    }
  }

  return { index: bestIndex, headers: bestHeaders };
}

// ---------------------------------------------------------------------------
// Matching engine
// ---------------------------------------------------------------------------

function findAllCandidates(headers: string[]): CandidateMatch[] {
  const candidates: CandidateMatch[] = [];

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [MappingField, string[]][]) {
    for (const header of headers) {
      const trimmedHeader = header.trim();
      if (trimmedHeader === '') continue;

      const lowerHeader = trimmedHeader.toLowerCase();
      const normHeader = normalize(trimmedHeader);

      for (let ai = 0; ai < aliases.length; ai++) {
        const alias = aliases[ai];
        const lowerAlias = alias.toLowerCase();
        const normAlias = normalize(alias);

        // Exact match (case-insensitive)
        if (lowerHeader === lowerAlias) {
          candidates.push({ field, header: trimmedHeader, alias, kind: 'exact', aliasIndex: ai });
          continue;
        }

        // Normalized match
        if (normHeader === normAlias) {
          candidates.push({ field, header: trimmedHeader, alias, kind: 'normalized', aliasIndex: ai });
          continue;
        }

        // Substring match – header contains alias OR alias contains header
        // Only for aliases/headers with 3+ characters to avoid false positives
        if (lowerAlias.length >= 3 && lowerHeader.length >= 3) {
          if (lowerHeader.includes(lowerAlias) || lowerAlias.includes(lowerHeader)) {
            candidates.push({ field, header: trimmedHeader, alias, kind: 'substring', aliasIndex: ai });
          }
        }
      }
    }
  }

  return candidates;
}

/** Priority: exact > normalized > substring, then lower aliasIndex wins. */
function matchPriority(c: CandidateMatch): number {
  const kindRank = c.kind === 'exact' ? 0 : c.kind === 'normalized' ? 1 : 2;
  return kindRank * 1000 + c.aliasIndex;
}

// ---------------------------------------------------------------------------
// Data sniffing validators
// ---------------------------------------------------------------------------

function looksLikeSymbol(values: string[]): boolean {
  let matches = 0;
  for (const v of values) {
    const trimmed = v.trim().replace(/"/g, '');
    if (trimmed === '') continue;
    // Stock symbols: 1-6 uppercase letters, possibly with a dot or slash (e.g., BRK.B)
    if (/^[A-Z]{1,6}([./][A-Z]{0,2})?$/i.test(trimmed)) {
      matches++;
    }
  }
  return matches >= Math.ceil(values.filter((v) => v.trim() !== '').length * 0.5);
}

function looksLikeQuantity(values: string[]): boolean {
  let matches = 0;
  for (const v of values) {
    const trimmed = v.trim().replace(/[",]/g, '');
    if (trimmed === '') continue;
    // Quantities: integers or simple decimals, possibly negative
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const num = parseFloat(trimmed);
      // Quantities are typically whole numbers or small decimals, and generally < 100,000
      if (Math.abs(num) >= 1 && Math.abs(num) < 1_000_000 && (Number.isInteger(num) || Math.abs(num) < 10000)) {
        matches++;
      }
    }
  }
  return matches >= Math.ceil(values.filter((v) => v.trim() !== '').length * 0.5);
}

function looksLikePrice(values: string[]): boolean {
  let matches = 0;
  for (const v of values) {
    const trimmed = v.trim().replace(/[\$",]/g, '');
    if (trimmed === '') continue;
    // Prices: decimals, possibly with $ prefix
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const num = parseFloat(trimmed);
      // Prices are typically > 0 and < 100,000 per share
      if (num > 0 && num < 100_000) {
        matches++;
      }
    }
  }
  return matches >= Math.ceil(values.filter((v) => v.trim() !== '').length * 0.5);
}

function looksLikeDate(values: string[]): boolean {
  let matches = 0;
  for (const v of values) {
    const trimmed = v.trim().replace(/"/g, '');
    if (trimmed === '') continue;
    // Try native Date parsing
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      matches++;
      continue;
    }
    // Common date patterns: MM/DD/YYYY, YYYY-MM-DD, YYYYMMDD, etc.
    if (/\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(trimmed)) {
      matches++;
      continue;
    }
    if (/^\d{8}/.test(trimmed)) {
      matches++;
    }
  }
  return matches >= Math.ceil(values.filter((v) => v.trim() !== '').length * 0.5);
}

// ---------------------------------------------------------------------------
// Disambiguation with data sniffing
// ---------------------------------------------------------------------------

interface SniffContext {
  headers: string[];
  dataRows: string[][];
}

/** Get column values from data rows for a given header. */
function getColumnValues(ctx: SniffContext, header: string): string[] {
  const colIdx = ctx.headers.indexOf(header);
  if (colIdx === -1) return [];
  return ctx.dataRows.map((row) => (colIdx < row.length ? row[colIdx] : ''));
}

/**
 * When a header is claimed by multiple fields, use data sniffing to decide.
 * Returns the field that best fits the actual data, or the first field by match priority.
 */
function disambiguateByData(
  header: string,
  fields: MappingField[],
  ctx: SniffContext
): MappingField {
  const values = getColumnValues(ctx, header);

  // Check which field the data looks like
  for (const field of fields) {
    switch (field) {
      case 'symbol':
        if (looksLikeSymbol(values)) return 'symbol';
        break;
      case 'quantity':
        if (looksLikeQuantity(values)) return 'quantity';
        break;
      case 'price':
        if (looksLikePrice(values)) return 'price';
        break;
      case 'dateTime':
        if (looksLikeDate(values)) return 'dateTime';
        break;
    }
  }

  return fields[0];
}

// ---------------------------------------------------------------------------
// Core detection logic
// ---------------------------------------------------------------------------

export function detectColumns(csvContent: string): DetectionResult {
  const warnings: string[] = [];

  // Split into lines
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) {
    return emptyResult('CSV content is empty', warnings);
  }

  // Find header row
  const { index: headerRow, headers } = findHeaderRow(lines);
  const dataStartRow = headerRow + 1;

  if (headers.length < 3) {
    return emptyResult('Could not identify a valid header row', warnings);
  }

  // Gather up to 5 data rows for sniffing
  const dataRows: string[][] = [];
  for (let i = dataStartRow; i < Math.min(lines.length, dataStartRow + 5); i++) {
    dataRows.push(parseCSVLine(lines[i]).map((f) => f.trim()));
  }
  const sniffCtx: SniffContext = { headers, dataRows };

  // Find all candidate matches
  const candidates = findAllCandidates(headers);

  // Build a mapping: for each field, pick the best candidate
  // Also track: for each header, which fields want it
  const fieldToCandidates = new Map<MappingField, CandidateMatch[]>();
  const headerToFields = new Map<string, { field: MappingField; match: CandidateMatch }[]>();

  for (const c of candidates) {
    const list = fieldToCandidates.get(c.field) || [];
    list.push(c);
    fieldToCandidates.set(c.field, list);

    const hList = headerToFields.get(c.header) || [];
    hList.push({ field: c.field, match: c });
    headerToFields.set(c.header, hList);
  }

  // Sort candidates per field by priority (best first)
  for (const [, list] of fieldToCandidates) {
    list.sort((a, b) => matchPriority(a) - matchPriority(b));
  }

  // Resolve mapping: greedy assignment – process fields in priority order
  // Required fields first, then optional
  const fieldOrder: MappingField[] = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];
  const assignedHeaders = new Set<string>();
  const mapping: Record<MappingField, string | null> = {
    symbol: null,
    dateTime: null,
    side: null,
    quantity: null,
    price: null,
    commission: null,
    proceeds: null,
    currency: null,
    accountId: null,
    assetCategory: null,
  };
  const matchKinds: Record<string, MatchKind> = {};

  // First pass: assign fields with only one candidate or clear best match
  for (const field of fieldOrder) {
    const cands = fieldToCandidates.get(field);
    if (!cands || cands.length === 0) continue;

    // Filter out already-assigned headers
    const available = cands.filter((c) => !assignedHeaders.has(c.header));
    if (available.length === 0) continue;

    // Check if the best candidate's header is contested by another field
    const best = available[0];
    const contestors = headerToFields.get(best.header);

    if (contestors && contestors.length > 1) {
      // Multiple fields want this header – check if this field has the best match
      const competingFields = contestors.map((c) => c.field);
      const winner = disambiguateByData(best.header, competingFields, sniffCtx);

      if (winner === field) {
        mapping[field] = best.header;
        matchKinds[field] = best.kind;
        assignedHeaders.add(best.header);
      }
      // If we didn't win, we'll try the next candidate in pass 2
    } else {
      mapping[field] = best.header;
      matchKinds[field] = best.kind;
      assignedHeaders.add(best.header);
    }
  }

  // Second pass: try to fill any remaining unassigned fields
  for (const field of fieldOrder) {
    if (mapping[field] !== null) continue;

    const cands = fieldToCandidates.get(field);
    if (!cands) continue;

    const available = cands.filter((c) => !assignedHeaders.has(c.header));
    if (available.length === 0) continue;

    // Just take the best available
    const best = available[0];
    mapping[field] = best.header;
    matchKinds[field] = best.kind;
    assignedHeaders.add(best.header);
  }

  // Data-sniff validation for required fields: confirm the mapping makes sense
  for (const field of REQUIRED_FIELDS) {
    if (mapping[field] === null) continue;

    const values = getColumnValues(sniffCtx, mapping[field]!);
    let valid = true;

    switch (field) {
      case 'symbol':
        valid = looksLikeSymbol(values);
        break;
      case 'dateTime':
        valid = looksLikeDate(values);
        break;
      case 'quantity':
        valid = looksLikeQuantity(values);
        break;
      case 'price':
        valid = looksLikePrice(values);
        break;
    }

    if (!valid) {
      warnings.push(
        `Column "${mapping[field]}" mapped to ${field} but data does not look like ${field} values`
      );
    }
  }

  // Compute confidence
  const confidence = computeConfidence(mapping, matchKinds, warnings);

  // Find unmapped headers
  const unmappedHeaders = headers.filter(
    (h) => h.trim() !== '' && !assignedHeaders.has(h)
  );

  return {
    mapping: mapping as ColumnMapping,
    confidence,
    headerRow,
    dataStartRow,
    unmappedHeaders,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Confidence scoring
// ---------------------------------------------------------------------------

function computeConfidence(
  mapping: Record<MappingField, string | null>,
  matchKinds: Record<string, MatchKind>,
  warnings: string[]
): number {
  // Check if all required fields are present
  const missingRequired = REQUIRED_FIELDS.filter((f) => mapping[f] === null);
  if (missingRequired.length > 0) {
    return 0;
  }

  let score = 0;

  // Score required fields based on match kind
  for (const field of REQUIRED_FIELDS) {
    const kind = matchKinds[field];
    switch (kind) {
      case 'exact':
        score += 25;
        break;
      case 'normalized':
        score += 20;
        break;
      case 'substring':
        score += 15;
        break;
    }
  }

  // Score optional fields (up to 20 points)
  let optionalPoints = 0;
  for (const field of OPTIONAL_FIELDS) {
    if (mapping[field] !== null) {
      optionalPoints += 5;
    }
  }
  score += Math.min(optionalPoints, 20);

  // Commission bonus
  if (mapping.commission !== null) {
    score += 10;
  }

  // All 4 required found → minimum confidence of 60
  score = Math.max(score, 60);

  // Cap at 100
  score = Math.min(score, 100);

  // Reduce for warnings about data sniff failures
  const dataWarnings = warnings.filter((w) => w.includes('does not look like'));
  score -= dataWarnings.length * 5;

  // Floor at 0 if somehow negative, but keep above 60 if all required found
  score = Math.max(score, missingRequired.length === 0 ? 60 : 0);

  return score;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyResult(reason: string, warnings: string[]): DetectionResult {
  return {
    mapping: {
      symbol: null,
      dateTime: null,
      side: null,
      quantity: null,
      price: null,
      commission: null,
      proceeds: null,
      currency: null,
      accountId: null,
      assetCategory: null,
    },
    confidence: 0,
    headerRow: 0,
    dataStartRow: 0,
    unmappedHeaders: [],
    warnings: [reason, ...warnings],
  };
}
