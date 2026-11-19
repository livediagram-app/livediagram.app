import { BrandGlyph, WorkspaceWordmark } from '@liveworkspace/brand';
import { APP_ORDER, helpUrl } from '@liveworkspace/help-registry';
import { PLATFORM_SITE, TERMS_LABEL } from '@liveworkspace/sites';
import { SITE_FOOTER_LINK, STATUS_PAGE_URL } from '@liveworkspace/ui';

// The All Apps help's footer: liveworkspace's logo and line, every app's help, and the platform's own pages, as
// liveworkspace.app's footer lists them (liveworkspace/apps/site components/Footer.tsx).
const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Platform',
    links: [
      { href: `${PLATFORM_SITE.url}/compare`, label: 'Comparison' },
      { href: `${PLATFORM_SITE.url}/community`, label: 'Community' },
      { href: `${PLATFORM_SITE.url}/telemetry`, label: 'Telemetry' },
      { href: STATUS_PAGE_URL, label: 'Status' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: `${PLATFORM_SITE.url}/privacy`, label: 'Privacy Policy' },
      { href: `${PLATFORM_SITE.url}/terms`, label: TERMS_LABEL },
      { href: '/help/policies/report-a-vulnerability/', label: 'Report a Vulnerability' },
      { href: '/help/contact/', label: 'Contact' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-[2fr_1fr_1fr_1fr] md:px-8">
        <div>
          <WorkspaceWordmark />
          <p className="mt-3 max-w-xs text-sm text-slate-500 dark:text-slate-400">
            Live collaborative apps for every kind of work in a single platform.
          </p>
        </div>
        <nav aria-label="Help for each app">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-900 dark:text-slate-100">
            Help for Each App
          </h2>
          <ul className="mt-3 flex flex-col items-start gap-2 text-sm pointer-coarse:mt-0.5 pointer-coarse:gap-0">
            {APP_ORDER.map((app) => (
              <li key={app}>
                <a href={`${helpUrl(app)}/`} className={`${SITE_FOOTER_LINK} inline-flex items-center gap-2`}>
                  <BrandGlyph className="size-3.5 text-slate-400" />
                  {app}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-900 dark:text-slate-100">
              {c.title}
            </h2>
            <ul className="mt-3 flex flex-col items-start gap-2 text-sm pointer-coarse:mt-0.5 pointer-coarse:gap-0">
              {c.links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className={SITE_FOOTER_LINK}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
