import type { ComponentType, ReactNode } from 'react';

// The breadcrumb trail shared by the marketing site and the help centre: a
// home-icon root, chevron separators, and truncating labels.
//
// Only the TRAIL lives here, not the bar around it. The two surfaces genuinely
// differ on the container — help's is sticky under a 64px header and emits its
// own BreadcrumbList JSON-LD inline, marketing's is a plain bar with the
// structured data emitted separately — and folding those differences into one
// component would mean a prop per difference. What was actually duplicated is
// the part below: two hand-written SVGs and the map that renders the trail,
// copied into both apps down to the class strings.
//
// The link element is a prop rather than a fixed tag because the two apps
// disagree there too: the help centre routes with next/link, marketing uses
// plain anchors. Rendering the trail is the shared part; how a link navigates
// is the app's call.

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type LinkLike = ComponentType<{ href: string; className?: string; children?: ReactNode }>;

const AnchorLink: LinkLike = ({ href, className, children }) => (
  <a href={href} className={className}>
    {children}
  </a>
);

const HomeIcon = (
  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1"
    />
  </svg>
);

const ChevronIcon = (
  <svg
    className="h-3.5 w-3.5 shrink-0 text-slate-300"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

/**
 * The root link plus one span per item, as a fragment: the caller supplies the
 * `<nav>` (and whatever bar wraps it), so each app keeps its own width,
 * padding, stickiness and structured data.
 *
 * An item without an `href` renders as plain text, which is how the last crumb
 * — the page you are already on — is meant to be passed.
 */
export function BreadcrumbTrail({
  items,
  rootLabel,
  rootHref = '/',
  linkComponent: Link = AnchorLink,
}: {
  items: BreadcrumbItem[];
  rootLabel: string;
  rootHref?: string;
  linkComponent?: LinkLike;
}) {
  return (
    <>
      <Link
        href={rootHref}
        className="flex shrink-0 items-center gap-1.5 transition-colors hover:text-slate-900"
      >
        {HomeIcon}
        {rootLabel}
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex min-w-0 items-center gap-2">
          {ChevronIcon}
          {item.href ? (
            <Link href={item.href} className="truncate transition-colors hover:text-slate-900">
              {item.label}
            </Link>
          ) : (
            <span className="truncate text-slate-700">{item.label}</span>
          )}
        </span>
      ))}
    </>
  );
}
