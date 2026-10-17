'use client';

import { useId, type HTMLAttributes, type ReactNode } from 'react';
import { CountBadge } from '@livediagram/ui';
import { TreeChevronIcon } from '@/components/primitives/explorer-icons';
import { DROP_TARGET_RING } from '@/components/panels/useDocumentDropTarget';
import {
  SIDEBAR_CURRENT,
  SIDEBAR_RESTING,
  SIDEBAR_TILE,
  SIDEBAR_TILE_CURRENT,
  SIDEBAR_TONES,
  type SidebarTone,
} from './sidebar-tones';

// One sidebar row (docs/specs/013-workspace/explorer-structure.md): a `treeitem` whose own line
// is [indent][chevron gutter][icon][label][badge][trailing], with its child
// rows in a `group` beneath while expanded. The gutter is reserved on every
// row, so every icon at a level sits on one column whether or not its row
// can expand. On a touch screen the chevron moves to the row's end instead
// and no row reserves a gutter, so the icons sit under the group's title. A row with a `tone` carries its icon on a
// tinted tile, and the current row is a raised pill (explorer-structure.md "Look"). Keyboard handling lives on the sidebar's `nav`
// (useTreeNavigation), which finds the parts by their data attributes.

// Indent per tree level.
const INDENT_STEP = 16;

export function SidebarRow({
  icon,
  tone,
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
  description,
  rowProps,
  highlighted = false,
  className,
  children,
}: {
  icon: ReactNode;
  // The tile's tone, for a top-level Overview or Spaces row; without one the icon stands bare.
  tone?: SidebarTone;
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
  // A sentence a screen reader hears after the name (the Local only pill's meaning).
  description?: string;
  // Extra handlers on the row's own line: a drag source, a drop target.
  rowProps?: HTMLAttributes<HTMLDivElement>;
  // Ringed while something is dragged over it.
  highlighted?: boolean;
  // Classes on the treeitem itself (the panel's slide-out when a row is deleted).
  className?: string;
  children?: ReactNode;
}) {
  const descriptionId = useId();
  return (
    <li
      role="treeitem"
      aria-label={badge !== undefined ? `${textLabel} (${badge})` : textLabel}
      aria-level={depth + 1}
      aria-selected={selected}
      aria-expanded={expandable ? expanded : undefined}
      aria-describedby={description ? descriptionId : undefined}
      data-tree-label={textLabel}
      tabIndex={-1}
      className={`outline-none${className ? ` ${className}` : ''}`}
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
      {description ? (
        <span id={descriptionId} className="sr-only">
          {description}
        </span>
      ) : null}
      {/* On a touch screen the row is 44px tall (touch-targets.md) and its chevron is a 44px disclosure
          at the row's end, the row's full height, so a thumb lands on the row it means and no empty gutter
          pushes the icons in; its words and icon read at a phone list's size (15px, 17px). */}
      <div
        data-tree-row
        {...rowProps}
        className={`group flex items-center gap-1 rounded-xl border px-1 transition-colors [li:focus-visible>&]:ring-2 [li:focus-visible>&]:ring-brand-500 ${
          highlighted ? `${DROP_TARGET_RING} ` : ''
        }${selected ? SIDEBAR_CURRENT : SIDEBAR_RESTING}`}
        style={{ paddingLeft: depth * INDENT_STEP + 4 }}
      >
        <span
          data-tree-toggle
          aria-hidden
          onClick={(e) => {
            e.stopPropagation();
            if (expandable) onToggleExpand?.();
          }}
          className={`flex h-5 w-5 shrink-0 items-center justify-center text-slate-400 transition pointer-coarse:order-last pointer-coarse:-mr-1 pointer-coarse:h-auto pointer-coarse:w-11 pointer-coarse:self-stretch ${
            expandable
              ? 'cursor-pointer hover:text-slate-700 dark:hover:text-slate-200'
              : 'pointer-coarse:hidden'
          }`}
        >
          {expandable ? <TreeChevronIcon open={expanded} /> : null}
        </span>
        <span
          data-tree-activate
          onClick={renaming ? undefined : onActivate}
          className={`flex min-w-0 flex-1 items-center gap-2.5 text-left text-sm leading-5 pointer-coarse:text-[15px] ${
            tone ? 'py-1.5 pointer-coarse:py-2.5' : 'py-2 pointer-coarse:py-3'
          } ${renaming ? '' : 'cursor-pointer'} ${
            selected
              ? 'font-semibold text-sky-900 dark:text-white'
              : 'font-medium text-slate-700 dark:text-slate-200'
          }`}
        >
          {tone ? (
            <span
              data-sidebar-tile={tone}
              className={`${SIDEBAR_TILE} ${selected ? SIDEBAR_TILE_CURRENT : SIDEBAR_TONES[tone]}`}
            >
              {icon}
            </span>
          ) : (
            <span
              className={`shrink-0 pointer-coarse:[&_svg]:size-[17px] ${
                selected ? 'text-sky-600 dark:text-sky-300' : 'text-slate-400'
              }`}
            >
              {icon}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {badge !== undefined ? <CountBadge count={badge} className="ml-1" /> : null}
        </span>
        {trailing}
      </div>
      {expandable && expanded && children ? <ul role="group">{children}</ul> : null}
    </li>
  );
}
