import { lucideGlyph, SiteSwitcher } from '@livediagram/ui';
import { lucideChartLine, lucideLayoutGrid } from '@livediagram/icons/lucide';
import type { ReactNode } from 'react';
import { AccountControl } from './AccountControl';
import { SiteRail } from './SiteRail';
import { Wordmark } from './Wordmark';

// Left out on a phone, where the wordmark and the account control fill the bar; the footer lists them
// all.
const AppsIcon = lucideGlyph(lucideLayoutGrid, 16);
const TelemetryIcon = lucideGlyph(lucideChartLine, 16);

const NAV: { href: string; label: string; icon: ReactNode }[] = [
  { href: '/#apps', label: 'Our Apps', icon: <AppsIcon /> },
  { href: '/telemetry', label: 'Telemetry', icon: <TelemetryIcon /> },
];

// The header on every page (liveworkspace/docs/site.md "The header"): the wordmark, whose hover lists
// every site (liveworkspace/docs/site-switcher.md), two links, each with its icon, and Sign in or the
// account menu. The sign-in pages leave the account control out: they are the sign-in.
//
// Light / Dark / System is never in the bar: it is on the rail at the page's right edge (SiteRail),
// with the Share card above it on the home page (`share`).
export function Header({ account = true, share = false }: { account?: boolean; share?: boolean }) {
  return (
    <>
      <header className="sticky top-0 z-50 h-16 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/80">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <SiteSwitcher current="liveworkspace.app">
            <a href="/" aria-label="liveworkspace home" className="relative touch-target-y">
              <Wordmark />
            </a>
          </SiteSwitcher>
          <nav aria-label="Sections" className="flex items-center gap-1 text-sm font-medium">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="relative touch-target-y inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 max-sm:hidden dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <span className="text-slate-400 dark:text-slate-500">{item.icon}</span>
                {item.label}
              </a>
            ))}
            {account && <AccountControl />}
          </nav>
        </div>
      </header>
      <SiteRail share={share} />
    </>
  );
}
