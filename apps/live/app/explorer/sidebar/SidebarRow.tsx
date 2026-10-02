'use client';

// The Explorer sidebar row primitives (docs/specs/013-workspace/folders.md): one row, the
// section label and the search glyph. The folder subtrees build on SidebarRow.

import { CountBadge } from '@/components/primitives/CountBadge';
import { TreeChevronIcon } from '@/components/primitives/explorer-icons';
import { Glyph } from '@livediagram/ui';

// Indent step per tree level. Matches the Windows Explorer visual
// of a chevron + folder glyph + name with each child nudged in.
const INDENT_STEP = 16;

export function SearchSidebarIcon() {
  return (
    <Glyph size={14} units={16} strokeLinejoin="miter">
      <circle cx="7" cy="7" r="4" />
      <path d="M10 10l3.5 3.5" />
    </Glyph>
  );
}

export function SidebarSectionLabel({
  children,
  first,
  action,
}: {
  children: React.ReactNode;
  // `first` skips the inter-section gap on the topmost label so the
  // sidebar box has matching breathing room above the first label and
  // below the last row. Without this the top reads as too padded.
  first?: boolean;
  // Optional right-aligned control on the label row (e.g. the Teams
  // section's new-team plus, docs/specs/013-workspace/teams.md) so section-level actions don't
  // need their own row.
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-between px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${
        first ? '' : 'mt-5 pt-1'
      }`}
    >
      <span>{children}</span>
      {action ?? null}
    </div>
  );
}

// One sidebar row. Re-used for the "Recent", "All documents", and
// "Shared with me" special entries. Folder rows wrap this via
// SidebarFolderSubtree so they get chevron + recursive rendering.
export function SidebarRow({
  icon,
  label,
  selected,
  onClick,
  depth,
  badge,
  hasChildren,
  expanded,
  onToggleExpand,
  trailing,
  renaming,
  onContextMenu,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  depth: number;
  badge?: number;
  hasChildren?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  trailing?: React.ReactNode;
  // When true, the label area renders as a plain div instead of a
  // <button>, so a child <input> (e.g. inline rename) can take focus
  // without the parent button intercepting it. An input nested inside
  // a button is invalid HTML and browsers steal the input's focus.
  renaming?: boolean;
  // Right-click on the row, for rows that carry an actions menu.
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const labelClass = `flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left text-xs ${
    selected
      ? 'font-semibold text-brand-700 dark:text-brand-300'
      : 'text-slate-700 dark:text-slate-200'
  }`;
  const labelInner = (
    <>
      <span className="shrink-0 text-slate-400">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge !== undefined ? <CountBadge count={badge} className="ml-1" /> : null}
    </>
  );
  return (
    <div
      className={`group flex items-center gap-1 rounded-md px-1 ${selected ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}
      style={{ paddingLeft: depth * INDENT_STEP + 4 }}
      onContextMenu={onContextMenu}
    >
      <button
        type="button"
        onClick={onToggleExpand}
        aria-label={expanded ? 'Collapse' : 'Expand'}
        className={`flex h-5 w-5 shrink-0 items-center justify-center text-slate-400 transition ${
          hasChildren ? 'hover:text-slate-700 dark:hover:text-slate-200' : 'invisible'
        }`}
        disabled={!hasChildren || !onToggleExpand}
      >
        {hasChildren ? <TreeChevronIcon open={!!expanded} /> : null}
      </button>
      {renaming ? (
        <div className={labelClass}>{labelInner}</div>
      ) : (
        <button type="button" onClick={onClick} className={labelClass}>
          {labelInner}
        </button>
      )}
      {trailing}
    </div>
  );
}
