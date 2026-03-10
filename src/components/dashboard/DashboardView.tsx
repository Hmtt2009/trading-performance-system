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

function getPnlColor(value: number): string {
  if (value > 0) return 'text-profit';
  if (value < 0) return 'text-loss';
  return 'text-muted';
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
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-lg bg-loss-bg border border-loss/20 text-loss text-center">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { summary, equityCurve, patternSummary, calendarData } = data;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-xs text-muted uppercase tracking-wider mb-1">Net P&L</p>
          <p className={`text-3xl font-bold ${getPnlColor(summary.totalNetPnl)}`}>
            {formatCurrency(summary.totalNetPnl)}
          </p>
          <p className="text-xs text-muted mt-1">
            {summary.tradingDays} trading days
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-xs text-muted uppercase tracking-wider mb-1">Win Rate</p>
          <p className="text-3xl font-bold text-foreground">
            {formatPercent(summary.winRate)}
          </p>
          <p className="text-xs text-muted mt-1">
            {summary.totalWins}W / {summary.totalLosses}L
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-xs text-muted uppercase tracking-wider mb-1">Total Trades</p>
          <p className="text-3xl font-bold text-foreground">
            {summary.totalTrades}
          </p>
          <p className="text-xs text-muted mt-1">
            {summary.confidenceLabel}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-xs text-muted uppercase tracking-wider mb-1">Behavior Cost</p>
          <p className="text-3xl font-bold text-warn">
            -${Math.abs(summary.totalBehaviorCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted mt-1">
            Lost to patterns
          </p>
        </div>
      </div>

      {/* Equity curve */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
          Equity Curve
        </h2>
        {equityCurve.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={equityCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis
                dataKey="date"
                stroke="#888"
                fontSize={12}
                tickFormatter={(v: string) => {
                  const d = new Date(v + 'T00:00:00');
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis
                stroke="#888"
                fontSize={12}
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px',
                  color: '#ededed',
                }}
                formatter={(value) => [formatCurrency(Number(value)), 'Cumulative P&L']}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="cumPnl"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#3b82f6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-48 text-muted">
            No data for this period
          </div>
        )}
      </div>

      {/* Pattern summary and Calendar in a grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pattern summary */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
            Detected Patterns
          </h2>
          {Object.keys(patternSummary).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(patternSummary).map(([type, info]) => (
                <div
                  key={type}
                  className="flex items-center justify-between p-3 rounded-lg bg-background border border-border"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {PATTERN_LABELS[type] || type}
                    </p>
                    <p className="text-xs text-muted">{info.count} instances</p>
                  </div>
                  <p className="text-sm font-semibold text-warn">
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

        {/* Calendar heat map */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
            Calendar
          </h2>
          {calendarData.length > 0 ? (
            <div className="grid grid-cols-7 gap-1.5">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                <div
                  key={i}
                  className="text-center text-xs text-muted font-medium pb-1"
                >
                  {day}
                </div>
              ))}
              {(() => {
                // Fill in the calendar grid
                const cells: React.ReactNode[] = [];
                const dataMap = new Map(
                  calendarData.map((d) => [d.date, d])
                );

                // Get the date range
                const startDate = new Date(calendarData[0].date + 'T00:00:00');
                const endDate = new Date(
                  calendarData[calendarData.length - 1].date + 'T00:00:00'
                );

                // Align to Monday
                const startDow = startDate.getDay();
                const alignedStart = new Date(startDate);
                alignedStart.setDate(
                  alignedStart.getDate() - ((startDow + 6) % 7)
                );

                const current = new Date(alignedStart);
                while (current <= endDate) {
                  const dateStr = current.toISOString().split('T')[0];
                  const dayData = dataMap.get(dateStr);
                  const dow = current.getDay();
                  const isWeekend = dow === 0 || dow === 6;

                  let bgColor = 'bg-background';
                  if (dayData) {
                    if (dayData.pnl > 0) bgColor = 'bg-profit/30';
                    else if (dayData.pnl < 0) bgColor = 'bg-loss/30';
                    else bgColor = 'bg-muted/20';
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
                      <span className="text-[10px] text-muted/60">
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
  );
}
