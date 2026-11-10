import { Brand, WorkspaceWordmark, type BrandApp } from '@liveworkspace/brand';
import { PLATFORM_SITE, TERMS_LABEL } from '@liveworkspace/sites';
import { explorerHomeHref } from '@liveworkspace/sites/workspace-proxy';
import { Fragment, type ReactNode } from 'react';

import { STATUS_PAGE_URL } from './status-page';

// NEXT_PUBLIC_BUILD_YEAR (docs/specs/016-platform/nextjs.md "One configuration"); empty outside a Next build.
const buildYear = () => process.env.NEXT_PUBLIC_BUILD_YEAR ?? '';

// The public site footer shared by the marketing landing page, the help centre, the telemetry dashboard and
// livediagram's Community. Brand + tagline on top, the site links grouped into titled columns below, and a thin legal
// strip at the bottom: the copyright and licence on the left, "Part of liveworkspace" on the right. Every link is plain text, no icon, so the
// columns read quietly.
// On a touch screen each link is a 44px-tall row (touch-targets.md) and the column drops its gap, so
// the rows abut and every tap lands on a link; a mouse keeps the compact 28px rhythm.
//
// Each product binds it (its SiteFooter): its app, its tagline, its first link's label, and what only some products
// carry: the Community link (`community`, drawn with SITE_FOOTER_LINK), the GitHub link (`repoUrl`), and the Build with AI link (`buildWithAi`), which
// livehuddle leaves out (it has no MCP server). The Explorer link, second under Product, opens the app's own
// Explorer Home (explorerHomeHref, the same href as the header's Explorer link).
export const SITE_FOOTER_LINK =
  'inline-flex items-center gap-2 hover:text-slate-900 pointer-coarse:py-3 dark:hover:text-slate-100';

const LINK = SITE_FOOTER_LINK;

type FooterLink = { href: string; label: string };

const COMMUNITY = 'community' as const;
const GITHUB = 'github' as const;

type Column = { title: string; links: (FooterLink | typeof COMMUNITY | typeof GITHUB)[] };

const columns = ({
  app,
  newLabel,
  community,
  repoUrl,
  buildWithAi,
}: Pick<
  SiteFooterProps,
  'app' | 'newLabel' | 'community' | 'repoUrl' | 'buildWithAi'
>): Column[] => [
  {
    title: 'Product',
    links: [
      { href: '/new', label: newLabel },
      // The app's own Explorer Home, on its own address (liveworkspace/docs/specs/004-index/one-explorer.md).
      { href: explorerHomeHref(app), label: 'Explorer' },
      ...(buildWithAi ? [{ href: '/ai', label: 'Build with AI' }] : []),
      // This app's own comparisons (packages/comparisons/README.md).
      { href: '/alternatives', label: 'Comparison' },
      // The public gallery of shared documents (livediagram's docs/specs/025-community/community.md), unless
      // switched off.
      ...(community ? [COMMUNITY] : []),
      { href: '/faq', label: 'FAQ' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '/help/', label: 'Help Centre' },
      { href: `/help/about/what-is-${app}/`, label: 'About' },
      // liveworkspace's one status page, for every app (liveworkspace/docs/specs/010-site/site.md "Status").
      { href: STATUS_PAGE_URL, label: 'Status' },
      { href: '/telemetry', label: 'Telemetry' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: `${PLATFORM_SITE.url}/terms`, label: TERMS_LABEL },
      { href: `${PLATFORM_SITE.url}/privacy`, label: 'Privacy Policy' },
      // Vulnerability disclosure (docs/specs/002-project-scope/vulnerability-disclosure.md).
      { href: '/help/policies/report-a-vulnerability/', label: 'Report a Vulnerability' },
      // Third-party licences (docs/specs/002-project-scope/third-party-licences.md).
      { href: '/licences', label: 'Licences' },
    ],
  },
  {
    title: 'Connect',
    links: [{ href: '/help/contact/', label: 'Contact' }, ...(repoUrl ? [GITHUB] : [])],
  },
];

export type SiteFooterProps = {
  // The product, for its logo, its About article and the copyright line.
  app: BrandApp;
  // The line under the logo.
  tagline: string;
  // The first link, /new: its label ("New Document").
  newLabel: string;
  // The Community link, drawn by the product (@liveworkspace/community-ui/links' CommunityFooterLink, with SITE_FOOTER_LINK).
  community?: ReactNode;
  // The source's GitHub link, last under Connect; none without it.
  repoUrl?: string;
  // The Build with AI link to the /ai page, for a product with an MCP server.
  buildWithAi?: boolean;
};

export function SiteFooter({
  app,
  tagline,
  newLabel,
  community,
  repoUrl,
  buildWithAi = true,
}: SiteFooterProps) {
  const COLUMNS = columns({ app, newLabel, community, repoUrl, buildWithAi });
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div>
          <Brand app={app} href="/" size="lg" className="relative touch-target-y" />
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{tagline}</p>
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
                  if (link === COMMUNITY) return <Fragment key={link}>{community}</Fragment>;
                  if (link === GITHUB)
                    return (
                      <a
                        key={link}
                        href={repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={LINK}
                      >
                        GitHub
                      </a>
                    );
                  return (
                    <a key={link.href} href={link.href} className={LINK}>
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
          {/* The build's year, inlined at build (@liveworkspace/next-config), never the clock: the prerender and
              the browser render the same text whatever the date. */}
          <p>{`© ${buildYear() ? `${buildYear()} ` : ''}${app}. MIT licensed.`}</p>
          {/* The platform the app belongs to (each product's marketing-site.md "Footer"), on the right. */}
          <p className="inline-flex items-center gap-1.5">
            Part of
            <a
              href={PLATFORM_SITE.url}
              aria-label="liveworkspace"
              className="relative touch-target-y inline-flex rounded-sm transition-opacity duration-micro hover:opacity-80"
            >
              <WorkspaceWordmark size="xs" />
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
