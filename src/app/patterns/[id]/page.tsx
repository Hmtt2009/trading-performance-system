'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { AuthGuard } from '@/components/auth/AuthGuard';
import type { PatternDetection, Trade, PatternType } from '@/types/database';

// --- Constants ---

const PATTERN_LABELS: Record<string, string> = {
  rapid_reentry: 'Rapid Re-Entry After Loss',
  size_escalation: 'Size Escalation After Loss',
  overtrading: 'Overtrading',
  premature_exit: 'Premature Profit Taking',
};

const SEVERITY_STYLES: Record<string, string> = {
  minor: 'border-blue/50 text-blue bg-blue-bg',
  moderate: 'border-amber/50 text-amber bg-amber-bg',
  severe: 'border-red/50 text-red bg-red-bg',
};

const PATTERN_ADVICE: Record<string, string[]> = {
  rapid_reentry: [
    'Consider a mandatory break after losses.',
    'If same ticker, step away entirely.',
  ],
  size_escalation: [
    'After losses, reduce size to 50% of normal.',
    'Set a max position size rule.',
  ],
  overtrading: [
    'Set a daily trade limit.',
    'After hitting your average, require a higher conviction threshold.',
  ],
  premature_exit: [
    'Use a trailing stop instead of a fixed target.',
    'Review your exit rules \u2014 are you exiting on fear or on signal?',
  ],
};

// --- Helpers ---

function formatCurrency(value: number): string {
  return Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function minutesBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

// --- Story Generation ---

function generateStory(
  pattern: PatternDetection,
  trades: Trade[],
  triggerTrade: Trade | null
): string {
  const data = pattern.detection_data || {};
  const type = pattern.pattern_type;

  if (type === 'rapid_reentry') {
    const prevLoss = data.prevLoss as number | undefined;
    const timeGap = data.timeGapMinutes as number | undefined;
    const sameTicker = data.sameTicker as boolean | undefined;
    const trigger = triggerTrade;
    const prevTrade = trades.find((t) => t.id !== trigger?.id) || trades[0];
    const symbol = prevTrade?.symbol || 'unknown';
    const symbol2 = trigger?.symbol || symbol;
    const qty = prevTrade?.quantity || 0;
    const entry = prevTrade?.entry_price?.toFixed(2) || '0.00';
    const exit = prevTrade?.exit_price?.toFixed(2) || '0.00';
    const pnl = trigger?.net_pnl ?? trigger?.gross_pnl ?? 0;
    const wonOrLost = pnl >= 0 ? 'won' : 'lost';
    const sizeChange = sameTicker
      ? 'the same ticker'
      : `a different position (${symbol2})`;
    const date = prevTrade?.entry_time
      ? formatDate(prevTrade.entry_time)
      : 'a recent session';
    const totalImpact = pattern.dollar_impact
      ? `$${formatCurrency(pattern.dollar_impact)}`
      : 'unknown';

    return `On ${date}, you lost $${formatCurrency(prevLoss ?? 0)} on ${symbol} (${qty} shares, bought at $${entry}, sold at $${exit}). ${timeGap ?? '?'} minutes later, you re-entered ${sizeChange}. This trade ${wonOrLost}: ${pnl >= 0 ? '+' : '-'}$${formatCurrency(pnl)}. Total damage from this sequence: ${totalImpact}.`;
  }

  if (type === 'size_escalation') {
    const consecutiveLosses = data.consecutiveLosses as number | undefined;
    const totalLoss = data.totalLoss as number | undefined;
    const prevSize = data.prevSize ?? data.avgPositionSize;
    const currentSize = data.currentSize ?? data.positionValue;
    const percentIncrease = data.percentIncrease ?? data.sizeMultiple;
    const trigger = triggerTrade || trades[trades.length - 1];
    const pnl = trigger?.net_pnl ?? trigger?.gross_pnl ?? 0;
    const wonOrLost = pnl >= 0 ? 'won' : 'lost';

    return `After ${consecutiveLosses ?? '?'} consecutive loss(es) totaling $${formatCurrency(totalLoss ?? 0)}, you increased your position size from $${formatCurrency(Number(prevSize) || 0)} to $${formatCurrency(Number(currentSize) || 0)} (${typeof percentIncrease === 'number' ? (percentIncrease > 10 ? percentIncrease.toFixed(0) : (percentIncrease * 100).toFixed(0)) : '?'}% increase). This larger position ${wonOrLost}: ${pnl >= 0 ? '+' : '-'}$${formatCurrency(pnl)}.`;
  }

  if (type === 'overtrading') {
    const tradeCount = data.tradeCount as number | undefined;
    const avgTrades = data.avgTrades ?? data.avgTradesPerDay;
    const excessCount = data.excessCount ?? data.excessTrades;
    const churnTickers = data.churnTickers as string[] | undefined;
    const date = trades[0]?.entry_time
      ? formatDate(trades[0].entry_time)
      : 'a recent session';
    const churnInfo = churnTickers?.length
      ? `Most churned: ${churnTickers.join(', ')}.`
      : '';

    return `On ${date}, you made ${tradeCount ?? '?'} trades \u2014 your average is ${typeof avgTrades === 'number' ? avgTrades.toFixed(1) : '?'}. The last ${excessCount ?? '?'} trades were excess. ${churnInfo}`;
  }

  if (type === 'premature_exit') {
    const holdTime = data.holdTime ?? data.holdTimeMinutes;
    const avgHold = data.avgHold ?? data.avgWinningHoldMinutes;
    const leftOnTable = data.leftOnTable as number | undefined;
    const trigger = triggerTrade || trades[0];
    const symbol = trigger?.symbol || 'unknown';
    const profit = trigger?.net_pnl ?? trigger?.gross_pnl ?? 0;

    return `You exited ${symbol} after ${holdTime ?? '?'} minutes with $${formatCurrency(profit)} profit. Your average winning hold is ${typeof avgHold === 'number' ? avgHold.toFixed(0) : '?'} minutes. Estimated $${formatCurrency(leftOnTable ?? 0)} left on the table.`;
  }

  return pattern.description || 'Pattern detected.';
}

// --- Key Metrics ---

interface MetricItem {
  label: string;
  value: string;
}

function getKeyMetrics(pattern: PatternDetection): MetricItem[] {
  const data = pattern.detection_data || {};
  const type = pattern.pattern_type;

  if (type === 'rapid_reentry') {
    return [
      { label: 'Time Gap', value: `${data.timeGapMinutes ?? '?'} min` },
      {
        label: 'Avg Gap',
        value: `${typeof data.avgGap === 'number' ? data.avgGap.toFixed(0) : (typeof data.avgTimeBetweenTrades === 'number' ? data.avgTimeBetweenTrades.toFixed(0) : '?')} min`,
      },
      { label: 'Same Ticker?', value: data.sameTicker ? 'Yes' : 'No' },
      {
        label: 'Size Increase?',
        value: data.sizeIncrease ? 'Yes' : 'No',
      },
    ];
  }

  if (type === 'size_escalation') {
    return [
      {
        label: 'Consecutive Losses',
        value: String(data.consecutiveLosses ?? '?'),
      },
      {
        label: 'Size Multiple',
        value: `${typeof data.sizeMultiple === 'number' ? data.sizeMultiple.toFixed(1) : '?'}x`,
      },
      {
        label: 'Avg Position Size',
        value: `$${formatCurrency(Number(data.avgPositionSize) || 0)}`,
      },
    ];
  }

  if (type === 'overtrading') {
    return [
      { label: 'Trade Count', value: String(data.tradeCount ?? '?') },
      {
        label: 'Threshold',
        value: String(
          typeof data.threshold === 'number'
            ? data.threshold.toFixed(0)
            : (typeof data.avgTradesPerDay === 'number'
                ? data.avgTradesPerDay.toFixed(1)
                : '?')
        ),
      },
      {
        label: 'Excess Count',
        value: String(data.excessCount ?? data.excessTrades ?? '?'),
      },
      {
        label: 'Churn Tickers',
        value:
          (data.churnTickers as string[] | undefined)?.join(', ') || 'None',
      },
    ];
  }

  if (type === 'premature_exit') {
    return [
      {
        label: 'Hold Time',
        value: `${data.holdTime ?? data.holdTimeMinutes ?? '?'} min`,
      },
      {
        label: 'Avg Winning Hold',
        value: `${typeof (data.avgHold ?? data.avgWinningHoldMinutes) === 'number' ? Number(data.avgHold ?? data.avgWinningHoldMinutes).toFixed(0) : '?'} min`,
      },
      {
        label: 'Hold Ratio',
        value: `${typeof data.holdRatio === 'number' ? (data.holdRatio * 100).toFixed(0) : '?'}%`,
      },
      {
        label: 'Left on Table',
        value: `$${formatCurrency(Number(data.leftOnTable) || 0)}`,
      },
    ];
  }

  return [];
}

// --- Trade Timeline ---

function TradeTimeline({
  trades,
  triggerTrade,
  patternType,
}: {
  trades: Trade[];
  triggerTrade: Trade | null;
  patternType: PatternType;
}) {
  const allTrades = [...trades];
  // Make sure trigger trade is in the list
  if (triggerTrade && !allTrades.find((t) => t.id === triggerTrade.id)) {
    allTrades.push(triggerTrade);
  }
  // Sort chronologically by entry_time
  allTrades.sort(
    (a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
  );

  if (allTrades.length === 0) {
    return (
      <p className="text-muted font-mono text-sm">
        No trade data available.
      </p>
    );
  }

  const triggerId = triggerTrade?.id;

  return (
    <div className="relative pl-6">
      {/* Vertical timeline line */}
      <div className="absolute left-2 top-2 bottom-2 w-px bg-border-light" />

      {allTrades.map((trade, idx) => {
        const isTrigger = trade.id === triggerId;
        const pnl = trade.net_pnl ?? trade.gross_pnl ?? null;
        const isProfit = pnl !== null && pnl >= 0;
        const isLoss = pnl !== null && pnl < 0;

        // Compute gap annotation from previous trade
        let annotation: string | null = null;
        if (idx > 0) {
          const prev = allTrades[idx - 1];
          const prevEnd = prev.exit_time || prev.entry_time;
          const gap = minutesBetween(prevEnd, trade.entry_time);
          if (gap > 0 && (patternType === 'rapid_reentry' || patternType === 'size_escalation')) {
            annotation = `${gap} minutes later`;
          }
        }

        // Size annotation for size_escalation
        let sizeAnnotation: string | null = null;
        if (patternType === 'size_escalation' && idx > 0) {
          const prev = allTrades[idx - 1];
          const sizeRatio = trade.position_value / (prev.position_value || 1);
          if (sizeRatio > 1.2) {
            sizeAnnotation = `${sizeRatio.toFixed(1)}x size increase`;
          }
        }

        return (
          <div key={trade.id} className="relative mb-4 last:mb-0">
            {/* Annotations between trades */}
            {annotation && (
              <div className="mb-2 ml-2 flex items-center gap-2 text-xs text-muted font-mono">
                <span className="text-amber">&#8595;</span> {annotation}
              </div>
            )}
            {sizeAnnotation && (
              <div className="mb-2 ml-2 flex items-center gap-2 text-xs text-amber font-mono">
                <span>&#9888;&#65039;</span> {sizeAnnotation}
              </div>
            )}

            {/* Timeline dot */}
            <div
              className={`absolute left-[-16px] top-1 w-2.5 h-2.5 rounded-full border-2 ${
                isTrigger
                  ? 'border-amber bg-amber/30'
                  : isLoss
                    ? 'border-red bg-red/20'
                    : isProfit
                      ? 'border-green bg-green/20'
                      : 'border-muted bg-surface'
              }`}
            />

            {/* Trade entry */}
            <div className="bg-surface border border-border rounded p-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="font-mono text-sm text-foreground">
                  <span className="text-muted text-xs mr-2">
                    {formatTime(trade.entry_time)}
                  </span>
                  <span className="text-muted mr-1">&#8594;</span>
                  <span
                    className={`font-bold mr-2 ${
                      trade.direction === 'long' ? 'text-green' : 'text-red'
                    }`}
                  >
                    {trade.direction === 'long' ? 'BUY' : 'SELL'}
                  </span>
                  <span className="text-foreground font-bold mr-1">
                    {trade.quantity}
                  </span>
                  <span className="text-foreground mr-1">{trade.symbol}</span>
                  <span className="text-muted">
                    @ ${trade.entry_price.toFixed(2)}
                  </span>
                </div>

                {pnl !== null && (
                  <div className="flex items-center gap-1 font-mono text-sm">
                    {isProfit ? (
                      <span className="text-green">
                        &#10003; +${formatCurrency(pnl)}
                      </span>
                    ) : (
                      <span className="text-red">
                        &#10007; -${formatCurrency(pnl)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Exit info */}
              {trade.exit_time && trade.exit_price && (
                <div className="mt-1 font-mono text-xs text-muted">
                  <span className="mr-2">
                    Exit: {formatTime(trade.exit_time)}
                  </span>
                  <span>@ ${trade.exit_price.toFixed(2)}</span>
                  {trade.hold_time_minutes != null && (
                    <span className="ml-2">
                      ({trade.hold_time_minutes} min)
                    </span>
                  )}
                </div>
              )}

              {isTrigger && (
                <div className="mt-1">
                  <span className="inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber bg-amber-bg border border-amber/20 rounded">
                    TRIGGER
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Main Page Component ---

interface PatternDetailData {
  pattern: PatternDetection;
  trades: Trade[];
  triggerTrade: Trade | null;
}

function PatternDetailContent({ id }: { id: string }) {
  const [data, setData] = useState<PatternDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchDetail() {
      try {
        const res = await fetch(`/api/analysis/patterns/${id}/detail`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Failed to load pattern (${res.status})`);
        }
        const json = await res.json();
        if (isMounted) {
          setData(json);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load pattern detail');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-panel border border-red/30 rounded p-6 text-center">
          <p className="text-red font-mono text-sm mb-4">
            {error || 'Pattern not found'}
          </p>
          <Link
            href="/dashboard"
            className="text-green font-mono text-sm hover:underline"
          >
            &larr; Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { pattern, trades, triggerTrade } = data;
  const label = PATTERN_LABELS[pattern.pattern_type] || pattern.pattern_type;
  const severityStyle =
    SEVERITY_STYLES[pattern.severity || 'minor'] || SEVERITY_STYLES.minor;
  const advice = PATTERN_ADVICE[pattern.pattern_type] || [];
  const metrics = getKeyMetrics(pattern);
  const story = generateStory(pattern, trades, triggerTrade);
  const sessionDate = pattern.created_at ? formatDate(pattern.created_at) : null;
  const dollarImpact = pattern.dollar_impact;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Navigation */}
      <nav className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="text-muted hover:text-green font-mono text-sm transition-colors"
        >
          &larr; Back to Dashboard
        </Link>
      </nav>

      {/* Header Section */}
      <header className="bg-panel border border-border rounded-lg p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl sm:text-4xl text-foreground tracking-wide uppercase">
            {label}
          </h1>

          <span
            className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
              pattern.confidence === 'high'
                ? 'border-green/50 text-green bg-green-bg'
                : 'border-amber/50 text-amber bg-amber-bg'
            }`}
          >
            {pattern.confidence.toUpperCase()}
          </span>

          {pattern.severity && (
            <span
              className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${severityStyle}`}
            >
              {pattern.severity.toUpperCase()}
            </span>
          )}
        </div>

        {dollarImpact !== null && (
          <p
            className={`text-4xl sm:text-5xl font-mono font-bold ${
              dollarImpact < 0 ? 'text-red' : 'text-green'
            }`}
          >
            {dollarImpact < 0 ? '-' : '+'}${formatCurrency(dollarImpact)}
          </p>
        )}

        {sessionDate && (
          <p className="text-muted font-mono text-xs">{sessionDate}</p>
        )}
      </header>

      {/* The Story Section */}
      <section className="bg-panel border border-border rounded-lg p-6">
        <h2 className="font-display text-xl text-foreground tracking-wide uppercase mb-4">
          The Story
        </h2>
        <p className="font-mono text-sm text-foreground leading-relaxed">
          {story}
        </p>
      </section>

      {/* Trade Timeline Section */}
      <section className="bg-panel border border-border rounded-lg p-6">
        <h2 className="font-display text-xl text-foreground tracking-wide uppercase mb-4">
          Trade Timeline
        </h2>
        <TradeTimeline
          trades={trades}
          triggerTrade={triggerTrade}
          patternType={pattern.pattern_type}
        />
      </section>

      {/* Key Metrics Section */}
      {metrics.length > 0 && (
        <section className="bg-panel border border-border rounded-lg p-6">
          <h2 className="font-display text-xl text-foreground tracking-wide uppercase mb-4">
            Key Metrics
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="bg-surface border border-border rounded p-3"
              >
                <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">
                  {m.label}
                </p>
                <p className="text-lg font-mono font-bold text-foreground">
                  {m.value}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* What To Do Differently Section */}
      {advice.length > 0 && (
        <section className="bg-panel border border-border rounded-lg p-6">
          <h2 className="font-display text-xl text-foreground tracking-wide uppercase mb-4">
            What To Do Differently
          </h2>
          <div className="space-y-3">
            {advice.map((tip, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 bg-blue-bg border border-blue/20 rounded"
              >
                <span className="text-blue font-mono text-sm mt-0.5 shrink-0">
                  {i + 1}.
                </span>
                <p className="text-sm font-mono text-foreground">{tip}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function PatternDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <AuthGuard>
      <PatternDetailContent id={resolvedParams.id} />
    </AuthGuard>
  );
}
