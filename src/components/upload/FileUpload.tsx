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
  };
  warning?: string;
  optionsMessage?: string;
}

interface ColumnMapperState {
  headers: string[];
  previewRows: string[][];
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

export function FileUpload() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [hasExistingTrades, setHasExistingTrades] = useState(false);

  // Column mapping state
  const [mappingMode, setMappingMode] = useState(false);
  const [mapperData, setMapperData] = useState<ColumnMapperState | null>(null);
  const pendingFileRef = useRef<File | null>(null);

  useEffect(() => {
    fetch('/api/trades?limit=1')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.trades?.length > 0) setHasExistingTrades(true);
      })
      .catch(() => {});
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file.');
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
  const reset = useCallback(() => { setResult(null); setError(null); setFileName(null); setProgress(0); setMappingMode(false); setMapperData(null); pendingFileRef.current = null; }, []);

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

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-display text-3xl tracking-wide mb-2">UPLOAD TRADES</h1>
      <p className="text-muted text-sm mb-6">
        Upload your broker CSV export to import trades for analysis.
      </p>

      {/* Risk disclaimer */}
      <div className="mb-4 p-3 rounded bg-[#f5a623]/5 border border-[#f5a623]/20 text-[#f5a623] text-xs font-mono">
        Flinch analyzes behavioral patterns for educational purposes only. This is not financial advice. Trading involves risk of loss.
      </div>

      {/* Existing trades banner */}
      {hasExistingTrades && !result && (
        <div className="mb-4 p-3 rounded bg-blue-bg border border-blue/20 text-blue text-xs font-mono">
          You have existing trade history. Upload your weekly CSV to track your progress.
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative border border-dashed rounded p-16 text-center transition-all ${
          isDragging
            ? 'border-green bg-green-bg'
            : 'border-border-light hover:border-muted bg-panel'
        } ${uploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
      >
        <input type="file" accept=".csv" onChange={onFileSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={uploading} />
        <svg className="w-12 h-12 text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-foreground font-medium text-lg mb-1">
          {fileName ? fileName : 'Drop your CSV file here'}
        </p>
        <p className="text-sm text-muted font-mono">
          or click to browse. Supports IBKR, Schwab, TD Ameritrade, Webull, and custom CSV exports.
        </p>
      </div>

      {/* Help link */}
      <p className="mt-3 text-center">
        <Link href="/guide" className="text-xs text-muted hover:text-foreground font-mono transition-colors">
          Need help exporting? View the step-by-step guide &rarr;
        </Link>
      </p>

      {/* Progress bar */}
      {uploading && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted font-mono">Processing...</span>
            <span className="text-xs text-muted font-mono">{progress}%</span>
          </div>
          <div className="w-full bg-surface rounded-full h-1.5">
            <div className="bg-green h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mt-4 p-4 rounded bg-red-bg border border-red/20">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-red font-medium font-mono text-sm">Upload Error</p>
              <p className="text-xs text-red/80 mt-1">{error}</p>
              {(error.toLowerCase().includes('format') || error.toLowerCase().includes('unrecognized') || error.toLowerCase().includes('unsupported') || error.toLowerCase().includes('parse') || error.toLowerCase().includes('identify')) && (
                <p className="text-xs text-red/70 mt-2">
                  We couldn&apos;t identify your broker format. Currently supported: IBKR, Schwab, TD Ameritrade, Webull.{' '}
                  <Link href="/guide" className="underline hover:text-red transition-colors">
                    See our export guide
                  </Link>{' '}
                  for instructions.
                </p>
              )}
            </div>
          </div>
          <button onClick={reset} className="mt-3 text-xs text-muted hover:text-foreground transition-colors font-mono">
            Try again
          </button>
        </div>
      )}

      {/* Success / Results display */}
      {result && (
        <div className="mt-4 space-y-3">
          <div className={`p-4 rounded border ${result.tradesImported === 0 && result.failedInserts > 0 ? 'bg-red-bg border-red/20' : 'bg-green-bg border-green/20'}`}>
            <p className={`font-mono font-bold text-sm ${result.tradesImported === 0 && result.failedInserts > 0 ? 'text-red' : 'text-green'}`}>
              {result.tradesImported === 0 && result.failedInserts > 0 ? 'Upload Failed' : 'Upload Complete'}
            </p>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className={`text-2xl font-mono font-bold ${result.tradesImported > 0 ? 'text-green' : 'text-muted'}`}>{result.tradesImported}</p>
                <p className="text-[10px] text-muted font-mono">Imported</p>
              </div>
              <div>
                <p className="text-2xl font-mono font-bold text-muted">{result.duplicatesSkipped}</p>
                <p className="text-[10px] text-muted font-mono">Duplicates</p>
              </div>
              <div>
                <p className={`text-2xl font-mono font-bold ${result.failedInserts > 0 ? 'text-red' : 'text-muted'}`}>{result.failedInserts || 0}</p>
                <p className="text-[10px] text-muted font-mono">Failed</p>
              </div>
              <div>
                <p className="text-2xl font-mono font-bold text-muted">{result.errors.length}</p>
                <p className="text-[10px] text-muted font-mono">Errors</p>
              </div>
            </div>

            {result.metadata?.brokerFormat && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-bg border border-blue/20">
                <svg className="w-3.5 h-3.5 text-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-blue text-[11px] font-mono">
                  Detected format: {result.metadata.brokerFormat}
                </span>
              </div>
            )}
          </div>

          {result.failedInserts > 0 && (
            <div className="p-3 rounded bg-red-bg border border-red/20 text-red text-xs font-mono">
              {result.failedInserts} trade{result.failedInserts > 1 ? 's' : ''} failed to insert. These trades were not imported and may need to be re-uploaded.
            </div>
          )}
          {result.warning && (
            <div className="p-3 rounded bg-amber-bg border border-amber/20 text-amber text-xs font-mono">{result.warning}</div>
          )}
          {result.optionsMessage && (
            <div className="p-3 rounded bg-blue-bg border border-blue/20 text-blue text-xs font-mono">{result.optionsMessage}</div>
          )}

          {result.errors.length > 0 && (
            <div className="p-4 rounded bg-panel border border-border">
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

          <div className="flex gap-3">
            <button onClick={() => router.push('/dashboard')} className="px-4 py-2 bg-green text-background rounded text-xs font-mono font-bold hover:bg-green/90 transition-colors">
              VIEW DASHBOARD
            </button>
            <button onClick={reset} className="px-4 py-2 border border-border-light text-foreground rounded text-xs font-mono font-bold hover:bg-panel transition-colors">
              UPLOAD ANOTHER
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
