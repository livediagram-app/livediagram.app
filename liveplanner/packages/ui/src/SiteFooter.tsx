import { lucideBookOpen, lucideSparkles, lucideSquareKanban } from '@liveworkspace/icons/lucide';
import { PLATFORM_SITE } from '@liveworkspace/sites';

import { Brand } from './Brand';
import { lucideGlyph } from '@liveworkspace/ui';

// NEXT_PUBLIC_BUILD_YEAR (docs/specs/016-platform/nextjs.md "One configuration"); empty outside a Next build.
const buildYear = () => process.env.NEXT_PUBLIC_BUILD_YEAR ?? '';

// The public site footer shared by the marketing landing page, the help centre and the telemetry dashboard.
// Brand + tagline on top, the site links grouped into titled columns below, and a thin copyright strip at
// the bottom. Only the key links carry an icon (the first action, AI and help); the rest stay plain text so
// the columns read quietly.
// On a touch screen each link is a 44px-tall row (touch-targets.md) and the column drops its gap, so
// the rows abut and every tap lands on a link; a mouse keeps the compact 28px rhythm.
const LINK =
  'inline-flex items-center gap-2 hover:text-slate-900 pointer-coarse:py-3 dark:hover:text-slate-100';
const ICON_SIZE = 16;

type FooterLink = { href: string; label: string; icon?: ReturnType<typeof lucideGlyph> };

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Product',
    links: [
      { href: '/new', label: 'New Plan', icon: lucideGlyph(lucideSquareKanban, ICON_SIZE) },
      {
        href: '/ai',
        label: 'AI & MCP',
        icon: lucideGlyph(lucideSparkles, ICON_SIZE),
      },
      // This app's own comparisons (packages/comparisons/README.md).
      { href: '/alternatives', label: 'Comparison' },
      { href: '/faq', label: 'FAQ' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '/help/', label: 'Help Centre', icon: lucideGlyph(lucideBookOpen, ICON_SIZE) },
      { href: '/help/about/what-is-liveplanner/', label: 'About' },
      { href: '/status', label: 'Status' },
      { href: '/telemetry', label: 'Telemetry' },
    ],
  },
  {
    title: 'Legal',
    links: [
      // The Terms and Privacy Policy are liveworkspace's and cover every app (docs/specs/018-help/help-app.md).
      { href: `${PLATFORM_SITE.url}/terms`, label: 'Terms' },
      { href: `${PLATFORM_SITE.url}/privacy`, label: 'Privacy Policy' },
      { href: '/help/privacy-and-security/', label: 'Data & Security' },
      // Vulnerability disclosure (docs/specs/002-project-scope/vulnerability-disclosure.md).
      { href: '/help/policies/report-a-vulnerability/', label: 'Report a Vulnerability' },
      // Third-party licences (docs/specs/002-project-scope/third-party-licences.md).
      { href: '/licences', label: 'Licences' },
    ],
  },
  {
    title: 'Connect',
    links: [{ href: '/help/contact/', label: 'Contact' }],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div>
          <Brand href="/" size="lg" className="relative touch-target-y" />
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Free planning for teams who work together, live.
          </p>
        </div>
        <nav
          aria-label="Footer"
          className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 text-sm text-slate-500 sm:grid-cols-4 dark:text-slate-400"
        >
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-900 dark:text-slate-100">
                {column.title}
              </h2>
              <div className="mt-3 flex flex-col items-start gap-2 pointer-coarse:mt-0.5 pointer-coarse:gap-0">
                {column.links.map((link) => {
                  const Icon = link.icon;
                  return (
                    <a key={link.href} href={link.href} className={LINK}>
                      {Icon && <Icon />}
                      {link.label}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
      <div className="border-t border-slate-100 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-1.5 px-6 py-4 text-xs text-slate-500 sm:flex-row dark:text-slate-400 sm:items-center sm:justify-between">
          <p>
            {/* The build's year, inlined at build (@liveworkspace/next-config), never the clock: the prerender and
                the browser render the same text whatever the date. */}
            <span>{`© ${buildYear() ? `${buildYear()} ` : ''}liveplanner. MIT licensed.`}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
