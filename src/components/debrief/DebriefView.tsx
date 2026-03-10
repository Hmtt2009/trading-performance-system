'use client';

import { useCallback, useEffect, useState } from 'react';

interface Debrief {
  id: string;
  debrief_text: string;
  debrief_type: string;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  input_tokens: number | null;
  output_tokens: number | null;
}

interface DebriefViewProps {
  date: string;
}

export function DebriefView({ date }: DebriefViewProps) {
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDebrief = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/debrief/${date}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load debrief');
      }
      const json = await res.json();
      setDebrief(json.debrief);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load debrief');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchDebrief();
  }, [fetchDebrief]);

  const generateDebrief = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/debrief/${date}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate debrief');
      }
      const json = await res.json();
      setDebrief(json.debrief);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate debrief');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div className="p-4 rounded-lg bg-loss-bg border border-loss/20 text-loss text-sm">
          {error}
        </div>
        <button
          onClick={generateDebrief}
          disabled={generating}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {generating ? 'Generating...' : 'Try Again'}
        </button>
      </div>
    );
  }

  if (!debrief) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
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
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          AI Coaching Debrief
        </h3>
        <p className="text-sm text-muted mb-6 max-w-md mx-auto">
          Generate an AI-powered analysis of your trading session on {date}.
          The debrief will review your trades, identify patterns, and provide
          actionable coaching feedback.
        </p>
        <button
          onClick={generateDebrief}
          disabled={generating}
          className="px-6 py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
        >
          {generating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating Debrief...
            </>
          ) : (
            'Generate Debrief'
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Session Debrief: {date}
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Generated{' '}
            {new Date(debrief.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span className="text-xs text-accent">AI Generated</span>
        </div>
      </div>

      <div className="prose prose-invert prose-sm max-w-none">
        {debrief.debrief_text.split('\n').map((line, i) => {
          if (!line.trim()) return <br key={i} />;

          // Handle markdown-style headers
          if (line.startsWith('### ')) {
            return (
              <h4 key={i} className="text-base font-semibold text-foreground mt-4 mb-2">
                {line.replace('### ', '')}
              </h4>
            );
          }
          if (line.startsWith('## ')) {
            return (
              <h3 key={i} className="text-lg font-semibold text-foreground mt-5 mb-2">
                {line.replace('## ', '')}
              </h3>
            );
          }
          if (line.startsWith('# ')) {
            return (
              <h2 key={i} className="text-xl font-bold text-foreground mt-6 mb-3">
                {line.replace('# ', '')}
              </h2>
            );
          }

          // Handle bullet points
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <p key={i} className="text-sm text-muted/90 pl-4 py-0.5 flex gap-2">
                <span className="text-accent shrink-0">&#8226;</span>
                <span>{line.slice(2)}</span>
              </p>
            );
          }

          // Handle bold text with **
          const parts = line.split(/(\*\*[^*]+\*\*)/g);
          return (
            <p key={i} className="text-sm text-muted/90 leading-relaxed mb-1.5">
              {parts.map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return (
                    <strong key={j} className="text-foreground font-medium">
                      {part.slice(2, -2)}
                    </strong>
                  );
                }
                return part;
              })}
            </p>
          );
        })}
      </div>

      {debrief.input_tokens !== null && debrief.output_tokens !== null && (
        <div className="mt-6 pt-4 border-t border-border flex items-center gap-4 text-xs text-muted">
          <span>Tokens: {debrief.input_tokens + debrief.output_tokens}</span>
        </div>
      )}
    </div>
  );
}
