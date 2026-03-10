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
  Legend,
} from 'recharts';

interface CostData {
  actualPnl: number;
  totalBehaviorCost: number;
  simulatedPnl: number;
  byPattern: {
    patternType: string;
    instances: number;
    totalImpact: number;
  }[];
  equityCurveComparison: {
    date: string;
    actual: number;
    simulated: number;
  }[];
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

export function CostOfBehaviorView() {
  const [data, setData] = useState<CostData | null>(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCost = useCallback(async (p: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analysis/cost?period=${p}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load cost data');
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cost data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCost(period);
  }, [period, fetchCost]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Cost of Behavior</h2>
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

      {/* Hero number */}
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <p className="text-sm text-muted uppercase tracking-wider mb-2">
          Total Behavior Cost
        </p>
        <p className="text-5xl font-bold text-warn">
          -${Math.abs(data.totalBehaviorCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-sm text-muted mt-3">
          You could have made{' '}
          <span className="text-profit font-medium">
            {formatCurrency(data.simulatedPnl)}
          </span>{' '}
          instead of{' '}
          <span className={`font-medium ${data.actualPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
            {formatCurrency(data.actualPnl)}
          </span>
        </p>
      </div>

      {/* Dual equity curve */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
          Actual vs. Simulated Equity
        </h3>
        {data.equityCurveComparison.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.equityCurveComparison}>
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
                formatter={(value, name) => [
                  formatCurrency(Number(value)),
                  name === 'actual' ? 'Actual' : 'Without Bad Behavior',
                ]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend
                formatter={(value: string) =>
                  value === 'actual' ? 'Actual P&L' : 'Simulated (No Bad Behavior)'
                }
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="simulated"
                stroke="#22c55e"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-48 text-muted">
            No data for this period
          </div>
        )}
      </div>

      {/* Per-pattern breakdown */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Breakdown by Pattern
          </h3>
        </div>
        {data.byPattern.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-2 text-xs text-muted uppercase font-medium">
                    Pattern
                  </th>
                  <th className="text-right px-4 py-2 text-xs text-muted uppercase font-medium">
                    Instances
                  </th>
                  <th className="text-right px-5 py-2 text-xs text-muted uppercase font-medium">
                    Total Impact
                  </th>
                  <th className="text-right px-5 py-2 text-xs text-muted uppercase font-medium">
                    Avg per Instance
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.byPattern
                  .sort((a, b) => b.totalImpact - a.totalImpact)
                  .map((pattern) => (
                    <tr
                      key={pattern.patternType}
                      className="border-b border-border/50 hover:bg-card-hover transition-colors"
                    >
                      <td className="px-5 py-3 font-medium text-foreground">
                        {PATTERN_LABELS[pattern.patternType] || pattern.patternType}
                      </td>
                      <td className="px-4 py-3 text-right text-muted">
                        {pattern.instances}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-warn font-medium">
                        -${Math.abs(pattern.totalImpact).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-muted">
                        -${(pattern.instances > 0 ? Math.abs(pattern.totalImpact) / pattern.instances : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 pb-5">
            <p className="text-sm text-muted">
              No behavioral patterns detected in this period.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
