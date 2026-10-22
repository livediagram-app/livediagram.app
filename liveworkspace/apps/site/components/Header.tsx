import { SiteSwitcher } from '@livediagram/ui';
import { Wordmark } from './Wordmark';

const NAV: { href: string; label: string; phone?: boolean }[] = [
  { href: '/#apps', label: 'Apps' },
  // Left out on a phone, where the wordmark and two links fill the bar.
  { href: '/#how-it-fits', label: 'How it fits', phone: false },
  { href: '/telemetry', label: 'Telemetry' },
];

// The header on every page (liveworkspace/docs/site.md "The pages"): the wordmark, whose hover lists
// every site (liveworkspace/docs/site-switcher.md), and three links. No sign-in link: an account only
// means something inside an app, which sends people to /sign-in itself.
export function Header() {
  return (
    <header className="sticky top-0 z-50 h-16 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/80">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
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
              className={`relative touch-target-y rounded-md px-2.5 py-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white ${
                item.phone === false ? 'max-sm:hidden' : ''
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
