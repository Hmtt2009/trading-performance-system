'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ColumnMapper } from './ColumnMapper';
import type { ColumnMapping } from './ColumnMapper';

interface UploadResult {
  uploadId: string;
  tradesImported: number;
  duplicatesSkipped: number;
  failedInserts: number;
  errors: { row: number; message: string }[];
  metadata: {
    brokerFormat: string;
    totalRows: number;
    parsedRows: number;
    skippedRows: number;
    errorRows: number;
    optionsSkipped: number;

    hasEstimatedTimes?: boolean;

    skippedOptionsData?: { symbol: string }[];

  };
  optionsSkipped?: number;
  warning?: string;
  optionsMessage?: string;
}

interface ColumnMapperState {
  headers: string[];
  previewRows: string[][];
}

type BrokerKey = 'ibkr' | 'schwab' | 'td' | 'webull' | 'other';

interface BrokerInfo {
  key: BrokerKey;
  name: string;
  instructions: string[];
}

const BROKERS: BrokerInfo[] = [
  {
    key: 'ibkr',
    name: 'IBKR',
    instructions: [
      'Go to Reports \u2192 Activity Statement',
      'Select CSV format',
      'Download the file',
    ],
  },
  {
    key: 'schwab',
    name: 'Schwab',
    instructions: [
      'Go to History',
      'Click Export',
      'Choose CSV format',
    ],
  },
  {
    key: 'td',
    name: 'TD Ameritrade',
    instructions: [
      'Go to My Account \u2192 History',
      'Click Export',
      'Save as CSV',
    ],
  },
  {
    key: 'webull',
    name: 'Webull',
    instructions: [
      'Go to Account \u2192 Statements',
      'Select Trade History',
      'Export as CSV',
    ],
  },
  {
    key: 'other',
    name: 'Other',
    instructions: [
      'Export your trade history as CSV',
      "We'll auto-detect the format",
      'Or map columns manually if needed',
    ],
  },
];

interface ProcessingStage {
  label: string;
  done: boolean;
  active: boolean;
}

/**
 * Parse raw CSV text into headers + first 5 data rows for the ColumnMapper preview.
 */
function extractCSVPreview(csvContent: string): ColumnMapperState {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], previewRows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const headers = parseLine(lines[0]).map((h) => h.trim());
  const previewRows: string[][] = [];
  for (let i = 1; i < Math.min(lines.length, 6); i++) {
    previewRows.push(parseLine(lines[i]));
  }

  return { headers, previewRows };
}

function getProcessingStages(progress: number, result: UploadResult | null): ProcessingStage[] {
  const stages: ProcessingStage[] = [
    {
      label: 'Reading file...',
      done: progress >= 10,
      active: progress > 0 && progress < 10,
    },
    {
      label: result?.metadata?.brokerFormat
        ? `Detecting broker format: ${result.metadata.brokerFormat}`
        : 'Detecting broker format...',
      done: progress >= 30,
      active: progress >= 10 && progress < 30,
    },
    {
      label: result
        ? `Parsing trades: ${result.metadata?.parsedRows ?? result.tradesImported} found`
        : 'Parsing trades...',
      done: progress >= 80,
      active: progress >= 30 && progress < 80,
    },
    {
      label: 'Detecting patterns...',
      done: progress >= 90,
      active: progress >= 80 && progress < 90,
    },
    {
      label: 'Computing baseline...',
      done: progress >= 100,
      active: progress >= 90 && progress < 100,
    },
  ];
  return stages;
}

export function FileUpload() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [hasExistingTrades, setHasExistingTrades] = useState(false);

  // Broker selection state
  const [selectedBroker, setSelectedBroker] = useState<BrokerKey | null>(null);

  // Column mapping state
  const [mappingMode, setMappingMode] = useState(false);
  const [mapperData, setMapperData] = useState<ColumnMapperState | null>(null);
  const pendingFileRef = useRef<File | null>(null);

  // Animated progress for terminal stages
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    fetch('/api/trades?limit=1')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.trades?.length > 0) setHasExistingTrades(true);
      })
      .catch(() => {});
  }, []);

  // Animate progress through stages
  useEffect(() => {
    if (!uploading && progress === 0) {
      setAnimatedProgress(0);
      return;
    }

    if (progress >= 100) {
      // Quickly animate through remaining stages
      const timer1 = setTimeout(() => setAnimatedProgress(90), 200);
      const timer2 = setTimeout(() => setAnimatedProgress(100), 500);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }

    if (progress > animatedProgress) {
      setAnimatedProgress(progress);
    }
  }, [progress, uploading, animatedProgress]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file. See our export guide for help.');
      return;
    }

    setFileName(file.name);
    setUploading(true);
    setError(null);
    setResult(null);
    setMappingMode(false);
    setMapperData(null);
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file);
      setProgress(30);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      setProgress(80);
      const data = await res.json();
      if (!res.ok) {
        const errMsg: string = data.error || '';
        // Check if this is an unrecognized format error -- offer manual mapping
        if (
          errMsg.includes('Unrecognized broker format') ||
          errMsg.includes('Unsupported broker format')
        ) {
          // Read the file to extract headers and preview rows
          const csvContent = await file.text();
          const preview = extractCSVPreview(csvContent);
          if (preview.headers.length > 0) {
            pendingFileRef.current = file;
            setMapperData(preview);
            setMappingMode(true);
            setError(null);
            setProgress(0);
            return;
          }
        }
        setError(errMsg || 'Upload failed. Please check your file format.');
        setProgress(0);
        return;
      }
      setProgress(100);
      setResult(data);
    } catch {
      setError('Network error. Please check your connection and try again.');
      setProgress(0);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleMappingConfirm = useCallback(async (mapping: ColumnMapping, formatName?: string) => {
    const file = pendingFileRef.current;
    if (!file) {
      setError('File reference lost. Please re-upload.');
      setMappingMode(false);
      return;
    }

    setUploading(true);
    setMappingMode(false);
    setError(null);
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mapping', JSON.stringify(mapping));
      if (formatName) {
        formData.append('formatName', formatName);
      }
      setProgress(30);

      const res = await fetch('/api/upload/with-mapping', {
        method: 'POST',
        body: formData,
      });
      setProgress(80);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Upload failed with the provided column mapping.');
        setProgress(0);
        return;
      }
      setProgress(100);
      setResult(data);
    } catch {
      setError('Network error. Please check your connection and try again.');
      setProgress(0);
    } finally {
      setUploading(false);
      pendingFileRef.current = null;
    }
  }, []);

  const handleMappingCancel = useCallback(() => {
    setMappingMode(false);
    setMapperData(null);
    pendingFileRef.current = null;
    setError(null);
    setFileName(null);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const onDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) handleFile(file); }, [handleFile]);
  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) handleFile(file); }, [handleFile]);
  const reset = useCallback(() => { setResult(null); setError(null); setFileName(null); setProgress(0); setAnimatedProgress(0); setMappingMode(false); setMapperData(null); pendingFileRef.current = null; }, []);

  // Show column mapper when in mapping mode
  if (mappingMode && mapperData) {
    return (
      <div className="max-w-3xl mx-auto">
        <ColumnMapper
          headers={mapperData.headers}
          previewRows={mapperData.previewRows}
          onConfirm={handleMappingConfirm}
          onCancel={handleMappingCancel}
        />
      </div>
    );
  }

  const stages = getProcessingStages(animatedProgress, result);
  const optionsSkippedCount = result?.optionsSkipped ?? result?.metadata?.optionsSkipped ?? 0;
  const showResults = result && !uploading;
  const showProcessing = uploading || (progress > 0 && progress < 100 && !result && !error);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-display text-3xl tracking-wide mb-2">UPLOAD TRADES</h1>
      <p className="text-muted text-sm mb-6">
        Import your broker CSV to analyze trading patterns and behavior.
      </p>

      {/* Risk disclaimer */}
      <div className="mb-6 p-3 rounded bg-[#f5a623]/5 border border-[#f5a623]/20 text-[#f5a623] text-xs font-mono">
        Flinch analyzes behavioral patterns for educational purposes only. This is not financial advice. Trading involves risk of loss.
      </div>

      {/* Existing trades banner */}
      {hasExistingTrades && !result && (
        <div className="mb-6 p-3 rounded bg-blue-bg border border-blue/20 text-blue text-xs font-mono">
          You have existing trade history. Upload your weekly CSV to track your progress.
        </div>
      )}

      {/* ─── Step 1: Choose Your Broker ─── */}
      {!showResults && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-7 h-7 rounded-full border border-border-light flex items-center justify-center shrink-0">
              <span className="text-xs font-mono text-muted">1</span>
            </div>
            <h2 className="text-sm font-mono text-foreground tracking-wide">CHOOSE YOUR BROKER</h2>
          </div>

          {/* Broker buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
            {BROKERS.map((broker) => (
              <button
                key={broker.key}
                onClick={() => setSelectedBroker(selectedBroker === broker.key ? null : broker.key)}
                className={`px-3 py-2.5 rounded border text-xs font-mono transition-all ${
                  selectedBroker === broker.key
                    ? 'border-green bg-green-bg text-green'
                    : 'border-border-light bg-panel text-muted hover:border-muted hover:text-foreground'
                }`}
              >
                {broker.name}
              </button>
            ))}
          </div>

          {/* Broker instructions */}
          {selectedBroker && (
            <div className="rounded border border-border bg-panel p-4 mb-3">
              <p className="text-xs font-mono text-foreground mb-2">
                Export instructions for {BROKERS.find(b => b.key === selectedBroker)?.name}:
              </p>
              <ol className="space-y-1">
                {BROKERS.find(b => b.key === selectedBroker)?.instructions.map((step, i) => (
                  <li key={i} className="text-xs font-mono text-muted flex items-start gap-2">
                    <span className="text-green shrink-0">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Guide link */}
          <Link
            href="/guide"
            className="text-xs text-muted hover:text-foreground font-mono transition-colors"
          >
            Need detailed instructions? View full guide &rarr;
          </Link>
        </div>
      )}

      {/* ─── Step 2: Upload Your File ─── */}
      {!showProcessing && !showResults && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-7 h-7 rounded-full border border-border-light flex items-center justify-center shrink-0">
              <span className="text-xs font-mono text-muted">2</span>
            </div>
            <h2 className="text-sm font-mono text-foreground tracking-wide">UPLOAD YOUR FILE</h2>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`relative border border-dashed rounded-lg p-12 sm:p-16 text-center transition-all ${
              isDragging
                ? 'border-green bg-green-bg'
                : 'border-border-light hover:border-muted bg-panel'
            } ${uploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
          >
            <input
              type="file"
              accept=".csv"
              onChange={onFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={uploading}
            />
            {/* Upload icon */}
            <svg
              className={`w-16 h-16 mx-auto mb-5 transition-colors ${
                isDragging ? 'text-green' : 'text-muted/60'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-foreground font-medium text-lg mb-2">
              {fileName ? fileName : 'Drop your CSV here or click to browse'}
            </p>
            <p className="text-xs text-muted font-mono">
              Supports .csv files up to 10MB from any US stock broker
            </p>
          </div>
        </div>
      )}

      {/* ─── Step 3: Processing ─── */}
      {showProcessing && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-7 h-7 rounded-full border border-green/40 bg-green-bg flex items-center justify-center shrink-0">
              <span className="text-xs font-mono text-green">3</span>
            </div>
            <h2 className="text-sm font-mono text-green tracking-wide">PROCESSING</h2>
          </div>

          {/* Terminal-style processing */}
          <div className="rounded-lg border border-border bg-[#0a0a0e] p-5 font-mono text-sm">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
              <div className="w-2.5 h-2.5 rounded-full bg-red/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-green/60" />
              <span className="text-[10px] text-muted ml-2">{fileName ?? 'processing'}</span>
            </div>
            <div className="space-y-2">
              {stages.map((stage, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 transition-opacity duration-300 ${
                    stage.done || stage.active ? 'opacity-100' : 'opacity-30'
                  }`}
                >
                  {stage.done ? (
                    <span className="text-green text-xs w-5 text-center shrink-0">{'\u2713'}</span>
                  ) : stage.active ? (
                    <span className="text-green text-xs w-5 text-center shrink-0 animate-pulse">{'>'}</span>
                  ) : (
                    <span className="text-muted text-xs w-5 text-center shrink-0">{'\u00B7'}</span>
                  )}
                  <span
                    className={`text-xs ${
                      stage.done
                        ? 'text-green'
                        : stage.active
                        ? 'text-green/80'
                        : 'text-muted/50'
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="mt-4 pt-3 border-t border-border/50">
              <div className="w-full bg-border/30 rounded-full h-1">
                <div
                  className="bg-green h-1 rounded-full transition-all duration-500"
                  style={{ width: `${animatedProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Error display ─── */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-bg border border-red/20">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-red font-medium font-mono text-sm">Upload Error</p>
              <p className="text-xs text-red/80 mt-1">{error}</p>
              <p className="text-xs text-muted mt-2">
                <Link href="/guide" className="underline hover:text-foreground transition-colors">
                  View our export guide
                </Link>{' '}
                for step-by-step instructions.
              </p>
            </div>
          </div>
          <button onClick={reset} className="mt-3 text-xs text-muted hover:text-foreground transition-colors font-mono">
            Try again
          </button>
        </div>
      )}

      {/* ─── Step 4: Results Summary ─── */}
      {showResults && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-7 h-7 rounded-full border border-green/40 bg-green-bg flex items-center justify-center shrink-0">
              <span className="text-xs font-mono text-green">{'\u2713'}</span>
            </div>
            <h2 className="text-sm font-mono text-green tracking-wide">IMPORT COMPLETE</h2>
          </div>

          {/* Summary card */}
          <div className={`rounded-lg border p-5 ${
            result.tradesImported === 0 && result.failedInserts > 0
              ? 'bg-red-bg border-red/20'
              : 'bg-panel border-border'
          }`}>
            {/* Stock trades imported */}
            {result.tradesImported > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green text-sm">{'\u2713'}</span>
                <span className="text-green font-mono text-sm font-bold">
                  {result.tradesImported} stock trade{result.tradesImported !== 1 ? 's' : ''} imported
                </span>
              </div>
            )}

            {/* Upload failed */}
            {result.tradesImported === 0 && result.failedInserts > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-red text-sm">{'\u2717'}</span>
                <span className="text-red font-mono text-sm font-bold">
                  Upload failed &mdash; no trades imported
                </span>
              </div>
            )}

            {/* Options skipped */}
            {optionsSkippedCount > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-amber text-sm">{'\u26A0'}</span>
                <span className="text-amber font-mono text-xs">
                  {optionsSkippedCount} options trade{optionsSkippedCount !== 1 ? 's' : ''} skipped
                </span>
                <span className="text-muted font-mono text-[10px]">(coming soon)</span>
              </div>
            )}

            {/* Duplicates skipped */}
            {result.duplicatesSkipped > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-muted text-sm">&mdash;</span>
                <span className="text-muted font-mono text-xs">
                  {result.duplicatesSkipped} duplicate{result.duplicatesSkipped !== 1 ? 's' : ''} skipped
                </span>
              </div>
            )}

            {/* Errors */}
            {result.errors.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-red text-sm">{'\u2717'}</span>
                <span className="text-red font-mono text-xs">
                  {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Failed inserts */}
            {result.failedInserts > 0 && result.tradesImported > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-red text-sm">{'\u2717'}</span>
                <span className="text-red font-mono text-xs">
                  {result.failedInserts} trade{result.failedInserts !== 1 ? 's' : ''} failed to insert
                </span>
              </div>
            )}

            {/* Broker format detected */}
            {result.metadata?.brokerFormat && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <span className="text-muted font-mono text-[10px]">
                  Format detected: {result.metadata.brokerFormat}
                </span>
              </div>
            )}
          </div>

          {/* Estimated timestamps warning */}
          {result.metadata?.hasEstimatedTimes && (
            <div className="p-3 rounded-lg bg-amber-bg border border-amber/20 text-amber text-xs font-mono">
              &#9201; Hold times are estimated &mdash; your broker doesn&apos;t export exact execution times
            </div>
          )}

          {/* Warning */}
          {result.warning && (
            <div className="p-3 rounded-lg bg-amber-bg border border-amber/20 text-amber text-xs font-mono">
              {result.warning}
            </div>
          )}

          {/* Parse errors expandable */}
          {result.errors.length > 0 && (
            <div className="p-4 rounded-lg bg-panel border border-border">
              <p className="text-xs font-mono font-bold text-foreground mb-2">
                Parse Errors ({result.errors.length})
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {result.errors.slice(0, 20).map((err, i) => (
                  <p key={i} className="text-[10px] text-muted font-mono">Row {err.row}: {err.message}</p>
                ))}
                {result.errors.length > 20 && (
                  <p className="text-[10px] text-muted font-mono">...and {result.errors.length - 20} more</p>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 bg-green text-background rounded-lg text-sm font-mono font-bold hover:bg-green/90 transition-colors flex items-center justify-center gap-2"
            >
              View Your Dashboard
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
            <button
              onClick={reset}
              className="px-6 py-3 border border-border-light text-foreground rounded-lg text-sm font-mono hover:bg-panel transition-colors"
            >
              Upload Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
