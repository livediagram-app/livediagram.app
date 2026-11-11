// One row of the Explorer's sidebar (./Sidebar): its tile, label, count, fold chevron and menu, the rename field,
// and the drop target it is for a dragged item. Re-exported from ./Sidebar.
import type { DragEvent, MouseEvent, ReactNode } from 'react';
import type { Folder } from '@liveworkspace/index-client';
import { useDropTarget, useFolderDrag, type DropPlace, type LocalDropPlace } from '../drag/drag';
import { CountBadge } from '@liveworkspace/ui';
import { DROP_TARGET_RING } from '../ui/classes';
import { TreeChevronIcon } from '../ui/icons';

type Tone = 'sky' | 'violet' | 'amber' | 'emerald' | 'indigo' | 'rose' | 'teal';

const TONES: Record<Tone, string> = {
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300',
  // This Browser's, as its pill (THIS_BROWSER_TONE): no app's accent and no status colour.
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300',
};
// liveplanner's current row and tile are violet, its brand; here they are each app's brand.
const TILE_CURRENT = 'bg-brand-600 text-white dark:bg-brand-500';
const TILE = 'grid size-6 shrink-0 place-items-center rounded-lg [&>svg]:block [&>svg]:size-3.5';
const CURRENT =
  'border-brand-200 bg-white shadow-[0_6px_18px_-8px_color-mix(in_srgb,var(--color-brand-600)_35%,transparent)] dark:border-transparent dark:bg-transparent dark:bg-gradient-to-r dark:from-brand-400/[0.18] dark:to-brand-400/[0.04] dark:shadow-none dark:ring-1 dark:ring-inset dark:ring-brand-400/35';
const RESTING = 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800';
const INDENT_STEP = 16;
export const SIDEBAR_RENAME_FIELD =
  'min-w-0 flex-1 rounded border border-brand-300 bg-white px-1 py-0 text-sm dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100';

/** Which sidebar row is being renamed in place (only one, and only here: the pane's rows rename their own). */
export type SidebarRename = {
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
};

export function SidebarRow({
  icon,
  tone,
  label,
  selected,
  onActivate,
  depth,
  badge,
  badgeLabel,
  badgeTone = 'neutral',
  expandable = false,
  expanded = false,
  onToggleExpand,
  dropTo = null,
  dragFolder = null,
  shownLabel,
  marker,
  rowClassName = '',
  rowHandlers,
  trailing,
  onContextMenu,
  renaming = null,
  children,
}: {
  icon: ReactNode;
  tone?: Tone;
  label: string;
  selected: boolean;
  onActivate: () => void;
  depth: number;
  // A count, or its capped words ("99+").
  badge?: number | string;
  // What the count means, for a screen reader ("3 new"); the count alone when unset.
  badgeLabel?: string;
  badgeTone?: 'neutral' | 'brand';
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  // The place a dragged item dropped here lands in (a folder, My Work, a team); a closed row opens under a resting
  // drag.
  dropTo?: DropPlace | LocalDropPlace | null;
  // The folder this row is, which drags to the Trash.
  dragFolder?: Folder | null;
  // What the row says, when it says more than its name (the Trash mid-drag); the name stays its accessible name.
  shownLabel?: ReactNode;
  // Drawn after the name (a default folder's marker).
  marker?: ReactNode;
  rowClassName?: string;
  rowHandlers?: Partial<
    Record<'onDragEnter' | 'onDragOver' | 'onDragLeave' | 'onDrop', (e: DragEvent) => void>
  >;
  // After the label: the row's ⋯.
  trailing?: ReactNode;
  // The row's menu, from a right-click or Shift+F10 on the row.
  onContextMenu?: (e: MouseEvent) => void;
  // The rename field in place of the label; the row neither drags nor goes anywhere while it shows.
  renaming?: ReactNode;
  children?: ReactNode;
}) {
  const drop = useDropTarget(renaming ? null : dropTo, {
    onLongHover: expandable && !expanded ? onToggleExpand : undefined,
  });
  const drag = useFolderDrag(renaming ? null : dragFolder);
  return (
    <li
      role="treeitem"
      aria-label={badge !== undefined ? `${label} (${badgeLabel ?? badge})` : label}
      aria-level={depth + 1}
      aria-selected={selected}
      aria-expanded={expandable ? expanded : undefined}
      aria-current={selected ? 'page' : undefined}
      data-tree-label={label}
      // The tree keeps one row tabbable (useTreeNavigation); every other is reached with the arrows.
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
        data-drop-over={drop.over || undefined}
        className={`group flex items-center gap-1 rounded-xl border px-1 transition [li:focus-visible>&]:ring-2 [li:focus-visible>&]:ring-brand-500 ${selected ? CURRENT : RESTING} ${
          drop.over ? DROP_TARGET_RING : ''
        } ${rowClassName}`}
        style={{ paddingLeft: depth * INDENT_STEP + 4 }}
        {...drop.handlers}
        {...rowHandlers}
        {...drag}
      >
        {expandable ? (
          // A real control: a click (or Enter on it once focused) folds or opens the row; the tree's Left and
          // Right do the same from the keyboard.
          <button
            type="button"
            tabIndex={-1}
            data-tree-toggle
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
            aria-expanded={expanded}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand?.();
            }}
            // On a touch screen the chevron is a 44 px disclosure at the row's end, the row's full height.
            className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 outline-none transition hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-brand-500 pointer-coarse:order-last pointer-coarse:-mr-1 pointer-coarse:h-auto pointer-coarse:w-11 pointer-coarse:self-stretch dark:hover:text-slate-200"
          >
            <TreeChevronIcon open={expanded} />
          </button>
        ) : (
          <span aria-hidden className="h-5 w-5 shrink-0 pointer-coarse:hidden" />
        )}
        {renaming ? (
          <span
            className={`flex min-w-0 flex-1 items-center gap-2.5 text-sm leading-5 pointer-coarse:text-[15px] ${
              tone ? 'py-1.5 pointer-coarse:py-2.5' : 'py-2 pointer-coarse:py-3'
            }`}
          >
            <span className="shrink-0 text-slate-400 pointer-coarse:[&_svg]:size-[17px]">
              {icon}
            </span>
            {renaming}
          </span>
        ) : (
          <button
            type="button"
            tabIndex={-1}
            data-tree-activate
            onClick={onActivate}
            className={`flex min-w-0 flex-1 items-center gap-2.5 rounded text-left text-sm leading-5 outline-none pointer-coarse:text-[15px] ${
              tone ? 'py-1.5 pointer-coarse:py-2.5' : 'py-2 pointer-coarse:py-3'
            } ${
              selected
                ? 'font-semibold text-brand-900 dark:text-white'
                : 'font-medium text-slate-700 dark:text-slate-200'
            }`}
          >
            {tone ? (
              <span className={`${TILE} ${selected ? TILE_CURRENT : TONES[tone]}`}>{icon}</span>
            ) : (
              <span
                className={`shrink-0 pointer-coarse:[&_svg]:size-[17px] ${selected ? 'text-brand-600 dark:text-brand-300' : 'text-slate-400'}`}
              >
                {icon}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate">{shownLabel ?? label}</span>
            {marker}
            {badge !== undefined ? (
              <CountBadge tone={badgeTone} className="ml-1">
                {badge}
              </CountBadge>
            ) : null}
          </button>
        )}
        {trailing}
      </div>
      {expandable && expanded && children ? <ul role="group">{children}</ul> : null}
    </li>
  );
}
