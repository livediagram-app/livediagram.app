'use client';

import { useId, type ReactNode } from 'react';
import {
  SIDEBAR_GROUP_TITLES,
  type SidebarDivider,
  type SidebarGroupId,
} from './sidebar-structure';

// One sidebar group (docs/specs/013-workspace/explorer-structure.md): its title, or under
// Minimal chrome a hairline above it with the title kept as visually hidden
// text, then its `tree`. `after` holds a non-row item that follows the tree
// inside the group (the guest's sign-in nudge).
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
  const titles = divider === 'titles';
  return (
    <section>
      {!titles && !first ? (
        <div
          data-sidebar-separator
          aria-hidden
          className="mx-2 my-3 h-px bg-slate-200 dark:bg-slate-700"
        />
      ) : null}
      <h2
        id={titleId}
        className={
          titles
            ? `px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${first ? '' : 'mt-5 pt-1'}`
            : 'sr-only'
        }
      >
        {SIDEBAR_GROUP_TITLES[id]}
      </h2>
      <ul role="tree" aria-labelledby={titleId}>
        {children}
      </ul>
      {after}
    </section>
  );
}
