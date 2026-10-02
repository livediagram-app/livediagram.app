'use client';

import type { ReactNode } from 'react';
import { CountBadge } from '@/components/primitives/CountBadge';
import { TreeChevronIcon } from '@/components/primitives/explorer-icons';

// One sidebar row (docs/specs/013-workspace/explorer-structure.md): a `treeitem` whose own line
// is [indent][chevron gutter][icon][label][badge][trailing], with its child
// rows in a `group` beneath while expanded. The gutter is reserved on every
// row, so every icon at a level sits on one column whether or not its row
// can expand. Keyboard handling lives on the sidebar's `nav`
// (useTreeNavigation), which finds the parts by their data attributes.

// Indent per tree level.
const INDENT_STEP = 16;

export function SidebarRow({
  icon,
  label,
  textLabel,
  selected,
  onActivate,
  depth,
  badge,
  expandable = false,
  expanded = false,
  onToggleExpand,
  trailing,
  renaming = false,
  onContextMenu,
  children,
}: {
  icon: ReactNode;
  label: ReactNode;
  // The row's name as plain text: its accessible name and its typeahead key.
  textLabel: string;
  selected: boolean;
  onActivate: () => void;
  // 0 for a top-level row; aria-level is one more.
  depth: number;
  badge?: number;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  trailing?: ReactNode;
  // While a child field (inline rename) holds focus, a click on the row is
  // the field's, not a navigation.
  renaming?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
  children?: ReactNode;
}) {
  return (
    <li
      role="treeitem"
      aria-label={badge !== undefined ? `${textLabel} (${badge})` : textLabel}
      aria-level={depth + 1}
      aria-selected={selected}
      aria-expanded={expandable ? expanded : undefined}
      data-tree-label={textLabel}
      tabIndex={-1}
      className="outline-none"
      onContextMenu={
        onContextMenu
          ? (e) => {
              // The nearest row's menu only, never an ancestor folder's too.
              e.stopPropagation();
              onContextMenu(e);
            }
          : undefined
      }
    >
      <div
        data-tree-row
        className={`group flex items-center gap-1 rounded-md px-1 [li:focus-visible>&]:ring-2 [li:focus-visible>&]:ring-brand-500 ${
          selected
            ? 'bg-brand-50 dark:bg-brand-500/15'
            : 'hover:bg-slate-100 dark:hover:bg-slate-700'
        }`}
        style={{ paddingLeft: depth * INDENT_STEP + 4 }}
      >
        <span
          data-tree-toggle
          aria-hidden
          onClick={(e) => {
            e.stopPropagation();
            if (expandable) onToggleExpand?.();
          }}
          className={`flex h-5 w-5 shrink-0 items-center justify-center text-slate-400 transition ${
            expandable ? 'cursor-pointer hover:text-slate-700 dark:hover:text-slate-200' : ''
          }`}
        >
          {expandable ? <TreeChevronIcon open={expanded} /> : null}
        </span>
        <span
          data-tree-activate
          onClick={renaming ? undefined : onActivate}
          className={`flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left text-xs ${
            renaming ? '' : 'cursor-pointer'
          } ${
            selected
              ? 'font-semibold text-brand-700 dark:text-brand-300'
              : 'text-slate-700 dark:text-slate-200'
          }`}
        >
          <span className="shrink-0 text-slate-400">{icon}</span>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {badge !== undefined ? <CountBadge count={badge} className="ml-1" /> : null}
        </span>
        {trailing}
      </div>
      {expandable && expanded && children ? <ul role="group">{children}</ul> : null}
    </li>
  );
}
