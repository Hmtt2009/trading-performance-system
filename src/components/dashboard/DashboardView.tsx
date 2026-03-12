'use client';

import { useCallback, useEffect, useState } from 'react';
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

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (p: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analysis/dashboard?period=${p}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load dashboard');
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(period);
  }, [period, fetchDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded bg-red-bg border border-red/20 text-red text-center">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { summary, equityCurve, patternSummary, calendarData } = data;

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-wide">DASHBOARD</h1>
        <div className="flex bg-surface rounded border border-border p-0.5 gap-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 text-xs rounded font-mono font-bold transition-colors ${
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={`bg-panel rounded border border-border p-4 ${summary.totalNetPnl >= 0 ? 'glow-green' : 'glow-red'}`}>
          <p className="text-[10px] text-muted uppercase tracking-widest mb-1 font-mono">Net P&L</p>
          <p className={`text-2xl font-mono font-bold ${summary.totalNetPnl >= 0 ? 'text-green' : 'text-red'}`}>
            {formatCurrency(summary.totalNetPnl)}
          </p>
          <p className="text-[10px] text-muted mt-1 font-mono">
            {summary.tradingDays} trading days
          </p>
        </div>
        <div className="bg-panel rounded border border-border p-4">
          <p className="text-[10px] text-muted uppercase tracking-widest mb-1 font-mono">Win Rate</p>
          <p className="text-2xl font-mono font-bold text-foreground">
            {formatPercent(summary.winRate)}
          </p>
          <p className="text-[10px] text-muted mt-1 font-mono">
            {summary.totalWins}W / {summary.totalLosses}L
          </p>
        </div>
        <div className="bg-panel rounded border border-border p-4">
          <p className="text-[10px] text-muted uppercase tracking-widest mb-1 font-mono">Total Trades</p>
          <p className="text-2xl font-mono font-bold text-foreground">
            {summary.totalTrades}
          </p>
          <p className="text-[10px] text-muted mt-1 font-mono">
            {summary.confidenceLabel}
          </p>
        </div>
        <div className="bg-panel rounded border border-border p-4">
          <p className="text-[10px] text-muted uppercase tracking-widest mb-1 font-mono">Behavior Cost</p>
          <p className="text-2xl font-mono font-bold text-amber">
            -${Math.abs(summary.totalBehaviorCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-muted mt-1 font-mono">
            Lost to patterns
          </p>
        </div>
      </div>

      {/* Equity curve */}
      <div className="bg-panel rounded border border-border overflow-hidden">
        <div className="panel-header px-4 py-3">
          <h2 className="text-[11px] font-mono font-bold text-muted uppercase tracking-widest">
            Equity Curve
          </h2>
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

      {/* Pattern summary and Calendar in a grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pattern summary */}
        <div className="bg-panel rounded border border-border overflow-hidden">
          <div className="panel-header px-4 py-3">
            <h2 className="text-[11px] font-mono font-bold text-muted uppercase tracking-widest">
              Detected Patterns
            </h2>
          </div>
          <div className="p-4">
            {Object.keys(patternSummary).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(patternSummary).map(([type, info]) => (
                  <div
                    key={type}
                    className="flex items-center justify-between p-3 rounded bg-surface border border-border"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {PATTERN_LABELS[type] || type}
                      </p>
                      <p className="text-[10px] text-muted font-mono">{info.count} instances</p>
                    </div>
                    <p className="text-sm font-mono font-bold text-amber">
                      -${info.totalImpact.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted text-sm">
                No patterns detected in this period.
              </p>
            )}
          </div>
        </div>

        {/* Calendar heat map */}
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
              <p className="text-muted text-sm">No trading data yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
