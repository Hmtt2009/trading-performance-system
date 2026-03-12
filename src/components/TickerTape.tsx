'use client';

import { useCallback, useEffect, useState } from 'react';

interface TickerData {
  totalNetPnl: number;
  winRate: number;
  totalTrades: number;
  totalBehaviorCost: number;
  tradingDays: number;
}

function formatCurrency(value: number): string {
  const prefix = value >= 0 ? '+$' : '-$';
  return `${prefix}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function TickerTape() {
  const [data, setData] = useState<TickerData | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/analysis/dashboard?period=7d');
      if (!res.ok) return;
      const json = await res.json();
      if (json.summary) {
        setData({
          totalNetPnl: json.summary.totalNetPnl,
          winRate: json.summary.winRate,
          totalTrades: json.summary.totalTrades,
          totalBehaviorCost: json.summary.totalBehaviorCost,
          tradingDays: json.summary.tradingDays,
        });
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const items = data
    ? [
        { label: '7D P&L', value: formatCurrency(data.totalNetPnl), color: data.totalNetPnl >= 0 ? 'text-green' : 'text-red' },
        { label: 'WIN RATE', value: `${(data.winRate * 100).toFixed(1)}%`, color: 'text-foreground' },
        { label: 'TRADES', value: String(data.totalTrades), color: 'text-foreground' },
        { label: 'BEHAVIOR COST', value: `-$${Math.abs(data.totalBehaviorCost).toFixed(0)}`, color: 'text-amber' },
        { label: 'TRADING DAYS', value: String(data.tradingDays), color: 'text-foreground' },
      ]
    : [
        { label: 'TPS', value: 'TRADING PERFORMANCE SYSTEM', color: 'text-muted' },
        { label: 'STATUS', value: 'UPLOAD TRADES TO BEGIN', color: 'text-muted' },
      ];

  const segment = (
    <>
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-2 mx-6 whitespace-nowrap">
          <span className="text-muted text-[10px] tracking-wider">{item.label}</span>
          <span className={`font-mono text-xs font-bold ${item.color}`}>{item.value}</span>
        </span>
      ))}
      <span className="inline-flex items-center mx-6">
        <span className="w-1 h-1 rounded-full bg-green/40" />
      </span>
    </>
  );

  return (
    <div className="fixed top-0 left-0 right-0 h-9 z-50 bg-surface border-b border-border overflow-hidden flex items-center">
      <div className="ticker-scroll inline-flex">
        {segment}
        {segment}
        {segment}
        {segment}
      </div>
    </div>
  );
}
