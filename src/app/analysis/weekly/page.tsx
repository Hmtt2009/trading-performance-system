'use client';

import { useCallback, useEffect, useState } from 'react';

interface WeekData {
  weekStart: string;
  weekEnd: string;
  netPnl: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  behaviorCost: number;
  topPattern: { type: string; count: number } | null;
  tradingDays: number;
}

const PATTERN_LABELS: Record<string, string> = {
  overtrading: 'Overtrading',
  size_escalation: 'Size Escalation',
  rapid_reentry: 'Rapid Re-entry',
  premature_exit: 'Premature Exit',
};

function formatCurrency(value: number): string {
  const prefix = value >= 0 ? '+$' : '-$';
  return `${prefix}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatWeekLabel(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(weekEnd + 'T00:00:00');
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} - ${end.toLocaleDateString('en-US', opts)}`;
}

function DeltaIndicator({ current, previous, format, invert }: {
  current: number; previous: number; format: 'currency' | 'percent' | 'number'; invert?: boolean;
}) {
  const diff = current - previous;
  if (diff === 0) return <span className="text-[10px] text-muted font-mono">--</span>;
  const isPositive = invert ? diff < 0 : diff > 0;
  const arrow = isPositive ? '\u2191' : '\u2193';
  const color = isPositive ? 'text-green' : 'text-red';
  let label: string;
  if (format === 'currency') label = `${arrow} $${Math.abs(diff).toFixed(0)}`;
  else if (format === 'percent') label = `${arrow} ${Math.abs(diff * 100).toFixed(1)}pp`;
  else label = `${arrow} ${Math.abs(diff)}`;
  return <span className={`text-[10px] font-mono font-bold ${color}`}>{label}</span>;
}

function MetricCard({ label, value, subtext, delta }: {
  label: string; value: string; subtext?: string; delta?: React.ReactNode;
}) {
  return (
    <div className="bg-panel rounded border border-border p-4">
      <p className="text-[10px] text-muted uppercase tracking-widest mb-1 font-mono font-bold">{label}</p>
      <p className="text-xl font-mono font-bold text-foreground">{value}</p>
      <div className="flex items-center gap-2 mt-1">
        {subtext && <span className="text-[10px] text-muted font-mono">{subtext}</span>}
        {delta}
      </div>
    </div>
  );
}

export default function WeeklyReviewPage() {
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeeks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analysis/weekly');
      if (!res.ok) throw new Error('Failed to load weekly data');
      const json = await res.json();
      setWeeks(json.weeks || []);
      if (json.weeks?.length > 0) setSelectedIdx(json.weeks.length - 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWeeks(); }, [fetchWeeks]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="p-4 rounded bg-red-bg border border-red/20 text-red text-sm font-mono">{error}</div>
      </div>
    );
  }

  if (weeks.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center py-20">
        <p className="text-lg font-medium text-muted">No weekly data yet</p>
        <p className="text-sm text-muted mt-1 font-mono">Upload your trades to start tracking weekly progress.</p>
      </div>
    );
  }

  const current = weeks[selectedIdx];
  const previous = selectedIdx > 0 ? weeks[selectedIdx - 1] : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl tracking-wide">WEEKLY REVIEW</h1>
        <p className="text-muted text-sm mt-1">Grab your coffee and let&apos;s review your trading week</p>
      </div>

      {/* Week selector */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSelectedIdx(Math.max(0, selectedIdx - 1))}
          disabled={selectedIdx <= 0}
          className="px-3 py-1.5 rounded border border-border text-xs font-mono font-bold disabled:opacity-30 hover:bg-panel transition-colors"
        >
          PREV
        </button>
        <div className="flex-1 text-center">
          <select
            value={selectedIdx}
            onChange={(e) => setSelectedIdx(Number(e.target.value))}
            className="bg-surface border border-border rounded px-4 py-2 text-xs font-mono font-bold text-foreground focus:outline-none focus:border-green/50 [color-scheme:dark]"
          >
            {weeks.map((w, i) => (
              <option key={w.weekStart} value={i}>
                {formatWeekLabel(w.weekStart, w.weekEnd)}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setSelectedIdx(Math.min(weeks.length - 1, selectedIdx + 1))}
          disabled={selectedIdx >= weeks.length - 1}
          className="px-3 py-1.5 rounded border border-border text-xs font-mono font-bold disabled:opacity-30 hover:bg-panel transition-colors"
        >
          NEXT
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard
          label="Net P&L"
          value={formatCurrency(current.netPnl)}
          subtext={`${current.tradingDays} days`}
          delta={previous ? <DeltaIndicator current={current.netPnl} previous={previous.netPnl} format="currency" /> : undefined}
        />
        <MetricCard
          label="Win Rate"
          value={`${(current.winRate * 100).toFixed(1)}%`}
          subtext={`${current.winningTrades}W / ${current.losingTrades}L`}
          delta={previous ? <DeltaIndicator current={current.winRate} previous={previous.winRate} format="percent" /> : undefined}
        />
        <MetricCard
          label="Trades"
          value={String(current.totalTrades)}
          delta={previous ? <DeltaIndicator current={current.totalTrades} previous={previous.totalTrades} format="number" /> : undefined}
        />
        <MetricCard
          label="Behavior Cost"
          value={`-$${Math.abs(current.behaviorCost).toFixed(0)}`}
          delta={previous ? <DeltaIndicator current={current.behaviorCost} previous={previous.behaviorCost} format="currency" invert /> : undefined}
        />
        <MetricCard
          label="Top Pattern"
          value={current.topPattern ? PATTERN_LABELS[current.topPattern.type] || current.topPattern.type : 'None'}
          subtext={current.topPattern ? `${current.topPattern.count} instances` : undefined}
        />
      </div>

      {/* Week over week comparison */}
      {previous && (
        <div className="bg-panel rounded border border-border overflow-hidden">
          <div className="panel-header px-4 py-3">
            <h3 className="text-[11px] font-mono font-bold text-muted uppercase tracking-widest">
              Week over Week
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="text-left px-4 py-2 text-[10px] text-muted uppercase font-mono font-bold tracking-wider">Metric</th>
                  <th className="text-right px-3 py-2 text-[10px] text-muted uppercase font-mono font-bold tracking-wider">
                    {formatWeekLabel(previous.weekStart, previous.weekEnd)}
                  </th>
                  <th className="text-right px-3 py-2 text-[10px] text-muted uppercase font-mono font-bold tracking-wider">
                    {formatWeekLabel(current.weekStart, current.weekEnd)}
                  </th>
                  <th className="text-right px-4 py-2 text-[10px] text-muted uppercase font-mono font-bold tracking-wider">Delta</th>
                </tr>
              </thead>
              <tbody>
                <ComparisonRow label="Net P&L" prev={formatCurrency(previous.netPnl)} curr={formatCurrency(current.netPnl)} delta={<DeltaIndicator current={current.netPnl} previous={previous.netPnl} format="currency" />} />
                <ComparisonRow label="Win Rate" prev={`${(previous.winRate * 100).toFixed(1)}%`} curr={`${(current.winRate * 100).toFixed(1)}%`} delta={<DeltaIndicator current={current.winRate} previous={previous.winRate} format="percent" />} />
                <ComparisonRow label="Total Trades" prev={String(previous.totalTrades)} curr={String(current.totalTrades)} delta={<DeltaIndicator current={current.totalTrades} previous={previous.totalTrades} format="number" />} />
                <ComparisonRow label="Trading Days" prev={String(previous.tradingDays)} curr={String(current.tradingDays)} delta={<DeltaIndicator current={current.tradingDays} previous={previous.tradingDays} format="number" />} />
                <ComparisonRow label="Behavior Cost" prev={`-$${Math.abs(previous.behaviorCost).toFixed(0)}`} curr={`-$${Math.abs(current.behaviorCost).toFixed(0)}`} delta={<DeltaIndicator current={current.behaviorCost} previous={previous.behaviorCost} format="currency" invert />} />
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ComparisonRow({ label, prev, curr, delta }: {
  label: string; prev: string; curr: string; delta: React.ReactNode;
}) {
  return (
    <tr className="border-b border-border/30 hover:bg-surface transition-colors">
      <td className="px-4 py-2.5 font-medium text-foreground">{label}</td>
      <td className="px-3 py-2.5 text-right text-muted font-mono">{prev}</td>
      <td className="px-3 py-2.5 text-right text-foreground font-mono font-bold">{curr}</td>
      <td className="px-4 py-2.5 text-right">{delta}</td>
    </tr>
  );
}
