'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const controller = new AbortController();
    const fetchCost = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/analysis/cost?period=${period}`, { signal: controller.signal });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to load cost data');
        }
        const json = await res.json();
        setData(json);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Failed to load cost data');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchCost();
    return () => controller.abort();
  }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded bg-red-bg border border-red/20 text-red text-sm font-mono">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl tracking-wide">COST OF BEHAVIOR</h2>
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

      {/* Hero number */}
      <div className="bg-panel rounded-lg border border-border p-8 text-center">
        <p className="text-[10px] text-muted uppercase tracking-widest font-mono font-bold mb-2">
          Total Behavior Cost
        </p>
        <p className="text-5xl font-mono font-bold text-amber">
          -${Math.abs(data.totalBehaviorCost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-muted mt-3 font-mono">
          You could have made{' '}
          <span className="text-green font-bold">
            {formatCurrency(data.simulatedPnl)}
          </span>{' '}
          instead of{' '}
          <span className={`font-bold ${data.actualPnl >= 0 ? 'text-green' : 'text-red'}`}>
            {formatCurrency(data.actualPnl)}
          </span>
        </p>
      </div>

      {/* Dual equity curve */}
      <div className="bg-panel rounded-lg border border-border overflow-hidden">
        <div className="panel-header px-4 py-3">
          <h3 className="text-[11px] font-mono font-bold text-muted uppercase tracking-widest">
            Actual vs. Simulated Equity
          </h3>
        </div>
        <div className="p-4">
          {data.equityCurveComparison.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.equityCurveComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c1c22" />
                <XAxis
                  dataKey="date"
                  stroke="#6b6b78"
                  fontSize={10}
                  fontFamily="monospace"
                  tickFormatter={(v: string) => {
                    const d = new Date(v + 'T00:00:00');
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis
                  stroke="#6b6b78"
                  fontSize={10}
                  fontFamily="monospace"
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#101014',
                    border: '1px solid #1c1c22',
                    borderRadius: '4px',
                    color: '#ededed',
                    fontFamily: 'monospace',
                    fontSize: '11px',
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
                  stroke="#3d7fff"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="simulated"
                  stroke="#00e87a"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted font-mono text-xs">
              No data for this period
            </div>
          )}
        </div>
      </div>

      {/* Per-pattern breakdown */}
      <div className="bg-panel rounded-lg border border-border overflow-hidden">
        <div className="panel-header px-4 py-3">
          <h3 className="text-[11px] font-mono font-bold text-muted uppercase tracking-widest">
            Breakdown by Pattern
          </h3>
        </div>
        {data.byPattern.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="text-left px-4 py-2 text-[10px] text-muted uppercase font-mono font-bold tracking-wider">
                    Pattern
                  </th>
                  <th className="text-right px-3 py-2 text-[10px] text-muted uppercase font-mono font-bold tracking-wider">
                    Instances
                  </th>
                  <th className="text-right px-3 py-2 text-[10px] text-muted uppercase font-mono font-bold tracking-wider">
                    Total Impact
                  </th>
                  <th className="text-right px-4 py-2 text-[10px] text-muted uppercase font-mono font-bold tracking-wider">
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
                      className="border-b border-border/30 hover:bg-surface transition-colors"
                    >
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        {PATTERN_LABELS[pattern.patternType] || pattern.patternType}
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted font-mono">
                        {pattern.instances}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-amber">
                        -${Math.abs(pattern.totalImpact).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted">
                        -${(pattern.instances > 0 ? Math.abs(pattern.totalImpact) / pattern.instances : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 pb-4">
            <p className="text-xs text-muted font-mono">
              No behavioral patterns detected in this period.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
