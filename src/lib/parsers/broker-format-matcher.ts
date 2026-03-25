import type { ColumnMapping } from '@/types';
import type { BrokerFormat } from '@/types/database';

export interface BrokerFormatMatch {
  formatId: string;
  formatName: string;
  mapping: ColumnMapping;
  headerRowIndex: number;
  confidence: number;
  timesUsed: number;
}

/**
 * Generate a SHA-256 fingerprint from CSV headers.
 * Headers are lowercased, trimmed, sorted, and joined before hashing.
 */
export async function generateFormatFingerprint(headers: string[]): Promise<string> {
  const normalized = headers
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length > 0)
    .sort()
    .join('|');

  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extract a ColumnMapping from a BrokerFormat database row.
 */
function brokerFormatToMapping(format: BrokerFormat): ColumnMapping {
  return {
    symbol: format.column_symbol,
    dateTime: format.column_datetime,
    side: format.column_side,
    quantity: format.column_quantity,
    price: format.column_price,
    commission: format.column_commission,
    proceeds: format.column_proceeds,
    currency: format.column_currency,
    accountId: format.column_account,
    assetCategory: format.column_asset_category,
  };
}

/**
 * Compute Jaccard similarity between two sets of headers.
 * Returns a value between 0 and 1.
 */
function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a.map((h) => h.trim().toLowerCase()));
  const setB = new Set(b.map((h) => h.trim().toLowerCase()));

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}

/**
 * Try to match a CSV's headers against stored broker formats.
 *
 * Matching strategy:
 * 1. Exact fingerprint match (fastest, highest confidence)
 * 2. Fuzzy match via Jaccard similarity > 0.8 on header names
 * 3. Returns null if no match found
 */
export async function matchStoredFormat(
  headers: string[],
  storedFormats: BrokerFormat[]
): Promise<BrokerFormatMatch | null> {
  if (storedFormats.length === 0 || headers.length === 0) {
    return null;
  }

  // 1. Try exact fingerprint match
  const fingerprint = await generateFormatFingerprint(headers);

  for (const format of storedFormats) {
    if (format.format_fingerprint === fingerprint) {
      return {
        formatId: format.id,
        formatName: format.format_name,
        mapping: brokerFormatToMapping(format),
        headerRowIndex: format.header_row_index,
        confidence: format.confidence_score,
        timesUsed: format.times_used,
      };
    }
  }

  // 2. Try fuzzy matching via Jaccard similarity
  let bestMatch: BrokerFormat | null = null;
  let bestSimilarity = 0;

  for (const format of storedFormats) {
    const similarity = jaccardSimilarity(headers, format.sample_headers);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = format;
    }
  }

  if (bestMatch && bestSimilarity > 0.8) {
    // Scale confidence by similarity (fuzzy matches are less confident)
    const scaledConfidence = Math.round(bestMatch.confidence_score * bestSimilarity);
    return {
      formatId: bestMatch.id,
      formatName: bestMatch.format_name,
      mapping: brokerFormatToMapping(bestMatch),
      headerRowIndex: bestMatch.header_row_index,
      confidence: scaledConfidence,
      timesUsed: bestMatch.times_used,
    };
  }

  // 3. No match found
  return null;
}
