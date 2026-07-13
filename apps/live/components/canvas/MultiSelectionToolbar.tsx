import type { Element } from '@livediagram/diagram';
import { Tooltip } from '@/components/primitives/Tooltip';
import { buildFilterGroups, SelectionFilterMenu } from '@/components/canvas/SelectionFilterMenu';
import { GroupIcon } from '@/components/canvas/selection-popover-icons';

// Shared styling for the toolbar's plain icon buttons (More / Duplicate / Group
// / Export). Lock (active brand fill) and Delete (rose / disabled) compose
// their own variants, so they're not on this.
const TOOLBAR_BTN =
  'flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';

type MultiSelectionToolbarProps = {
  // True if at least one member of the multi-selection is locked. The
  // Lock button toggles them all to the inverse state — if anything is
  // unlocked, the click locks everything; otherwise it unlocks.
  anyLocked: boolean;
  // True when EVERY member is locked. Delete protects locked members and
  // removes the rest, so it only goes fully dead when nothing's deletable.
  allLocked: boolean;
  // The elements in the multi-selection — drives the Filter Selection menu's
  // per-kind buckets.
  selectedElements: Element[];
  onDuplicate: () => void;
  onDelete: () => void;
  onGroup: () => void;
  onToggleLock: () => void;
  // Narrows the selection to one kind (Filter Selection menu). Omitted for
  // view-role, where the selection can't be edited.
  onFilter?: (ids: Set<string>) => void;
  // Opens the Export dialog scoped to just the selected elements.
  onExport: () => void;
  // Opens the selection-wide context menu (anchored under the ⋯ button).
  // Omitted for view-role, where there's no context menu.
  onOpenContextMenu?: (screenX: number, screenY: number) => void;
};

// The marquee multi-selection action buttons. Rendered bare (no shell) so the
// caller can host them in a FloatingToolbar that floats over the selection
// with a title; the shell + count live there.
export function MultiSelectionToolbar({
  anyLocked,
  allLocked,
  selectedElements,
  onDuplicate,
  onDelete,
  onGroup,
  onToggleLock,
  onFilter,
  onExport,
  onOpenContextMenu,
}: MultiSelectionToolbarProps) {
  // SelectionFilterMenu renders nothing for a single-kind selection, so its
  // trailing divider must share the SAME predicate — gating on `onFilter`
  // alone leaves a stray divider when the funnel button self-hides.
  const filterable = !!onFilter && buildFilterGroups(selectedElements).length >= 2;
  return (
    <>
      {onOpenContextMenu ? (
        <>
          <Tooltip title="More" description="Open the selection menu.">
            <button
              type="button"
              data-context-menu-trigger
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                onOpenContextMenu(r.left, r.bottom);
              }}
              aria-label="More actions"
              className={TOOLBAR_BTN}
            >
              <EllipsisIcon />
            </button>
          </Tooltip>
          <span aria-hidden className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
        </>
      ) : null}
      {filterable && onFilter ? (
        <>
          <SelectionFilterMenu selectedElements={selectedElements} onFilter={onFilter} />
          {/* Filter narrows WHAT is selected; everything after acts on the
              selection — the divider marks that boundary. */}
          <span aria-hidden className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
        </>
      ) : null}
      <Tooltip title="Duplicate" description="Duplicate the selection, arrows included.">
        <button
          type="button"
          onClick={onDuplicate}
          aria-label="Duplicate selected elements"
          className={TOOLBAR_BTN}
        >
          <DuplicateIcon />
        </button>
      </Tooltip>
      {/* Duplicate copies the selection; everything after acts ON it
          (group / lock / export / delete) — the divider marks that
          boundary, same as the one after More above. */}
      <span aria-hidden className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
      <Tooltip title="Group" description="Bind so they move and lock together.">
        <button
          type="button"
          onClick={onGroup}
          aria-label="Group selected elements"
          className={TOOLBAR_BTN}
        >
          <GroupIcon size={14} />
        </button>
      </Tooltip>
      <Tooltip
        title={anyLocked ? 'Unlock' : 'Lock'}
        description={anyLocked ? 'Unlock so they move again.' : "Lock so they can't move."}
      >
        <button
          type="button"
          onClick={onToggleLock}
          aria-label={anyLocked ? 'Unlock selected elements' : 'Lock selected elements'}
          aria-pressed={anyLocked}
          className={
            anyLocked
              ? 'flex h-7 w-7 items-center justify-center rounded-md bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
              : 'flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900'
          }
        >
          <LockIcon closed={anyLocked} />
        </button>
      </Tooltip>
      <Tooltip title="Export" description="Export just these elements.">
        <button
          type="button"
          onClick={onExport}
          aria-label="Export selected elements"
          className={TOOLBAR_BTN}
        >
          <ExportIcon />
        </button>
      </Tooltip>
      <span aria-hidden className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
      <Tooltip
        title="Delete"
        description={
          allLocked ? 'All locked. Unlock to delete.' : 'Delete selected (locked ones are kept).'
        }
      >
        <button
          type="button"
          onClick={onDelete}
          disabled={allLocked}
          aria-label="Delete selected elements"
          className={
            allLocked
              ? 'flex h-7 w-7 items-center justify-center rounded-md text-slate-300 dark:text-slate-400'
              : 'flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-rose-50 hover:text-rose-700 dark:text-slate-300 dark:hover:bg-rose-500/15 dark:hover:text-rose-300'
          }
        >
          <TrashIcon />
        </button>
      </Tooltip>
    </>
  );
}

function EllipsisIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <circle cx="3.5" cy="8" r="1.3" fill="currentColor" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
      <circle cx="12.5" cy="8" r="1.3" fill="currentColor" />
    </svg>
  );
}

function DuplicateIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="8" height="8" rx="1.5" />
      <path d="M5.5 13.5h6a1.5 1.5 0 0 0 1.5-1.5v-6" />
    </svg>
  );
}

function LockIcon({ closed }: { closed: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="7.5" width="10" height="6.5" rx="1.25" />
      {closed ? (
        <path d="M5.25 7.5V5a2.75 2.75 0 0 1 5.5 0v2.5" />
      ) : (
        <path d="M5.25 7.5V5a2.75 2.75 0 0 1 5.4-.7" />
      )}
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2v8" />
      <path d="M5 6.5 8 10l3-3.5" />
      <path d="M2.75 11.5v1.25a1 1 0 0 0 1 1h8.5a1 1 0 0 0 1-1V11.5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 4h11" />
      <path d="M6 4V2.75A.75.75 0 0 1 6.75 2h2.5a.75.75 0 0 1 .75.75V4" />
      <path d="M4 4l.7 9.1a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4" />
      <path d="M6.5 7v4M9.5 7v4" />
    </svg>
  );
}
