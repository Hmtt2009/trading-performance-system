'use client';

import { useCallback, useEffect, useState } from 'react';

interface RawSegment {
  trades: number;
  wins: number;
  totalPnl: number;
  winPnl: number;
  lossPnl: number;
}

interface ScoreEntry {
  trades: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  profitFactor: number;
}

interface ScorecardApiResponse {
  byHour: Record<string, RawSegment>;
  byDow: Record<string, RawSegment>;
  byHoldTime: Record<string, RawSegment>;
  bySymbol: Record<string, RawSegment>;
  byPriceTier: Record<string, RawSegment>;
  byTimeOfDay: Record<string, RawSegment>;
  totalTrades: number;
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
  '0': 'Sunday', '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday',
  '4': 'Thursday', '5': 'Friday', '6': 'Saturday',
};

const HOLD_TIME_LABELS: Record<string, string> = {
  '0-5min': '0-5min holds', '5-15min': '5-15min holds',
  '15-60min': '15-60min holds', '1-4hr': '1-4hr holds', '4hr+': '4hr+ holds',
};

function toScoreEntry(raw: RawSegment): ScoreEntry {
  return {
    trades: raw.trades,
    winRate: raw.trades > 0 ? raw.wins / raw.trades : 0,
    avgPnl: raw.trades > 0 ? raw.totalPnl / raw.trades : 0,
    totalPnl: raw.totalPnl,
    profitFactor: raw.lossPnl !== 0 ? raw.winPnl / Math.abs(raw.lossPnl) : raw.winPnl > 0 ? 1_000_000 : 0,
  };
}

function toScoreEntries(raw: Record<string, RawSegment>): Record<string, ScoreEntry> {
  const result: Record<string, ScoreEntry> = {};
  for (const [key, seg] of Object.entries(raw)) {
    if (seg.trades > 0) result[key] = toScoreEntry(seg);
  }
  return result;
}

function formatCurrency(value: number): string {
  const prefix = value >= 0 ? '+$' : '-$';
  return `${prefix}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function hourInsightLabel(h: string): string {
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const nextH = (hour + 1) % 24;
  const nextAmpm = nextH >= 12 ? 'PM' : 'AM';
  const nextH12 = nextH === 0 ? 12 : nextH > 12 ? nextH - 12 : nextH;
  if (ampm === nextAmpm) return `${h12}:00-${nextH12}:00 ${ampm}`;
  return `${h12}:00 ${ampm}-${nextH12}:00 ${nextAmpm}`;
}

interface LabeledSegment {
  label: string;
  totalPnl: number;
  avgPnl: number;
  trades: number;
}

function computeInsights(data: ScorecardApiResponse) {
  const segments: LabeledSegment[] = [];
  if (data.byHour) {
    for (const [key, seg] of Object.entries(data.byHour)) {
      if (seg.trades > 0) segments.push({ label: hourInsightLabel(key), totalPnl: seg.totalPnl, avgPnl: seg.totalPnl / seg.trades, trades: seg.trades });
    }
  }
  if (data.byDow) {
    for (const [key, seg] of Object.entries(data.byDow)) {
      if (seg.trades > 0) segments.push({ label: DOW_LABELS[key] || key, totalPnl: seg.totalPnl, avgPnl: seg.totalPnl / seg.trades, trades: seg.trades });
    }
  }
  if (data.byHoldTime) {
    for (const [key, seg] of Object.entries(data.byHoldTime)) {
      if (seg.trades > 0) segments.push({ label: HOLD_TIME_LABELS[key] || key, totalPnl: seg.totalPnl, avgPnl: seg.totalPnl / seg.trades, trades: seg.trades });
    }
  }
  const sorted = [...segments].sort((a, b) => b.totalPnl - a.totalPnl);
  const strengths = sorted.filter(s => s.totalPnl > 0).slice(0, 3).map(s => `${s.label}: ${formatCurrency(s.totalPnl)} total (${s.trades} trades)`);
  const leaks = sorted.filter(s => s.totalPnl < 0).slice(-3).reverse().map(s => `${s.label}: ${formatCurrency(s.totalPnl)} total (${s.trades} trades)`);
  const doMore = sorted.filter(s => s.totalPnl > 0).slice(0, 3).map(s => `Trade more during ${s.label}: ${formatCurrency(s.avgPnl)} avg`);
  const doLess = sorted.filter(s => s.totalPnl < 0).slice(-3).reverse().map(s => `Reduce trading during ${s.label}: ${formatCurrency(s.avgPnl)} avg`);
  return { strengths, leaks, doMore, doLess };
}

function ScoreTable({
  title,
  entries,
  labelMap,
  highlightNegative,
}: {
  title: string;
  entries: Record<string, ScoreEntry>;
  labelMap?: Record<string, string>;
  highlightNegative?: boolean;
}) {
  const sortedEntries = Object.entries(entries).sort(([, a], [, b]) => b.totalPnl - a.totalPnl);

  if (sortedEntries.length === 0) {
    return (
      <div className="bg-panel rounded border border-border p-4">
        <h3 className="text-[11px] font-mono font-bold text-muted uppercase tracking-widest mb-3">{title}</h3>
        <p className="text-xs text-muted">No data available.</p>
      </div>
    );
  }

  return (
    <div className="bg-panel rounded border border-border overflow-hidden">
      <div className="panel-header px-4 py-3">
        <h3 className="text-[11px] font-mono font-bold text-muted uppercase tracking-widest">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="text-left px-4 py-2 text-[10px] text-muted uppercase font-mono font-bold tracking-wider">{title.replace('By ', '').replace('Performance by ', '')}</th>
              <th className="text-right px-3 py-2 text-[10px] text-muted uppercase font-mono font-bold tracking-wider">Trades</th>
              <th className="text-right px-3 py-2 text-[10px] text-muted uppercase font-mono font-bold tracking-wider">Win%</th>
              <th className="text-right px-3 py-2 text-[10px] text-muted uppercase font-mono font-bold tracking-wider">Avg P&L</th>
              <th className="text-right px-3 py-2 text-[10px] text-muted uppercase font-mono font-bold tracking-wider">Total P&L</th>
              <th className="text-right px-4 py-2 text-[10px] text-muted uppercase font-mono font-bold tracking-wider">PF</th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map(([key, entry]) => {
              const label = labelMap ? labelMap[key] || key : key;
              const isSignificantlyNegative = highlightNegative && entry.totalPnl < -100;
              return (
                <tr key={key} className={`border-b border-border/30 hover:bg-surface transition-colors ${isSignificantlyNegative ? 'bg-red/5' : ''}`}>
                  <td className={`px-4 py-2 font-medium ${isSignificantlyNegative ? 'text-red' : 'text-foreground'}`}>{label}</td>
                  <td className="px-3 py-2 text-right text-muted font-mono">{entry.trades}</td>
                  <td className="px-3 py-2 text-right text-muted font-mono">{(entry.winRate * 100).toFixed(1)}%</td>
                  <td className={`px-3 py-2 text-right font-mono font-bold ${entry.avgPnl >= 0 ? 'text-green' : 'text-red'}`}>{formatCurrency(entry.avgPnl)}</td>
                  <td className={`px-3 py-2 text-right font-mono font-bold ${entry.totalPnl >= 0 ? 'text-green' : 'text-red'}`}>{formatCurrency(entry.totalPnl)}</td>
                  <td className="px-4 py-2 text-right text-muted font-mono">{entry.profitFactor >= 1_000_000 ? '--' : entry.profitFactor.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InsightSection({ title, items, color }: { title: string; items: string[]; color: 'green' | 'red' | 'blue' | 'amber' }) {
  if (items.length === 0) return null;
  const colorMap = {
    green: 'bg-green/8 border-green/20 text-green',
    red: 'bg-red/8 border-red/20 text-red',
    blue: 'bg-blue/8 border-blue/20 text-blue',
    amber: 'bg-amber/8 border-amber/20 text-amber',
  };
  return (
    <div className={`rounded border p-3 ${colorMap[color]}`}>
      <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest mb-2">{title}</h4>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-xs opacity-90">{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function ScorecardView() {
  const [data, setData] = useState<ScorecardApiResponse | null>(null);
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
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load scorecard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchScorecard(period); }, [period, fetchScorecard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 rounded bg-red-bg border border-red/20 text-red text-sm font-mono">{error}</div>;
  }

  if (!data) return null;

  const insights = computeInsights(data);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl tracking-wide">EDGE SCORECARD</h2>
        <div className="flex bg-surface rounded border border-border p-0.5 gap-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 text-xs rounded font-mono font-bold transition-colors ${
                period === p.value ? 'bg-panel text-green border border-green/20' : 'text-muted hover:text-foreground border border-transparent'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <InsightSection title="Strengths" items={insights.strengths} color="green" />
        <InsightSection title="Leaks" items={insights.leaks} color="red" />
        <InsightSection title="Do More" items={insights.doMore} color="blue" />
        <InsightSection title="Do Less" items={insights.doLess} color="amber" />
      </div>

      {/* Tables */}
      <div className="space-y-4">
        {data.byTimeOfDay && <ScoreTable title="Performance by Time of Day" entries={toScoreEntries(data.byTimeOfDay)} highlightNegative />}
        {data.byHour && <ScoreTable title="By Hour" entries={toScoreEntries(data.byHour)} labelMap={HOUR_LABELS} />}
        {data.byDow && <ScoreTable title="By Day of Week" entries={toScoreEntries(data.byDow)} labelMap={DOW_LABELS} />}
        {data.byHoldTime && <ScoreTable title="By Hold Time" entries={toScoreEntries(data.byHoldTime)} />}
        {data.byPriceTier && <ScoreTable title="Performance by Stock Type" entries={toScoreEntries(data.byPriceTier)} />}
        {data.bySymbol && <ScoreTable title="By Ticker" entries={toScoreEntries(data.bySymbol)} />}
      </div>
    </div>
  );
}
