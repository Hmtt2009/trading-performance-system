'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Trade } from '@/types/database';

interface TradeListData {
  trades: Trade[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

type SortColumn = 'entry_time' | 'symbol' | 'net_pnl' | 'position_value' | 'hold_time_minutes';

function formatCurrency(value: number | null): string {
  if (value === null) return '--';
  const prefix = value >= 0 ? '+$' : '-$';
  return `${prefix}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number | null): string {
  if (value === null) return '--';
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
}

function formatHoldTime(minutes: number | null): string {
  if (minutes === null) return '--';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  }) + ' ' + d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function TradeList() {
  const [data, setData] = useState<TradeListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortColumn>('entry_time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [symbolFilter, setSymbolFilter] = useState('');

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        sortBy,
        sortDir,
      });
      if (symbolFilter.trim()) {
        params.set('symbol', symbolFilter.trim());
      }
      const res = await fetch(`/api/trades?${params}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load trades');
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load trades');
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortDir, symbolFilter]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
    setPage(1);
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortBy !== column) return <span className="text-border-light ml-1">&#x2195;</span>;
    return (
      <span className="text-accent ml-1">
        {sortDir === 'asc' ? '\u2191' : '\u2193'}
      </span>
    );
  };

  if (error) {
    return (
      <div className="p-6 rounded-lg bg-loss-bg border border-loss/20 text-loss text-center">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Trades</h1>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Filter by symbol..."
            value={symbolFilter}
            onChange={(e) => {
              setSymbolFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-sm rounded-lg bg-card border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
          />
          {data && (
            <span className="text-sm text-muted">
              {data.pagination.total} total trades
            </span>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th
                  className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wider font-medium cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('symbol')}
                >
                  Symbol <SortIcon column="symbol" />
                </th>
                <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wider font-medium">
                  Direction
                </th>
                <th
                  className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wider font-medium cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('entry_time')}
                >
                  Entry <SortIcon column="entry_time" />
                </th>
                <th className="text-left px-4 py-3 text-xs text-muted uppercase tracking-wider font-medium">
                  Exit
                </th>
                <th
                  className="text-right px-4 py-3 text-xs text-muted uppercase tracking-wider font-medium cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('net_pnl')}
                >
                  P&L <SortIcon column="net_pnl" />
                </th>
                <th className="text-right px-4 py-3 text-xs text-muted uppercase tracking-wider font-medium">
                  P&L %
                </th>
                <th
                  className="text-right px-4 py-3 text-xs text-muted uppercase tracking-wider font-medium cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('hold_time_minutes')}
                >
                  Hold Time <SortIcon column="hold_time_minutes" />
                </th>
                <th
                  className="text-right px-4 py-3 text-xs text-muted uppercase tracking-wider font-medium cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('position_value')}
                >
                  Size <SortIcon column="position_value" />
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : data && data.trades.length > 0 ? (
                data.trades.map((trade) => {
                  const pnl = trade.net_pnl;
                  const pnlColor =
                    pnl !== null && pnl > 0
                      ? 'text-profit'
                      : pnl !== null && pnl < 0
                      ? 'text-loss'
                      : 'text-muted';

                  return (
                    <tr
                      key={trade.id}
                      className="border-b border-border/50 hover:bg-card-hover transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {trade.symbol}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            trade.direction === 'long'
                              ? 'bg-profit/10 text-profit'
                              : 'bg-loss/10 text-loss'
                          }`}
                        >
                          {trade.direction.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {formatDateTime(trade.entry_time)}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {trade.exit_time
                          ? formatDateTime(trade.exit_time)
                          : trade.is_open
                          ? 'Open'
                          : '--'}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-medium ${pnlColor}`}>
                        {formatCurrency(pnl)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${pnlColor}`}>
                        {formatPercent(trade.pnl_percent)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted">
                        {formatHoldTime(trade.hold_time_minutes)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted font-mono">
                        ${trade.position_value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted">
                    No trades found. Upload a CSV to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-muted">
              Page {data.pagination.page} of {data.pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 text-sm rounded-md border border-border text-muted hover:text-foreground hover:bg-card-hover transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setPage((p) =>
                    Math.min(data.pagination.totalPages, p + 1)
                  )
                }
                disabled={page >= data.pagination.totalPages}
                className="px-3 py-1 text-sm rounded-md border border-border text-muted hover:text-foreground hover:bg-card-hover transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
