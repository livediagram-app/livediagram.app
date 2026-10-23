import { SiteAppearanceToggle, SiteSwitcher } from '@livediagram/ui';
import { AccountControl } from './AccountControl';
import { Wordmark } from './Wordmark';

// Left out on a phone, where the wordmark, the Appearance toggle and the account control fill the
// bar; the footer lists them all.
const NAV: { href: string; label: string }[] = [
  { href: '/#apps', label: 'Our Apps' },
  { href: '/telemetry', label: 'Telemetry' },
];

// The header on every page (liveworkspace/docs/site.md "The header"): the wordmark, whose hover lists
// every site (liveworkspace/docs/site-switcher.md), three links, the
// Light / Dark / System toggle the apps' sites have, and Sign in or Sign out. The sign-in
// pages leave the account control out: they are the sign-in.
export function Header({ account = true }: { account?: boolean }) {
  return (
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
              className="relative touch-target-y rounded-md px-2.5 py-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 max-sm:hidden dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {item.label}
            </a>
          ))}
          <SiteAppearanceToggle />
          {account && <AccountControl />}
        </nav>
      </div>
    </header>
  );
}
