'use client';

import { useCallback, useEffect, useState } from 'react';
import type { EdgeScorecard, ScoreEntry } from '@/types';

interface ScorecardData {
  scorecard: EdgeScorecard;
  period: string;
}

const PERIODS = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'all', label: 'All' },
];

const HOUR_LABELS: Record<string, string> = {};
for (let h = 0; h < 24; h++) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  HOUR_LABELS[h.toString()] = `${hour12}${ampm}`;
}

const DOW_LABELS: Record<string, string> = {
  '0': 'Sunday',
  '1': 'Monday',
  '2': 'Tuesday',
  '3': 'Wednesday',
  '4': 'Thursday',
  '5': 'Friday',
  '6': 'Saturday',
};

function formatCurrency(value: number): string {
  const prefix = value >= 0 ? '+$' : '-$';
  return `${prefix}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ScoreTable({
  title,
  entries,
  labelMap,
}: {
  title: string;
  entries: Record<string, ScoreEntry>;
  labelMap?: Record<string, string>;
}) {
  const sortedEntries = Object.entries(entries).sort(
    ([, a], [, b]) => b.totalPnl - a.totalPnl
  );

  if (sortedEntries.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
          {title}
        </h3>
        <p className="text-sm text-muted">No data available.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
          {title}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-2 text-xs text-muted uppercase font-medium">
                {title.replace('By ', '')}
              </th>
              <th className="text-right px-4 py-2 text-xs text-muted uppercase font-medium">
                Trades
              </th>
              <th className="text-right px-4 py-2 text-xs text-muted uppercase font-medium">
                Win Rate
              </th>
              <th className="text-right px-4 py-2 text-xs text-muted uppercase font-medium">
                Avg P&L
              </th>
              <th className="text-right px-4 py-2 text-xs text-muted uppercase font-medium">
                Total P&L
              </th>
              <th className="text-right px-5 py-2 text-xs text-muted uppercase font-medium">
                Profit Factor
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map(([key, entry]) => {
              const label = labelMap ? labelMap[key] || key : key;
              return (
                <tr
                  key={key}
                  className="border-b border-border/50 hover:bg-card-hover transition-colors"
                >
                  <td className="px-5 py-2.5 font-medium text-foreground">
                    {label}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted">
                    {entry.trades}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted">
                    {(entry.winRate * 100).toFixed(1)}%
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono ${
                      entry.avgPnl >= 0 ? 'text-profit' : 'text-loss'
                    }`}
                  >
                    {formatCurrency(entry.avgPnl)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono font-medium ${
                      entry.totalPnl >= 0 ? 'text-profit' : 'text-loss'
                    }`}
                  >
                    {formatCurrency(entry.totalPnl)}
                  </td>
                  <td className="px-5 py-2.5 text-right text-muted">
                    {entry.profitFactor === Infinity
                      ? '--'
                      : entry.profitFactor.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InsightSection({
  title,
  items,
  color,
}: {
  title: string;
  items: string[];
  color: 'profit' | 'loss' | 'accent' | 'warn';
}) {
  if (items.length === 0) return null;

  const colorMap = {
    profit: 'bg-profit/10 border-profit/20 text-profit',
    loss: 'bg-loss/10 border-loss/20 text-loss',
    accent: 'bg-accent/10 border-accent/20 text-accent',
    warn: 'bg-warn/10 border-warn/20 text-warn',
  };

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <h4 className="text-xs font-semibold uppercase tracking-wider mb-2">
        {title}
      </h4>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm opacity-90">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScorecardView() {
  const [data, setData] = useState<ScorecardData | null>(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScorecard = useCallback(async (p: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analysis/scorecard?period=${p}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load scorecard');
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load scorecard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScorecard(period);
  }, [period, fetchScorecard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
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

  if (!data) return null;

  const { scorecard } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Edge Scorecard</h2>
        <div className="flex bg-card rounded-lg border border-border p-1 gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 text-sm rounded-md font-medium transition-colors ${
                period === p.value
                  ? 'bg-accent text-white'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <InsightSection title="Strengths" items={scorecard.strengths} color="profit" />
        <InsightSection title="Leaks" items={scorecard.leaks} color="loss" />
        <InsightSection title="Do More" items={scorecard.doMore} color="accent" />
        <InsightSection title="Do Less" items={scorecard.doLess} color="warn" />
      </div>

      {/* Tables */}
      <div className="space-y-6">
        <ScoreTable title="By Hour" entries={scorecard.byHour} labelMap={HOUR_LABELS} />
        <ScoreTable title="By Day of Week" entries={scorecard.byDow} labelMap={DOW_LABELS} />
        <ScoreTable title="By Hold Time" entries={scorecard.byHoldTime} />
        <ScoreTable title="By Ticker" entries={scorecard.byTicker} />
      </div>
    </div>
  );
}
