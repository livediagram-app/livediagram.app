'use client';

import { useId, type ReactNode } from 'react';
import {
  SIDEBAR_GROUP_TITLES,
  type SidebarDivider,
  type SidebarGroupId,
} from './sidebar-structure';

// One sidebar group (docs/specs/013-workspace/explorer-structure.md): its title, or under
// Minimal chrome a hairline in the title's place with the title kept as
// visually hidden text, then its `tree`. Below the first group both modes keep
// the same heading box, so flipping moves nothing there; the first group keeps
// no box at all under Minimal chrome, so nothing sits above Home. `after` holds a non-row item that
// follows the tree inside the group (the guest's sign-in nudge).
export function SidebarGroup({
  id,
  divider,
  first = false,
  after,
  children,
}: {
  id: SidebarGroupId;
  divider: SidebarDivider;
  first?: boolean;
  after?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const title = SIDEBAR_GROUP_TITLES[id];
  const titles = divider === 'titles';
  return (
    <section>
      {!titles && first ? (
        // No separator above the first group and no space kept for one: Home sits at the top.
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>
      ) : (
        <h2
          id={titleId}
          className={`relative box-content h-4 px-2 pb-2 text-[10px] font-semibold uppercase leading-4 tracking-wider text-slate-400 ${
            first ? '' : 'mt-5 pt-1'
          }`}
        >
          {titles ? title : <span className="sr-only">{title}</span>}
          {!titles ? (
            <span
              data-sidebar-separator
              aria-hidden
              className="absolute inset-x-2 top-1/2 h-px bg-slate-200 dark:bg-slate-700"
            />
          ) : null}
        </h2>
      )}
      <ul role="tree" aria-labelledby={titleId}>
        {children}
      </ul>
      {after}
    </section>
  );
}
