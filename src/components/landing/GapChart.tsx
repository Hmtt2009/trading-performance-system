'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
  Label,
} from 'recharts';

// Mock equity curve data
const data = [
  { week: 'W1', actual: 500, potential: 500 },
  { week: 'W2', actual: 1200, potential: 1400 },
  { week: 'W3', actual: 800, potential: 1600 },
  { week: 'W4', actual: -200, potential: 1200 },
  { week: 'W5', actual: 400, potential: 1800 },
  { week: 'W6', actual: -600, potential: 1500 },
  { week: 'W7', actual: -100, potential: 2000 },
  { week: 'W8', actual: -1200, potential: 1700 },
  { week: 'W9', actual: -800, potential: 2100 },
  { week: 'W10', actual: -1800, potential: 1600 },
  { week: 'W11', actual: -1400, potential: 2000 },
  { week: 'W12', actual: -2400, potential: 1800 },
];

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-[#0d0d12] border border-[#1c1c22] rounded px-3 py-2 shadow-lg">
      <p className="font-[family-name:var(--font-space-mono)] text-xs text-[#6b7280] mb-1">
        {label}
      </p>
      {payload.map((entry) => (
        <p
          key={entry.dataKey}
          className="font-[family-name:var(--font-space-mono)] text-xs"
          style={{ color: entry.color }}
        >
          {entry.dataKey === 'actual' ? 'Actual' : 'Without Bad Habits'}:{' '}
          {entry.value >= 0 ? '+' : ''}${entry.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

export function GapChart() {
  return (
    <div className="w-full">
      <div className="relative w-full h-[300px] sm:h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 20, right: 20, left: 20, bottom: 10 }}
          >
            <defs>
              <linearGradient id="gapGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00e87a" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#00e87a" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1c1c22"
              vertical={false}
            />
            <XAxis
              dataKey="week"
              tick={{
                fill: '#6b7280',
                fontSize: 11,
                fontFamily: 'var(--font-space-mono)',
              }}
              axisLine={{ stroke: '#1c1c22' }}
              tickLine={false}
            />
            <YAxis
              tick={{
                fill: '#6b7280',
                fontSize: 11,
                fontFamily: 'var(--font-space-mono)',
              }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) =>
                `${v >= 0 ? '+' : ''}$${(v / 1000).toFixed(1)}k`
              }
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#1c1c22" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="potential"
              stroke="none"
              fill="url(#gapGradient)"
              fillOpacity={1}
            />
            <Line
              type="monotone"
              dataKey="potential"
              stroke="#00e87a"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              name="P&L Without Bad Habits"
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#f4f4f5"
              strokeWidth={2}
              dot={false}
              name="Your Actual P&L"
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Gap label annotation */}
        <div className="absolute top-8 right-8 sm:top-12 sm:right-16 max-w-[200px] text-right">
          <div className="inline-block bg-[#0d0d12]/90 border border-[#00e87a]/30 rounded px-3 py-2">
            <p className="font-[family-name:var(--font-bebas-neue)] text-2xl sm:text-3xl text-[#00e87a]">
              $4,200
            </p>
            <p className="font-[family-name:var(--font-space-mono)] text-[10px] sm:text-xs text-[#6b7280] leading-tight">
              the cost of your behavioral patterns
            </p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 mb-8">
        <div className="flex items-center gap-2">
          <div className="w-6 h-[2px] bg-[#f4f4f5]" />
          <span className="font-[family-name:var(--font-space-mono)] text-xs text-[#6b7280]">
            Your Actual P&amp;L
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-[2px] border-t-2 border-dashed border-[#00e87a]" />
          <span className="font-[family-name:var(--font-space-mono)] text-xs text-[#6b7280]">
            P&amp;L Without Bad Habits
          </span>
        </div>
      </div>
    </div>
  );
}
