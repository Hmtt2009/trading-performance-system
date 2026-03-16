'use client';

import { TradeList } from '@/components/trades/TradeList';
import { AuthGuard } from '@/components/auth/AuthGuard';

export default function TradesPage() {
  return (
    <AuthGuard>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <TradeList />
      </div>
    </AuthGuard>
  );
}
