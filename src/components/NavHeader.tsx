'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const navLinks = [
  {
    href: '/dashboard',
    label: 'Dash',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm9 0a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1V4zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm9 0a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-3z" />
      </svg>
    ),
  },
  {
    href: '/trades',
    label: 'Trades',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href: '/upload',
    label: 'Upload',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    href: '/analysis',
    label: 'Analysis',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
  {
    href: '/analysis/weekly',
    label: 'Weekly',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
      </svg>
    ),
  },
];

export function NavHeader() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Sign out failed — redirect to login regardless
    }
    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="fixed top-9 left-0 bottom-0 w-16 z-40 bg-surface border-r border-border flex flex-col items-center py-4 gap-1">
      {/* Logo */}
      <Link
        href="/"
        className="flex items-center justify-center w-10 h-10 mb-4 rounded bg-green/10 text-green font-display text-xl tracking-wider hover:bg-green/20 transition-colors"
      >
        T
      </Link>

      {/* Nav links */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        {navLinks.map((link) => {
          const isActive =
            pathname === link.href ||
            (link.href !== '/analysis' && pathname?.startsWith(link.href + '/')) ||
            (link.href === '/analysis' && pathname === '/analysis');
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`relative flex flex-col items-center justify-center w-12 h-12 rounded transition-colors group ${
                isActive
                  ? 'text-green bg-green/8'
                  : 'text-muted hover:text-foreground hover:bg-card-hover'
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-green" />
              )}
              {link.icon}
              <span className="text-[9px] mt-0.5 font-medium tracking-wide">
                {link.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Profile link */}
      <Link
        href="/profile"
        className={`flex flex-col items-center justify-center w-12 h-12 rounded transition-colors group mb-1 ${
          pathname === '/profile'
            ? 'text-green bg-green/8'
            : 'text-muted hover:text-foreground hover:bg-card-hover'
        }`}
        title="Profile"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
        </svg>
        <span className="text-[9px] mt-0.5 font-medium tracking-wide">Profile</span>
      </Link>

      {/* Logout button */}
      <button
        onClick={handleLogout}
        className="flex flex-col items-center justify-center w-12 h-12 rounded text-muted hover:text-red transition-colors group mb-1"
        title="Sign out"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
          <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
        </svg>
        <span className="text-[9px] mt-0.5 font-medium tracking-wide">
          Out
        </span>
      </button>

      {/* Live dot */}
      <div className="relative w-2 h-2 rounded-full bg-green pulse-ring mb-2" />
    </aside>
  );
}
