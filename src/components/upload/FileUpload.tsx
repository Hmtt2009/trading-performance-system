'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UploadResult {
  uploadId: string;
  tradesImported: number;
  duplicatesSkipped: number;
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

export function FileUpload() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file.');
      return;
    }

    setFileName(file.name);
    setUploading(true);
    setError(null);
    setResult(null);
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file);

      setProgress(30);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      setProgress(80);

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Upload failed. Please check your file format.');
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

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setFileName(null);
    setProgress(0);
  }, []);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Upload Trades</h1>
      <p className="text-muted mb-6">
        Upload your broker CSV export to import trades for analysis.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative border-2 border-dashed rounded-xl p-16 text-center transition-all ${
          isDragging
            ? 'border-accent bg-accent-bg'
            : 'border-border-light hover:border-muted bg-card'
        } ${uploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
      >
        <input
          type="file"
          accept=".csv"
          onChange={onFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploading}
        />

        <svg
          className="w-12 h-12 text-muted mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <p className="text-foreground font-medium text-lg mb-1">
          {fileName ? fileName : 'Drop your CSV file here'}
        </p>
        <p className="text-sm text-muted">
          or click to browse. Supports IBKR trade exports.
        </p>
      </div>

      {/* Progress bar */}
      {uploading && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted">Processing...</span>
            <span className="text-sm text-muted">{progress}%</span>
          </div>
          <div className="w-full bg-border rounded-full h-2">
            <div
              className="bg-accent h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mt-4 p-4 rounded-lg bg-loss-bg border border-loss/20">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-loss mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-loss font-medium">Upload Error</p>
              <p className="text-sm text-loss/80 mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={reset}
            className="mt-3 text-sm text-muted hover:text-foreground transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Success / Results display */}
      {result && (
        <div className="mt-4 space-y-4">
          <div className="p-4 rounded-lg bg-profit-bg border border-profit/20">
            <p className="text-profit font-semibold text-lg">
              Upload Complete
            </p>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-2xl font-bold text-profit">
                  {result.tradesImported}
                </p>
                <p className="text-xs text-muted">Trades Imported</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-muted">
                  {result.duplicatesSkipped}
                </p>
                <p className="text-xs text-muted">Duplicates Skipped</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-muted">
                  {result.errors.length}
                </p>
                <p className="text-xs text-muted">Errors</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-muted">
                  {result.metadata.optionsSkipped}
                </p>
                <p className="text-xs text-muted">Options Skipped</p>
              </div>
            </div>
          </div>

          {result.warning && (
            <div className="p-3 rounded-lg bg-warn-bg border border-warn/20 text-warn text-sm">
              {result.warning}
            </div>
          )}

          {result.optionsMessage && (
            <div className="p-3 rounded-lg bg-accent-bg border border-accent/20 text-accent text-sm">
              {result.optionsMessage}
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="p-4 rounded-lg bg-card border border-border">
              <p className="text-sm font-medium text-foreground mb-2">
                Parse Errors ({result.errors.length})
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {result.errors.slice(0, 20).map((err, i) => (
                  <p key={i} className="text-xs text-muted">
                    Row {err.row}: {err.message}
                  </p>
                ))}
                {result.errors.length > 20 && (
                  <p className="text-xs text-muted">
                    ...and {result.errors.length - 20} more
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              View Dashboard
            </button>
            <button
              onClick={reset}
              className="px-4 py-2 border border-border-light text-foreground rounded-lg text-sm font-medium hover:bg-card-hover transition-colors"
            >
              Upload Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
