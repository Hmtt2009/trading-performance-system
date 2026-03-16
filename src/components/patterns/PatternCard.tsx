'use client';

import { useState } from 'react';

interface PostExitData {
  exitPrice: number;
  priceAt1h: number | null;
  priceAt2h: number | null;
  priceAt4h: number | null;
  maxMovePercent: number;
  direction: 'up' | 'down' | 'flat';
}

interface PatternCardProps {
  id: string;
  patternType: string;
  confidence: 'high' | 'medium';
  dollarImpact: number | null;
  description: string | null;
  sessionDate?: string;
  onDismiss?: (id: string) => void;
  detectionData?: Record<string, unknown> | null;
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
  detectionData,
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
    <div className="bg-panel rounded border border-border p-4 transition-all hover:border-border-light">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-mono font-bold text-foreground">
              {headline}
            </h3>
            <span
              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                confidence === 'high'
                  ? 'bg-green/10 text-green'
                  : 'bg-amber/10 text-amber'
              }`}
            >
              {confidence.toUpperCase()}
            </span>
            {sessionDate && (
              <span className="text-[10px] text-muted font-mono">{sessionDate}</span>
            )}
          </div>

          {dollarImpact !== null && (() => {
            const postExit = detectionData?.postExitData as PostExitData | undefined;
            const isVerified = patternType === 'premature_exit' && dollarImpact !== 0 && detectionData?.postExitEnriched === true && postExit;
            return (
              <>
                <p className="text-lg font-mono font-bold text-amber mb-2">
                  -${Math.abs(dollarImpact).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="text-[10px] text-muted font-mono font-normal ml-1">
                    {isVerified ? 'verified impact' : 'estimated impact'}
                  </span>
                </p>
                {isVerified && postExit && (
                  <div className="mb-2 p-2 rounded bg-surface border border-border text-xs font-mono">
                    <p className="text-muted">
                      After exit at ${postExit.exitPrice.toFixed(2)}, price {postExit.direction === 'up' ? 'rose' : postExit.direction === 'down' ? 'fell' : 'stayed flat'} {postExit.maxMovePercent}%
                    </p>
                    <div className="flex gap-3 mt-1 text-[10px] text-muted">
                      {postExit.priceAt1h != null && <span>1h: ${postExit.priceAt1h.toFixed(2)}</span>}
                      {postExit.priceAt2h != null && <span>2h: ${postExit.priceAt2h.toFixed(2)}</span>}
                      {postExit.priceAt4h != null && <span>4h: ${postExit.priceAt4h.toFixed(2)}</span>}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {description && (
            <p className="text-xs text-muted mb-3 font-mono">{description}</p>
          )}

          {recommendation && (
            <div className="p-3 rounded bg-blue-bg border border-blue/20">
              <p className="text-[10px] text-blue font-mono font-bold mb-0.5 uppercase tracking-widest">
                Recommendation
              </p>
              <p className="text-xs text-muted">{recommendation}</p>
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
