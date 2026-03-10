'use client';

import { useState } from 'react';

interface PatternCardProps {
  id: string;
  patternType: string;
  confidence: 'high' | 'medium';
  dollarImpact: number | null;
  description: string | null;
  sessionDate?: string;
  onDismiss?: (id: string) => void;
}

const PATTERN_LABELS: Record<string, string> = {
  overtrading: 'Overtrading',
  size_escalation: 'Size Escalation',
  rapid_reentry: 'Rapid Re-entry',
  premature_exit: 'Premature Exit',
};

const PATTERN_RECOMMENDATIONS: Record<string, string> = {
  overtrading:
    'Consider setting a daily trade limit. Once you hit your max, walk away from the screen.',
  size_escalation:
    'Keep position sizes consistent. Increasing size after losses amplifies drawdowns.',
  rapid_reentry:
    'After exiting a trade, wait at least 5 minutes before re-entering the same symbol.',
  premature_exit:
    'Review your exit criteria. Consider using trailing stops instead of manual exits.',
};

export function PatternCard({
  id,
  patternType,
  confidence,
  dollarImpact,
  description,
  sessionDate,
  onDismiss,
}: PatternCardProps) {
  const [dismissing, setDismissing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      const res = await fetch(`/api/analysis/patterns/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss' }),
      });
      if (res.ok) {
        setDismissed(true);
        onDismiss?.(id);
      }
    } catch {
      // Silently fail
    } finally {
      setDismissing(false);
    }
  };

  if (dismissed) return null;

  const headline = PATTERN_LABELS[patternType] || patternType;
  const recommendation = PATTERN_RECOMMENDATIONS[patternType] || '';

  return (
    <div className="bg-card rounded-xl border border-border p-5 transition-all hover:border-border-light">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-base font-semibold text-foreground">
              {headline}
            </h3>
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                confidence === 'high'
                  ? 'bg-profit/10 text-profit'
                  : 'bg-warn/10 text-warn'
              }`}
            >
              {confidence.toUpperCase()}
            </span>
            {sessionDate && (
              <span className="text-xs text-muted">{sessionDate}</span>
            )}
          </div>

          {dollarImpact !== null && (
            <p className="text-lg font-bold text-warn mb-2">
              -${Math.abs(dollarImpact).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs text-muted font-normal ml-1">
                estimated impact
              </span>
            </p>
          )}

          {description && (
            <p className="text-sm text-muted mb-3">{description}</p>
          )}

          {recommendation && (
            <div className="p-3 rounded-lg bg-accent-bg border border-accent/10">
              <p className="text-xs text-accent font-medium mb-0.5">
                Recommendation
              </p>
              <p className="text-sm text-muted">{recommendation}</p>
            </div>
          )}
        </div>

        <button
          onClick={handleDismiss}
          disabled={dismissing}
          className="text-muted hover:text-foreground transition-colors p-1 shrink-0"
          title="Dismiss pattern"
        >
          {dismissing ? (
            <div className="w-4 h-4 border-2 border-muted border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
