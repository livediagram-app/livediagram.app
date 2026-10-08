import { lucideBookOpen, lucidePenTool, lucideSparkles } from '@livediagram/icons/lucide';

import { Brand } from './Brand';
import { CommunityFooterLink } from './community/CommunityFooterLink';
import { CONTRIBUTORS } from './contributors';
import { Glyph } from './icons/Glyph';
import { lucideGlyph } from './icons/lucide-glyph';
import { REPO_URL } from './site';

// The public site footer shared by the marketing landing page, the help centre, the telemetry dashboard and the
// Community. Brand + tagline on top, the site links grouped into titled columns below, and a thin legal/credits
// strip at the bottom crediting the human contributors by their avatars. Only the key links carry an icon (the
// first action, AI, help and the source); the rest stay plain text so the columns read quietly.
const LINK = 'inline-flex items-center gap-2 hover:text-slate-900 dark:hover:text-slate-100';
const ICON_SIZE = 16;

type FooterLink = { href: string; label: string; icon?: ReturnType<typeof lucideGlyph> };

const COMMUNITY = 'community';
const GITHUB = 'github';

const COLUMNS: { title: string; links: (FooterLink | typeof COMMUNITY | typeof GITHUB)[] }[] = [
  {
    title: 'Product',
    links: [
      { href: '/new', label: 'New Document', icon: lucideGlyph(lucidePenTool, ICON_SIZE) },
      {
        href: '/features/diagrams#build-diagrams-with-ai',
        label: 'AI & MCP',
        icon: lucideGlyph(lucideSparkles, ICON_SIZE),
      },
      { href: '/alternatives', label: 'Product Comparison' },
      // The public gallery of shared documents (docs/specs/025-community/community.md), unless switched off.
      COMMUNITY,
      { href: '/faq', label: 'FAQ' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '/help/', label: 'Help Centre', icon: lucideGlyph(lucideBookOpen, ICON_SIZE) },
      { href: '/help/about/what-is-livediagram/', label: 'About' },
      { href: '/status', label: 'Status' },
      { href: '/telemetry', label: 'Telemetry' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/help/policies/terms/', label: 'Terms' },
      { href: '/help/policies/privacy-policy/', label: 'Privacy Policy' },
      { href: '/help/privacy-and-security/', label: 'Data & Security' },
      // Vulnerability disclosure (docs/specs/002-project-scope/vulnerability-disclosure.md).
      { href: '/help/policies/report-a-vulnerability/', label: 'Report a Vulnerability' },
      // Third-party licences (docs/specs/002-project-scope/third-party-licences.md).
      { href: '/licences', label: 'Licences' },
    ],
  },
  {
    title: 'Connect',
    links: [{ href: '/help/contact/', label: 'Contact' }, GITHUB],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div>
          <Brand size="sm" />
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Free diagrams, whiteboards and pages for teams who think together.
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
              <div className="mt-3 flex flex-col items-start gap-2">
                {column.links.map((link) => {
                  if (link === COMMUNITY)
                    return <CommunityFooterLink key={link} className={LINK} />;
                  if (link === GITHUB)
                    return (
                      <a
                        key={link}
                        href={REPO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={LINK}
                      >
                        <GitHubIcon />
                        GitHub
                      </a>
                    );
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
            <span>&copy; {new Date().getFullYear()} livediagram. MIT licensed.</span>
          </p>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              Built by
              <span className="inline-flex items-center gap-x-2.5">
                {CONTRIBUTORS.map((c) => (
                  <a
                    key={c.login}
                    href={`https://github.com/${c.login}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-200"
                  >
                    {/* Decorative: the name beside it carries the link's meaning. */}
                    <img
                      src={c.avatar}
                      alt=""
                      width={20}
                      height={20}
                      className="size-5 rounded-full ring-1 ring-slate-200 dark:ring-slate-700"
                    />
                    {c.name}
                  </a>
                ))}
              </span>
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}

function GitHubIcon() {
  return (
    <Glyph size={ICON_SIZE} units={24} filled>
      <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.335-5.467-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.605-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.298 24 12c0-6.627-5.373-12-12-12z" />
    </Glyph>
  );
}
