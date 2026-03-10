'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Trade, PatternDetection } from '@/types/database';

interface TimelineEntry {
  trade: Trade;
  cumPnl: number;
  patterns: PatternDetection[];
  hasPattern: boolean;
}

interface TimelineData {
  date: string;
  session: {
    session_date: string;
    total_trades: number;
    net_pnl: number;
    win_rate: number | null;
    behavior_cost: number;
  } | null;
  timeline: TimelineEntry[];
  totalTrades: number;
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

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

interface SessionTimelineProps {
  date: string;
}

export function SessionTimeline({ date }: SessionTimelineProps) {
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analysis/timeline/${date}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load timeline');
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-loss-bg border border-loss/20 text-loss text-sm">
        {error}
      </div>
    );
  }

  if (!data || data.timeline.length === 0) {
    return (
      <div className="text-center py-12 text-muted">
        No trades found for {date}.
      </div>
    );
  }

  // Find max absolute cumPnl for scaling the bar
  const maxAbsCumPnl = Math.max(
    ...data.timeline.map((e) => Math.abs(e.cumPnl)),
    1
  );

  return (
    <div className="space-y-4">
      {/* Session summary */}
      {data.session && (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">Session: {date}</p>
              <p className={`text-xl font-bold ${data.session.net_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                {formatCurrency(Number(data.session.net_pnl))}
              </p>
            </div>
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <p className="text-foreground font-medium">{data.session.total_trades}</p>
                <p className="text-xs text-muted">Trades</p>
              </div>
              <div className="text-center">
                <p className="text-foreground font-medium">
                  {data.session.win_rate !== null
                    ? `${(data.session.win_rate * 100).toFixed(0)}%`
                    : '--'}
                </p>
                <p className="text-xs text-muted">Win Rate</p>
              </div>
              <div className="text-center">
                <p className="text-warn font-medium">
                  -${Math.abs(Number(data.session.behavior_cost)).toFixed(2)}
                </p>
                <p className="text-xs text-muted">Behavior Cost</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {data.timeline.map((entry, index) => {
          const trade = entry.trade;
          const pnl = Number(trade.net_pnl || 0);
          const pnlColor = pnl >= 0 ? 'text-profit' : 'text-loss';
          const barWidth = Math.max((Math.abs(entry.cumPnl) / maxAbsCumPnl) * 100, 2);
          const barColor = entry.cumPnl >= 0 ? 'bg-profit/30' : 'bg-loss/30';
          const isLast = index === data.timeline.length - 1;

          return (
            <div key={trade.id} className="relative flex gap-4">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                    entry.hasPattern
                      ? 'border-warn bg-warn'
                      : pnl >= 0
                      ? 'border-profit bg-profit/50'
                      : 'border-loss bg-loss/50'
                  }`}
                />
                {!isLast && (
                  <div className="w-px flex-1 bg-border min-h-[20px]" />
                )}
              </div>

              {/* Trade card */}
              <div className="flex-1 pb-4">
                <div className="bg-card rounded-lg border border-border p-4 hover:border-border-light transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {trade.symbol}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          trade.direction === 'long'
                            ? 'bg-profit/10 text-profit'
                            : 'bg-loss/10 text-loss'
                        }`}
                      >
                        {trade.direction.toUpperCase()}
                      </span>
                      <span className="text-xs text-muted">
                        {formatTime(trade.entry_time)}
                        {trade.exit_time && ` - ${formatTime(trade.exit_time)}`}
                      </span>
                    </div>
                    <span className={`font-mono font-semibold ${pnlColor}`}>
                      {formatCurrency(pnl)}
                    </span>
                  </div>

                  {/* Cumulative P&L bar */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-muted shrink-0 w-16">
                      Cum: {formatCurrency(entry.cumPnl)}
                    </span>
                    <div className="flex-1 h-1.5 bg-background rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor} transition-all`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>

                  {/* Pattern badges */}
                  {entry.patterns.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {entry.patterns.map((pattern) => (
                        <span
                          key={pattern.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-warn/10 text-warn border border-warn/20"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {PATTERN_LABELS[pattern.pattern_type] || pattern.pattern_type}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
