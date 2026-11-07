import type { Element } from '@livehuddle/document';
import { DuplicateIcon, EllipsisIcon, TrashIcon, HoverCard, Glyph } from '@livehuddle/ui';
import { buildFilterGroups, SelectionFilterMenu } from '@/components/canvas/SelectionFilterMenu';
import { TurnButtons } from '@liveworkspace/workbench/components/canvas/TurnButtons';
import { TOOLBAR_BTN } from '@liveworkspace/workbench/components/canvas/toolbar-buttons';

type MultiSelectionToolbarProps = {
  // The elements in the multi-selection — drives the Filter Selection menu's
  // per-kind buckets.
  selectedElements: Element[];
  onDuplicate: () => void;
  onDelete: () => void;
  // Narrows the selection to one kind (Filter Selection menu). Omitted for
  // view-role, where the selection can't be edited.
  onFilter?: (ids: Set<string>) => void;
  // Opens the Export dialog scoped to just the selected elements.
  onExport: () => void;
  // Opens the selection-wide context menu (anchored under the ⋯ button).
  // Omitted for view-role, where there's no context menu.
  onOpenContextMenu?: (screenX: number, screenY: number) => void;
  // A quarter turn of each piece of furniture in the selection, about its own centre
  // (docs/specs/009-elements/furniture-facing.md "Several pieces at once"). Passed when the selection holds a piece
  // that turns.
  onTurn?: (quarters: 1 | -1) => void;
};

// The marquee multi-selection action buttons. Rendered bare (no shell) so the
// caller can host them in a FloatingToolbar that floats over the selection
// with a title; the shell + count live there.
export function MultiSelectionToolbar({
  selectedElements,
  onDuplicate,
  onDelete,
  onFilter,
  onExport,
  onOpenContextMenu,
  onTurn,
}: MultiSelectionToolbarProps) {
  // SelectionFilterMenu renders nothing for a single-kind selection, so its
  // trailing divider must share the SAME predicate — gating on `onFilter`
  // alone leaves a stray divider when the funnel button self-hides.
  const filterable = !!onFilter && buildFilterGroups(selectedElements).length >= 2;
  return (
    <>
      {onOpenContextMenu ? (
        <>
          <HoverCard title="More" description="Open the selection menu.">
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
              <EllipsisIcon size={14} />
            </button>
          </HoverCard>
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
      {onTurn ? (
        <>
          <TurnButtons onTurn={onTurn} plural size="compact" />
          <span aria-hidden className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
        </>
      ) : null}
      <HoverCard title="Duplicate" description="Duplicate the selection, arrows included.">
        <button
          type="button"
          onClick={onDuplicate}
          aria-label="Duplicate selected elements"
          className={TOOLBAR_BTN}
        >
          <DuplicateIcon size={14} />
        </button>
      </HoverCard>
      {/* Duplicate copies the selection; everything after acts ON it
          (export, then delete); the divider marks that boundary, same as
          the one after More above. */}
      <span aria-hidden className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
      <HoverCard title="Export" description="Export just these elements.">
        <button
          type="button"
          onClick={onExport}
          aria-label="Export selected elements"
          className={TOOLBAR_BTN}
        >
          <ExportIcon />
        </button>
      </HoverCard>
      <span aria-hidden className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
      <HoverCard title="Delete" description="Delete the selection (arrows too).">
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete selected elements"
          className={TOOLBAR_BTN}
        >
          <TrashIcon size={14} />
        </button>
      </HoverCard>
    </>
  );
}

function ExportIcon() {
  return (
    <Glyph size={14} units={16}>
      <path d="M8 2v8" />
      <path d="M5 6.5 8 10l3-3.5" />
      <path d="M2.75 11.5v1.25a1 1 0 0 0 1 1h8.5a1 1 0 0 0 1-1V11.5" />
    </Glyph>
  );
}
