'use client';

import { usePathname } from 'next/navigation';
import { NavHeader } from '@/components/NavHeader';
import { TickerTape } from '@/components/TickerTape';

const AUTH_ROUTES = ['/login', '/signup', '/auth'];
const MARKETING_ROUTES = ['/pricing', '/about', '/guide'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));
  const isMarketingRoute = pathname === '/' || MARKETING_ROUTES.some((r) => pathname.startsWith(r));

  if (isAuthRoute || isMarketingRoute) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <>
      <TickerTape />
      <NavHeader />
      <main className="ml-16 pt-9 min-h-screen">{children}</main>
    </>
  );
}
