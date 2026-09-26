'use client';

import type { MouseEvent, ReactNode } from 'react';
import { TreeChevronIcon } from '@/components/primitives/explorer-icons';
import { CountBadge } from '@/components/primitives/CountBadge';
import type { useDiagramDropTarget } from './useDiagramDropTarget';

// The header row of every expandable node in the floating Explorer panel's
// tree: real folders (personal and team), the teams themselves, and the
// synthetic Dynamic / Unsorted / Offline nodes. Chevron, glyph, name,
// optional count, then whatever the node trails (its ⋯ menu).
//
// Five components had each written this row out, and they had drifted:
// one chevron carried aria-expanded and another didn't, an empty team
// folder hid its chevron while an empty personal one kept it. This is the
// row once; the nodes differ only in what they pass.
export function TreeNodeHeader({
  depth,
  expanded,
  onToggle,
  noun,
  collapsible = true,
  icon,
  iconClassName = 'text-slate-400',
  label,
  labelClassName = '',
  count,
  onLabelClick,
  renameInput,
  drop,
  onContextMenu,
  trailing,
}: {
  // Tree depth, for the left indent. Omitted on the synthetic nodes,
  // which sit at the row's own padding.
  depth?: number;
  expanded: boolean;
  onToggle: () => void;
  // What the chevron's label names: "Expand folder", "Collapse team".
  noun: string;
  // False when there is nothing inside to reveal: the chevron hides, but
  // keeps its slot so the names still line up.
  collapsible?: boolean;
  icon: ReactNode;
  iconClassName?: string;
  label: ReactNode;
  labelClassName?: string;
  count?: number;
  // What a click on the name does. Defaults to toggling, like the chevron.
  onLabelClick?: () => void;
  // Shown in place of the name while it is being renamed. The name is a
  // <button>, and an input nested in one loses its focus to it.
  renameInput?: ReactNode;
  // Drop-target handlers (useDiagramDropTarget), for nodes a diagram can
  // be dragged into.
  drop?: ReturnType<typeof useDiagramDropTarget>;
  onContextMenu?: (e: MouseEvent) => void;
  trailing?: ReactNode;
}) {
  return (
    <div
      className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-slate-700 transition hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800 ${
        drop?.isDragOver ? 'ring-2 ring-brand-400 ring-inset bg-brand-50 dark:bg-brand-500/15' : ''
      }`}
      style={depth === undefined ? undefined : { paddingLeft: 4 + depth * 12 }}
      onDragOver={drop?.onDragOver}
      onDragLeave={drop?.onDragLeave}
      onDrop={drop?.onDrop}
      onContextMenu={onContextMenu}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={collapsible ? expanded : undefined}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${noun}`}
        disabled={!collapsible}
        className={`flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 ${
          collapsible ? '' : 'invisible'
        }`}
      >
        <TreeChevronIcon open={expanded} size={9} />
      </button>
      <span className={iconClassName} aria-hidden>
        {icon}
      </span>
      {renameInput ?? (
        <button
          type="button"
          onClick={onLabelClick ?? onToggle}
          className="flex min-w-0 flex-1 items-center gap-1 truncate text-left"
        >
          <span className={`truncate ${labelClassName}`}>{label}</span>
          {count === undefined ? null : <CountBadge count={count} />}
        </button>
      )}
      {trailing}
    </div>
  );
}
