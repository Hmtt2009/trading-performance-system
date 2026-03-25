'use client';

import { useState, useMemo } from 'react';

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

interface ColumnMapperProps {
  headers: string[];
  previewRows: string[][];
  suggestedMapping?: Partial<ColumnMapping>;
  onConfirm: (mapping: ColumnMapping, formatName?: string) => void;
  onCancel: () => void;
}

const REQUIRED_FIELDS: { key: keyof ColumnMapping; label: string }[] = [
  { key: 'symbol', label: 'Symbol' },
  { key: 'dateTime', label: 'Date / Time' },
  { key: 'side', label: 'Side (Buy/Sell)' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'price', label: 'Price' },
];

const OPTIONAL_FIELDS: { key: keyof ColumnMapping; label: string }[] = [
  { key: 'commission', label: 'Commission' },
  { key: 'proceeds', label: 'Proceeds' },
  { key: 'currency', label: 'Currency' },
  { key: 'accountId', label: 'Account ID' },
  { key: 'assetCategory', label: 'Asset Category' },
];

const emptyMapping: ColumnMapping = {
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

export function ColumnMapper({
  headers,
  previewRows,
  suggestedMapping,
  onConfirm,
  onCancel,
}: ColumnMapperProps) {
  const [mapping, setMapping] = useState<ColumnMapping>(() => ({
    ...emptyMapping,
    ...suggestedMapping,
  }));
  const [showOptional, setShowOptional] = useState(false);
  const [saveFormat, setSaveFormat] = useState(false);
  const [formatName, setFormatName] = useState('');

  const requiredComplete = useMemo(() => {
    // Side is not strictly required (can fall back to signed quantity)
    return (
      mapping.symbol !== null &&
      mapping.dateTime !== null &&
      mapping.quantity !== null &&
      mapping.price !== null
    );
  }, [mapping]);

  const handleSelect = (key: keyof ColumnMapping, value: string) => {
    setMapping((prev) => ({
      ...prev,
      [key]: value === '' ? null : value,
    }));
  };

  const handleConfirm = () => {
    if (!requiredComplete) return;
    onConfirm(mapping, saveFormat && formatName.trim() ? formatName.trim() : undefined);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-display text-2xl tracking-wide text-foreground">
          MAP COLUMNS
        </h2>
        <p className="text-muted text-xs font-mono mt-1">
          We couldn&apos;t auto-detect your broker format. Map your CSV columns below.
        </p>
      </div>

      {/* Preview table */}
      <div className="rounded border border-border bg-panel overflow-hidden">
        <div className="panel-header px-3 py-2">
          <span className="text-xs font-mono text-muted">CSV PREVIEW</span>
        </div>
        <div className="overflow-x-auto max-h-56 overflow-y-auto">
          <table className="w-full text-xs font-mono border-collapse min-w-max">
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th
                    key={i}
                    className="px-3 py-2 text-left text-green border-b border-border bg-green-bg whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className={rowIdx % 2 === 0 ? 'bg-panel' : 'bg-surface'}
                >
                  {headers.map((_, colIdx) => (
                    <td
                      key={colIdx}
                      className="px-3 py-1.5 text-foreground whitespace-nowrap border-b border-border/50"
                    >
                      {row[colIdx] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Required fields */}
      <div className="rounded border border-border bg-panel p-4">
        <h3 className="text-xs font-mono font-bold text-foreground mb-3 tracking-wide">
          REQUIRED FIELDS
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {REQUIRED_FIELDS.map(({ key, label }) => {
            const isMapped = mapping[key] !== null;
            const isRequired = key !== 'side';
            return (
              <div key={key} className="flex items-center gap-2">
                {/* Status indicator */}
                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                  {isMapped ? (
                    <svg
                      className="w-4 h-4 text-green"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : isRequired ? (
                    <svg
                      className="w-4 h-4 text-red"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <circle cx="12" cy="12" r="9" strokeWidth={2} />
                      <path
                        strokeLinecap="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01"
                      />
                    </svg>
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-muted/40" />
                  )}
                </div>

                {/* Label + dropdown */}
                <div className="flex-1">
                  <label className="block text-[10px] text-muted mb-0.5 font-mono">
                    {label}
                    {isRequired && (
                      <span className="text-red ml-1">*</span>
                    )}
                  </label>
                  <select
                    value={mapping[key] ?? ''}
                    onChange={(e) => handleSelect(key, e.target.value)}
                    className="w-full bg-surface border border-border-light rounded px-2 py-1.5 text-xs font-mono text-foreground appearance-none cursor-pointer focus:outline-none focus:border-green transition-colors"
                  >
                    <option value="">Select column...</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Optional fields (collapsible) */}
      <div className="rounded border border-border bg-panel">
        <button
          onClick={() => setShowOptional(!showOptional)}
          className="w-full flex items-center justify-between px-4 py-3 text-xs font-mono text-muted hover:text-foreground transition-colors"
        >
          <span className="font-bold tracking-wide">OPTIONAL FIELDS</span>
          <svg
            className={`w-4 h-4 transition-transform ${showOptional ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        {showOptional && (
          <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border pt-3">
            {OPTIONAL_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-[10px] text-muted mb-0.5 font-mono">
                  {label}
                </label>
                <select
                  value={mapping[key] ?? ''}
                  onChange={(e) => handleSelect(key, e.target.value)}
                  className="w-full bg-surface border border-border-light rounded px-2 py-1.5 text-xs font-mono text-foreground appearance-none cursor-pointer focus:outline-none focus:border-green transition-colors"
                >
                  <option value="">Select column...</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save format option */}
      <div className="rounded border border-border bg-panel p-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={saveFormat}
            onChange={(e) => setSaveFormat(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-border-light bg-surface accent-green"
          />
          <span className="text-xs font-mono text-muted">
            Save this mapping for future uploads
          </span>
        </label>
        {saveFormat && (
          <input
            type="text"
            value={formatName}
            onChange={(e) => setFormatName(e.target.value)}
            placeholder='Broker name (e.g. "Fidelity", "E*Trade")'
            className="mt-2 w-full bg-surface border border-border-light rounded px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted/50 focus:outline-none focus:border-green transition-colors"
          />
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleConfirm}
          disabled={!requiredComplete}
          className={`px-5 py-2 rounded text-xs font-mono font-bold transition-colors ${
            requiredComplete
              ? 'bg-green text-background hover:bg-green/90 cursor-pointer'
              : 'bg-green/20 text-green/40 cursor-not-allowed'
          }`}
        >
          CONFIRM MAPPING
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2 border border-border-light text-foreground rounded text-xs font-mono font-bold hover:bg-panel transition-colors"
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}

export default ColumnMapper;
