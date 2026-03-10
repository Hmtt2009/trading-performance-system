'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    tradesImported: number;
    duplicatesSkipped: number;
    optionsMessage?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file.');
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Upload failed');
        return;
      }

      setResult({
        tradesImported: data.tradesImported,
        duplicatesSkipped: data.duplicatesSkipped,
        optionsMessage: data.optionsMessage,
      });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setUploading(false);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => {
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

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          Upload your trades.
          <br />
          <span className="text-muted">See what you&apos;re really doing.</span>
        </h1>
        <p className="text-lg text-muted mb-10 max-w-lg mx-auto">
          Detect behavioral patterns like overtrading, revenge trading, and
          premature exits. Know the dollar cost of your habits.
        </p>

        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`relative border-2 border-dashed rounded-xl p-12 transition-all cursor-pointer ${
            isDragging
              ? 'border-accent bg-accent-bg'
              : 'border-border-light hover:border-muted bg-card'
          }`}
        >
          <input
            type="file"
            accept=".csv"
            onChange={onFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={uploading}
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-muted">Processing your trades...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <svg
                className="w-10 h-10 text-muted"
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
              <p className="text-foreground font-medium">
                Drop your CSV here or click to browse
              </p>
              <p className="text-sm text-muted">
                Supports IBKR trade exports (.csv)
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-loss-bg border border-loss/20 text-loss text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-4 p-4 rounded-lg bg-profit-bg border border-profit/20 text-sm">
            <p className="text-profit font-medium">
              {result.tradesImported} trades imported successfully
            </p>
            {result.duplicatesSkipped > 0 && (
              <p className="text-muted mt-1">
                {result.duplicatesSkipped} duplicates skipped
              </p>
            )}
            {result.optionsMessage && (
              <p className="text-warn mt-1">{result.optionsMessage}</p>
            )}
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-3 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              View Dashboard
            </button>
          </div>
        )}

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent/90 transition-colors"
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => router.push('/upload')}
            className="px-6 py-3 border border-border-light text-foreground rounded-lg font-medium hover:bg-card-hover transition-colors"
          >
            Upload Page
          </button>
        </div>
      </div>
    </div>
  );
}
