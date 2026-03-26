'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DashboardData {
  summary: {
    totalTrades: number;
    totalNetPnl: number;
    winRate: number;
    totalWins: number;
    totalLosses: number;
    tradingDays: number;
    totalBehaviorCost: number;
    confidenceLabel: string;
  };
  equityCurve: { date: string; pnl: number; cumPnl: number }[];
  patternSummary: Record<string, { count: number; totalImpact: number }>;
  calendarData: { date: string; pnl: number; trades: number }[];
  period: string;
}

interface RecentTrade {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  net_pnl: number | null;
  entry_time: string;
}

const PERIODS = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'all', label: 'All' },
];

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

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── Skeleton components ── */
function SkeletonCard() {
  return (
    <div className="bg-panel rounded border border-border p-3 animate-pulse">
      <div className="h-2.5 w-16 bg-surface rounded mb-2" />
      <div className="h-6 w-24 bg-surface rounded mb-1.5" />
      <div className="h-2 w-20 bg-surface rounded" />
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="bg-panel rounded border border-border overflow-hidden animate-pulse">
      <div className="px-4 py-3 border-b border-border">
        <div className="h-3 w-24 bg-surface rounded" />
      </div>
      <div className="p-4">
        <div className="h-[280px] bg-surface/50 rounded" />
      </div>
    </div>
  );
}

function SkeletonPatterns() {
  return (
    <div className="bg-panel rounded border border-border overflow-hidden animate-pulse">
      <div className="px-4 py-3 border-b border-border">
        <div className="h-3 w-32 bg-surface rounded" />
      </div>
      <div className="p-4 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-surface rounded" />
        ))}
      </div>
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="bg-panel rounded border border-border overflow-hidden animate-pulse">
      <div className="px-4 py-3 border-b border-border">
        <div className="h-3 w-28 bg-surface rounded" />
      </div>
      <div className="p-4 space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 bg-surface rounded" />
        ))}
      </div>
    </div>
  );
}

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(true);

  // Fetch dashboard data
  useEffect(() => {
    const controller = new AbortController();
    const fetchDashboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/analysis/dashboard?period=${period}`, { signal: controller.signal });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to load dashboard');
        }
        const json = await res.json();
        setData(json);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Failed to load dashboard');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchDashboard();
    return () => controller.abort();
  }, [period]);

  // Fetch recent trades (independent of period)
  useEffect(() => {
    const controller = new AbortController();
    const fetchTrades = async () => {
      setTradesLoading(true);
      try {
        const res = await fetch('/api/trades?limit=5&sortBy=entry_time&sortDir=desc', { signal: controller.signal });
        if (!res.ok) return;
        const json = await res.json();
        if (json.trades) {
          setRecentTrades(json.trades.slice(0, 5));
        }
      } catch {
        /* silent */
      } finally {
        if (!controller.signal.aborted) setTradesLoading(false);
      }
    };
    fetchTrades();
    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <div className="p-6 rounded bg-red-bg border border-red/20 text-red text-center">
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-5">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-surface rounded animate-pulse" />
        </div>

        {/* Stat cards skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>

        {/* Two column skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3">
            <SkeletonChart />
          </div>
          <div className="lg:col-span-2">
            <SkeletonPatterns />
          </div>
        </div>

        {/* Bottom skeleton */}
        <SkeletonTable />
      </div>
    );
  }

  if (!data) return null;

  const { summary, equityCurve, patternSummary, calendarData } = data;

  // Sort patterns by dollar impact, take top 3
  const sortedPatterns = Object.entries(patternSummary)
    .sort(([, a], [, b]) => b.totalImpact - a.totalImpact)
    .slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-wide">DASHBOARD</h1>
      </div>

      {/* ── Stat Cards Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* NET P&L - colored left border */}
        <div
          className={`bg-panel rounded border border-border p-3 border-l-2 ${
            summary.totalNetPnl >= 0 ? 'border-l-green' : 'border-l-red'
          } ${summary.totalNetPnl >= 0 ? 'glow-green' : 'glow-red'}`}
        >
          <p className="text-[10px] text-muted uppercase tracking-widest mb-1 font-mono">Net P&L</p>
          <p className={`text-xl lg:text-2xl font-mono font-bold ${summary.totalNetPnl >= 0 ? 'text-green' : 'text-red'}`}>
            {formatCurrency(summary.totalNetPnl)}
          </p>
          <p className="text-[10px] text-muted mt-0.5 font-mono">
            {summary.tradingDays} trading days
          </p>
        </div>

        {/* Win Rate */}
        <div className="bg-panel rounded border border-border p-3">
          <p className="text-[10px] text-muted uppercase tracking-widest mb-1 font-mono">Win Rate</p>
          <p className="text-lg font-mono font-bold text-foreground">
            {formatPercent(summary.winRate)}
          </p>
          <p className="text-[10px] text-muted mt-0.5 font-mono">
            {summary.totalWins}W / {summary.totalLosses}L
          </p>
        </div>

        {/* Total Trades */}
        <div className="bg-panel rounded border border-border p-3">
          <p className="text-[10px] text-muted uppercase tracking-widest mb-1 font-mono">Total Trades</p>
          <p className="text-lg font-mono font-bold text-foreground">
            {summary.totalTrades}
          </p>
          <p className="text-[10px] text-muted mt-0.5 font-mono">
            {summary.confidenceLabel}
          </p>
        </div>

        {/* Trading Days */}
        <div className="bg-panel rounded border border-border p-3">
          <p className="text-[10px] text-muted uppercase tracking-widest mb-1 font-mono">Trading Days</p>
          <p className="text-lg font-mono font-bold text-foreground">
            {summary.tradingDays}
          </p>
          <p className="text-[10px] text-muted mt-0.5 font-mono">
            {summary.totalTrades > 0
              ? `${(summary.totalTrades / Math.max(summary.tradingDays, 1)).toFixed(1)} avg/day`
              : 'No data'}
          </p>
        </div>

        {/* BEHAVIOR COST - amber left border */}
        <div className="bg-panel rounded border border-border p-3 border-l-2 border-l-amber">
          <p className="text-[10px] text-muted uppercase tracking-widest mb-1 font-mono">Behavior Cost</p>
          <p className="text-xl lg:text-2xl font-mono font-bold text-amber">
            -${Math.abs(summary.totalBehaviorCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-muted mt-0.5 font-mono">
            Lost to patterns
          </p>
        </div>
      </div>

      {/* ── Two-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left column: Equity Curve with period selector */}
        <div className="lg:col-span-3">
          <div className="bg-panel rounded border border-border overflow-hidden">
            <div className="panel-header px-4 py-3 flex items-center justify-between">
              <h2 className="text-[11px] font-mono font-bold text-muted uppercase tracking-widest">
                Equity Curve
              </h2>
              {/* Period selector pills */}
              <div className="flex bg-surface rounded border border-border p-0.5 gap-0.5">
                {PERIODS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPeriod(p.value)}
                    className={`px-2.5 py-1 text-[10px] rounded font-mono font-bold transition-colors ${
                      period === p.value
                        ? 'bg-panel text-green border border-green/20'
                        : 'text-muted hover:text-foreground border border-transparent'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4">
              {equityCurve.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={equityCurve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1c1c22" />
                    <XAxis
                      dataKey="date"
                      stroke="#6b6b78"
                      fontSize={10}
                      fontFamily="var(--font-space-mono)"
                      tickFormatter={(v: string) => {
                        const d = new Date(v + 'T00:00:00');
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                      }}
                    />
                    <YAxis
                      stroke="#6b6b78"
                      fontSize={10}
                      fontFamily="var(--font-space-mono)"
                      tickFormatter={(v: number) => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#101014',
                        border: '1px solid #1c1c22',
                        borderRadius: '4px',
                        color: '#e0e0e8',
                        fontFamily: 'var(--font-space-mono)',
                        fontSize: '11px',
                      }}
                      formatter={(value) => [formatCurrency(Number(value)), 'Cumulative P&L']}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumPnl"
                      stroke="#00e87a"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 3, fill: '#00e87a' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-muted font-mono text-sm">
                  No data for this period
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Pattern Summary */}
        <div className="lg:col-span-2">
          <div className="bg-panel rounded border border-border overflow-hidden h-full flex flex-col">
            <div className="panel-header px-4 py-3">
              <h2 className="text-[11px] font-mono font-bold text-muted uppercase tracking-widest">
                Top Patterns by Cost
              </h2>
            </div>
            <div className="p-4 flex-1 flex flex-col">
              {sortedPatterns.length > 0 ? (
                <div className="space-y-2 flex-1">
                  {sortedPatterns.map(([type, info]) => (
                    <div
                      key={type}
                      className="flex items-center justify-between p-3 rounded bg-surface border border-border hover:border-border-light transition-colors group cursor-default"
                    >
                      <div className="flex items-center gap-3">
                        {/* Trend indicator dot */}
                        <div className="w-2 h-2 rounded-full bg-amber/60 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-foreground group-hover:text-amber transition-colors">
                            {PATTERN_LABELS[type] || type}
                          </p>
                          <p className="text-[10px] text-muted font-mono">
                            {info.count} {info.count === 1 ? 'instance' : 'instances'}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-mono font-bold text-amber">
                        -${info.totalImpact.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-muted text-sm font-mono">
                    No patterns detected yet
                  </p>
                </div>
              )}
              {/* View all link */}
              <div className="mt-3 pt-3 border-t border-border">
                <Link
                  href="/patterns"
                  className="text-xs font-mono text-muted hover:text-green transition-colors"
                >
                  View all patterns &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Calendar Heatmap ── */}
      <div className="bg-panel rounded border border-border overflow-hidden">
        <div className="panel-header px-4 py-3">
          <h2 className="text-[11px] font-mono font-bold text-muted uppercase tracking-widest">
            Calendar
          </h2>
        </div>
        <div className="p-4">
          {calendarData.length > 0 ? (
            <div className="grid grid-cols-7 gap-1.5">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                <div key={i} className="text-center text-[10px] text-muted font-mono font-bold pb-1">
                  {day}
                </div>
              ))}
              {(() => {
                const cells: React.ReactNode[] = [];
                const dataMap = new Map(calendarData.map((d) => [d.date, d]));
                const startDate = new Date(calendarData[0].date + 'T00:00:00');
                const endDate = new Date(calendarData[calendarData.length - 1].date + 'T00:00:00');
                const startDow = startDate.getDay();
                const alignedStart = new Date(startDate);
                alignedStart.setDate(alignedStart.getDate() - ((startDow + 6) % 7));
                const current = new Date(alignedStart);
                while (current <= endDate) {
                  const dateStr = current.toISOString().split('T')[0];
                  const dayData = dataMap.get(dateStr);
                  const dow = current.getDay();
                  const isWeekend = dow === 0 || dow === 6;
                  let bgColor = 'bg-surface';
                  if (dayData) {
                    if (dayData.pnl > 0) bgColor = 'bg-green/20';
                    else if (dayData.pnl < 0) bgColor = 'bg-red/20';
                    else bgColor = 'bg-muted/10';
                  } else if (isWeekend) {
                    bgColor = 'bg-transparent';
                  }
                  cells.push(
                    <div
                      key={dateStr}
                      className={`aspect-square rounded-sm ${bgColor} flex items-center justify-center`}
                      title={
                        dayData
                          ? `${dateStr}: ${formatCurrency(dayData.pnl)} (${dayData.trades} trades)`
                          : dateStr
                      }
                    >
                      <span className="text-[9px] font-mono text-muted/50">
                        {current.getDate()}
                      </span>
                    </div>
                  );
                  current.setDate(current.getDate() + 1);
                }
                return cells;
              })()}
            </div>
          ) : (
            <p className="text-muted text-sm font-mono">No trading data yet.</p>
          )}
        </div>
      </div>

      {/* ── Recent Trades ── */}
      <div className="bg-panel rounded border border-border overflow-hidden">
        <div className="panel-header px-4 py-3 flex items-center justify-between">
          <h2 className="text-[11px] font-mono font-bold text-muted uppercase tracking-widest">
            Recent Trades
          </h2>
          <Link
            href="/trades"
            className="text-[10px] font-mono text-muted hover:text-green transition-colors"
          >
            View all trades &rarr;
          </Link>
        </div>
        <div>
          {tradesLoading ? (
            <div className="p-4 space-y-2 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-surface rounded" />
              ))}
            </div>
          ) : recentTrades.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="text-left px-4 py-2 text-[10px] text-muted uppercase tracking-widest font-mono font-bold">
                    Symbol
                  </th>
                  <th className="text-left px-4 py-2 text-[10px] text-muted uppercase tracking-widest font-mono font-bold">
                    Dir
                  </th>
                  <th className="text-right px-4 py-2 text-[10px] text-muted uppercase tracking-widest font-mono font-bold">
                    P&L
                  </th>
                  <th className="text-right px-4 py-2 text-[10px] text-muted uppercase tracking-widest font-mono font-bold">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentTrades.map((trade) => {
                  const pnl = trade.net_pnl;
                  const pnlColor =
                    pnl !== null && pnl > 0
                      ? 'text-green'
                      : pnl !== null && pnl < 0
                      ? 'text-red'
                      : 'text-muted';
                  return (
                    <tr
                      key={trade.id}
                      className="border-b border-border/40 hover:bg-surface transition-colors"
                    >
                      <td className="px-4 py-2.5 font-mono font-bold text-foreground">
                        {trade.symbol}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-bold ${
                            trade.direction === 'long'
                              ? 'bg-green/10 text-green'
                              : 'bg-red/10 text-red'
                          }`}
                        >
                          {trade.direction === 'long' ? 'LNG' : 'SHT'}
                        </span>
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono font-bold ${pnlColor}`}>
                        {pnl !== null ? formatCurrency(pnl) : '--'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted font-mono">
                        {formatDate(trade.entry_time)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-muted font-mono text-sm">
              No trades yet. Upload a CSV to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
