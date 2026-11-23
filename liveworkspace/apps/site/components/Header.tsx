import { AccountControl } from './AccountControl';
import { HeaderLogo } from './HeaderLogo';
import { HeaderMenus } from './HeaderMenus';
import { SiteRail } from './SiteRail';
import { Wordmark } from './Wordmark';

// The header on every page (liveworkspace/docs/specs/010-site/site.md "The header"): the wordmark, whose hover lists
// every site (liveworkspace/docs/specs/010-site/site-switcher.md), the Product and Support menus (HeaderMenus, left out
// below 768px where the footer lists them), and Sign in or the account menu, always on the bar. The sign-in pages leave the account control out: they are the sign-in, and under an app's address
// they wear that app's logo (HeaderLogo).
//
// Light / Dark / System is never in the bar: it is on the rail at the page's right edge (SiteRail),
// with the Share card above it on the home page (`share`).
export function Header({ account = true, share = false }: { account?: boolean; share?: boolean }) {
  return (
    <>
      <header className="sticky top-0 z-50 h-16 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/80">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <HeaderLogo appAware={!account}>
            <a
              href="/"
              aria-label="liveworkspace home"
              className="relative touch-target-y inline-flex items-center"
            >
              <Wordmark />
            </a>
          </HeaderLogo>
          <nav aria-label="Sections" className="flex items-center gap-1 text-sm font-medium">
            <HeaderMenus />
            {account && <AccountControl />}
          </nav>
        </div>
      </header>
      <SiteRail share={share} />
    </>
  );
}
