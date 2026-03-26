'use client';

const ROWS = [
  {
    feature: 'Behavioral pattern detection',
    flinch: 'Automatic — 4 patterns',
    tradezella: 'Manual tagging only',
    tradervue: 'Manual tagging only',
  },
  {
    feature: 'Dollar cost per pattern',
    flinch: 'Exact dollar amount',
    tradezella: 'No',
    tradervue: 'No',
  },
  {
    feature: 'Setup required',
    flinch: 'Upload CSV, done',
    tradezella: 'Manual journal entries',
    tradervue: 'Manual journal entries',
  },
  {
    feature: 'AI coaching debrief',
    flinch: 'Per-session AI analysis',
    tradezella: 'No',
    tradervue: 'No',
  },
  {
    feature: 'Time to first insight',
    flinch: '30 seconds',
    tradezella: 'Days (manual input)',
    tradervue: 'Days (manual input)',
  },
  {
    feature: 'Weekly behavior tracking',
    flinch: 'Automatic week-over-week',
    tradezella: 'Manual',
    tradervue: 'Manual',
  },
  {
    feature: 'Price',
    flinch: 'Free tier + $29/mo',
    tradezella: '$49/mo',
    tradervue: '$49/mo',
  },
];

export function ComparisonTable() {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left py-4 px-4 font-[family-name:var(--font-space-mono)] text-xs text-[#6b7280] uppercase tracking-wider border-b border-[#1c1c22]">
              Feature
            </th>
            <th className="text-center py-4 px-4 font-[family-name:var(--font-bebas-neue)] text-xl text-[#00e87a] tracking-wider border-b border-[#00e87a]/30 bg-[#00e87a]/5">
              Flinch
            </th>
            <th className="text-center py-4 px-4 font-[family-name:var(--font-space-mono)] text-xs text-[#6b7280] uppercase tracking-wider border-b border-[#1c1c22]">
              TradeZella
            </th>
            <th className="text-center py-4 px-4 font-[family-name:var(--font-space-mono)] text-xs text-[#6b7280] uppercase tracking-wider border-b border-[#1c1c22]">
              TraderVue
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, i) => (
            <tr
              key={row.feature}
              className={`${i % 2 === 0 ? 'bg-[#0d0d12]/50' : ''} hover:bg-[#0d0d12] transition-colors`}
            >
              <td className="py-3 px-4 font-[family-name:var(--font-space-mono)] text-sm text-[#f4f4f5] border-b border-[#1c1c22]/50">
                {row.feature}
              </td>
              <td className="py-3 px-4 text-center border-b border-[#00e87a]/10 bg-[#00e87a]/5">
                <span className="font-[family-name:var(--font-space-mono)] text-sm text-[#00e87a] font-bold">
                  {row.flinch}
                </span>
              </td>
              <td className="py-3 px-4 text-center font-[family-name:var(--font-space-mono)] text-sm text-[#6b7280] border-b border-[#1c1c22]/50">
                {row.tradezella}
              </td>
              <td className="py-3 px-4 text-center font-[family-name:var(--font-space-mono)] text-sm text-[#6b7280] border-b border-[#1c1c22]/50">
                {row.tradervue}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
