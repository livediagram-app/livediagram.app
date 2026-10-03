'use client';

// One of Home's sections (docs/specs/013-workspace/explorer-home.md "Layout"): its own wrapper and
// landmark, opened by a heading row with a rule under it (Headings with a rule) and, when the
// section has one, its quiet link at the row's end.

import type { ReactNode } from 'react';
import { FOCUS_RING, SECTION_HEADER, SECTION_HEADING, SECTION_LINK } from './home-styles';

/** A link that keeps its href (a new tab, a copied link) but navigates in the app on a plain click.
 *  `onActivate` runs on every click, the plain one included (telemetry). */
export function InAppLink({
  href,
  onNavigate,
  onActivate,
  className,
  children,
}: {
  href: string;
  onNavigate: () => void;
  onActivate?: () => void;
  className: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      onClick={(e) => {
        onActivate?.();
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onNavigate();
      }}
      className={className}
    >
      {children}
    </a>
  );
}

export function HomeSection({
  id,
  title,
  link,
  busy,
  children,
}: {
  /** `jump-back-in`, `what-happened`: the heading's id and the wrapper's data attribute. */
  id: string;
  title: string;
  link?: { href: string; label: string; onNavigate: () => void; onActivate?: () => void };
  busy: boolean;
  children: ReactNode;
}) {
  const headingId = `home-${id}`;
  return (
    <section aria-labelledby={headingId} aria-busy={busy} data-home-section={id}>
      <div className={`mb-3 ${SECTION_HEADER}`}>
        <h2 id={headingId} className={SECTION_HEADING}>
          {title}
        </h2>
        {link ? (
          <InAppLink
            href={link.href}
            onNavigate={link.onNavigate}
            onActivate={link.onActivate}
            className={`${SECTION_LINK} ${FOCUS_RING}`}
          >
            {link.label}
          </InAppLink>
        ) : null}
      </div>
      {children}
    </section>
  );
}
