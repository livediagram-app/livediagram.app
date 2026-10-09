import { useCallback } from 'react';
import { useCommentBadges } from './CommentBadgesContext';
import { useViewportOf } from '@/hooks/canvas/useViewportStore';
import type { View } from '@/lib/viewport-store';
import {
  elementHasText,
  elementKindLabel,
  elementSupportsText,
  isBoxed,
  isCompoundPath,
  isMindNode,
} from '@livediagram/document';
import { elementMenuAnchor } from '@/lib/context-menu-anchor';
import {
  useCanvasSelectionView,
  type CanvasSelectionInput,
} from '@/hooks/canvas/useCanvasSelectionView';
import { useSelectionOf } from '@/hooks/canvas/useSelectionStore';
import type { Selection } from '@/lib/selection-store';
import { selectionMoving, useCanvasGesture } from '@/lib/canvas-gesture';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { FloatingToolbar } from '@/components/chrome/FloatingToolbar';
import { MultiSelectionToolbar } from '@/components/canvas/MultiSelectionToolbar';
import { SelectionPopover } from '@/components/canvas/SelectionPopover';
import { useInsertionSlot } from '@/lib/insertion-preview';

// The floating selection toolbars (docs/specs/008-canvas/canvas-and-palette.md): the single-selection popover
// and the marquee multi-selection toolbar, each riding a sibling wrapper
// that mirrors the canvas transform so they counter-scale with zoom and
// float over the selection. Extracted from Canvas as one cohesive layer —
// What the toolbars read while nothing is selected: never drawn, so any fixed view will do.
const RESTING_VIEW: View = { zoom: 1, offset: { x: 0, y: 0 } };
const multiOf = (s: Selection) => s.multiSelectedIds;

// Canvas passes its props and what the selection is derived from; the toolbars read the selection
// from the store, so a selection change re-renders them and not the canvas.
export function CanvasSelectionToolbars({
  props,
  selectionInput,
  quickRingOpen,
}: {
  props: CanvasProps;
  selectionInput: CanvasSelectionInput;
  // A quick-connect ring owns the space around the element while open; the
  // popover fades out (kept mounted) so it animates away and back.
  quickRingOpen: boolean;
}) {
  const {
    selected,
    selectionBounds,
    selectedLocked,
    showPopover,
    showPlus,
    multiToolbarBounds,
    showMultiToolbar,
  } = useCanvasSelectionView(selectionInput);
  const multiSelectedIds = useSelectionOf(multiOf);
  // The toolbars mirror the canvas transform, so they follow the view, but only while they show:
  // with nothing selected a zoom renders none of this (docs/specs/008-canvas/blueprints/viewport-store.md).
  const showing = selected !== null || showMultiToolbar;
  const { zoom: viewportZoom, offset: viewportOffset } = useViewportOf(
    useCallback((v: View) => (showing ? v : RESTING_VIEW), [showing]),
  );
  // Insert-between preview (docs/specs/021-event-storming/event-storming.md): the toolbars anchor to element BOUNDS,
  // and the preview slides elements by a render-time transform their bounds
  // know nothing about — so while a slot is open they would float over empty
  // canvas. They fade out the same way they do for a quick-connect ring, and
  // come back the moment the drag ends.
  const insertionOpen = useInsertionSlot() !== null;
  const commentsShown = useCommentBadges();
  // While a selection is moved, resized or reshaped the toolbars stand down and stop measuring
  // (docs/specs/008-canvas/canvas-performance.md); they come back at the new place when it ends.
  const moving = selectionMoving(useCanvasGesture());
  const toolbarsStale = quickRingOpen || insertionOpen || moving;
  const multiStale = insertionOpen || moving;
  const {
    elements,
    readOnly,
    canvasTool,
    onDuplicateSelected,
    onToggleLockSelected,
    onDeleteSelected,
    onOpenComments,
    onOpenElementContextMenu,
    onOpenMultiContextMenu,
  } = props;
  return (
    <>
      {/* SelectionPopover rides on a sibling wrapper that mirrors
          the canvas transform but lives AFTER the floating panels in
          DOM order. z-[var(--z-overlay)] on every viewport: lifts the toolbar
          above panels (Palette, Explorer, Activity, Zoom /
          ZoomControls, the TabBar footer) so it
          stays visible whether the selected element sits near a
          panel-pinned corner on desktop OR overlaps the bottom
          dock on mobile. The previous mobile-only z-[var(--z-canvas)] was an
          older design choice that hid the toolbar behind chrome,
          which made multi-select edit ops awkward on a phone.
          Canvas elements stay in the original wrapper at z-auto
          and continue to be visually covered by panels where they
          overlap. */}
      {/* Hide the selection toolbar while a quick-connect ring is open — its
          options own the space around the element, and a toolbar on top just
          competes for clicks. Kept mounted and faded out (not unmounted) so
          it animates away as the ring opens and back in when it closes. */}
      {showPopover && selectionBounds && canvasTool !== 'spotlight' ? (
        <div
          className="pointer-events-none absolute inset-0 z-[var(--z-overlay)] origin-center"
          style={{
            transform: `scale(${viewportZoom}) translate(${viewportOffset.x}px, ${viewportOffset.y}px)`,
            opacity: toolbarsStale ? 0 : 1,
            // Transition visibility too so it stays interactive through the
            // fade-out then goes non-interactive (hidden) at the end.
            visibility: toolbarsStale ? 'hidden' : 'visible',
            transition:
              'opacity var(--transition-duration-micro) ease, visibility var(--transition-duration-micro) ease',
          }}
        >
          <SelectionPopover
            bounds={selectionBounds}
            canvasOffset={viewportOffset}
            zoom={viewportZoom}
            suspended={moving}
            title={selected ? `Selected ${elementKindLabel(selected)}` : 'Selected Element'}
            // In view-only mode we mount the popover with just
            // `onOpenComments`: visitors should be able to read +
            // post comments on a document they don't own, but no
            // other edit affordances apply. Every other handler
            // becomes undefined and the matching button drops out.
            locked={readOnly ? undefined : selectedLocked}
            // Edit text: on every text-CAPABLE element, even before it has
            // a label — an empty shape's "Add text" button teaches that
            // text can be added. Enters inline edit mode (same path as
            // double-click); kinds with no label carry no button.
            onEditText={
              !readOnly && selected && elementSupportsText(selected)
                ? () => props.onBeginEdit(selected.id)
                : undefined
            }
            hasText={selected ? elementHasText(selected) : false}
            // A path's points (docs/specs/023-draw-mode/path-tool.md "Editing"): its edit mode, the
            // Path tool put down first when it is still in hand.
            onEditPoints={
              // A combined shape edits as a whole (docs/specs/007-editor/logo-pages.md "Combine").
              !readOnly && !selectedLocked && selected?.type === 'path' && !isCompoundPath(selected)
                ? () => {
                    if (props.pendingDraw) props.onCancelDraw();
                    props.onBeginEdit(selected.id);
                  }
                : undefined
            }
            // Mind map (docs/specs/009-elements/mind-node.md): Add child / Add sibling, the toolbar home
            // for Tab / Enter. Not on a locked node: growing re-lays the map.
            {...(!readOnly && !selectedLocked && selected && isMindNode(selected)
              ? {
                  onAddMindChild: () => props.onGrowMindNode(selected.id, 'child'),
                  onAddMindSibling: () => props.onGrowMindNode(selected.id, 'sibling'),
                }
              : {})}
            onDuplicate={readOnly ? undefined : selected ? onDuplicateSelected : undefined}
            // Intra-layer z-order (docs/specs/006-document/layers.md): stack within the element's own
            // band. The element menu's Bring to Front moves LAYERS; these
            // are the missing nudge for two things on the same one.
            onBringToFront={readOnly || !selected ? undefined : props.onBringSelectedToFront}
            onSendToBack={readOnly || !selected ? undefined : props.onSendSelectedToBack}
            onToggleLock={readOnly ? undefined : onToggleLockSelected}
            onDelete={readOnly ? undefined : onDeleteSelected}
            // Comment button is VIEW-ROLE ONLY now. Editors reach
            // comments via the right-click / ellipsis context menu (which
            // is gated !isReadOnly), so the toolbar button was a
            // duplicate for them. View-role visitors get no context menu,
            // so the toolbar stays their only way into a thread.
            // Not where the reader has no comments to open (an embed's viewer, a Community visitor).
            onOpenComments={
              readOnly && selected && commentsShown ? () => onOpenComments(selected.id) : undefined
            }
            onOpenContextMenu={
              readOnly
                ? undefined
                : selected && onOpenElementContextMenu
                  ? (x, y) => {
                      // Open from the element's top-right corner (same as a
                      // right-click, via elementMenuAnchor), NOT under the
                      // toolbar's ⋯ button, so the menu doesn't cover the
                      // element. Fall back to the button coords if the
                      // element node can't be found.
                      const rect = document
                        .querySelector(`[data-element-id="${selected.id}"]`)
                        ?.getBoundingClientRect();
                      const anchor = rect ? elementMenuAnchor(rect) : { x, y };
                      onOpenElementContextMenu(selected.id, anchor.x, anchor.y);
                    }
                  : undefined
            }
            // Close to the element whenever no "+" sits in the gap: read-only, and boxed kinds that show none (a
            // Plan board or card, an annotation, an event-storming board). An arrow keeps the wide gap: its move
            // frame sits there, and a toolbar over it would take the press that drags the arrow.
            compact={readOnly || (!showPlus && !!selected && isBoxed(selected))}
          />
        </div>
      ) : null}

      {/* Marquee multi-selection toolbar — floats over the selection's union
          bounds (above, or below when there's no room) instead of pinning to
          the top of the screen, mirroring the single-selection popover. Rides
          the same canvas-transform sibling wrapper so it counter-scales with
          zoom. Anchored on `multiToolbarBounds` (which spans arrows too) rather
          than the boxed-only resize box, so an arrow-only / mixed marquee still
          gets the toolbar — and its "More" entry into the Flow / animate menu.
          Gated on a true marquee multi-selection (2+), never in view-only. */}
      {showMultiToolbar && multiToolbarBounds && canvasTool !== 'spotlight' ? (
        <div
          className="pointer-events-none absolute inset-0 z-[var(--z-overlay)] origin-center"
          style={{
            transform: `scale(${viewportZoom}) translate(${viewportOffset.x}px, ${viewportOffset.y}px)`,
            opacity: multiStale ? 0 : 1,
            visibility: multiStale ? 'hidden' : 'visible',
            transition:
              'opacity var(--transition-duration-micro) ease, visibility var(--transition-duration-micro) ease',
          }}
        >
          <FloatingToolbar
            bounds={multiToolbarBounds}
            canvasOffset={viewportOffset}
            zoom={viewportZoom}
            suspended={moving}
            title={`Selected Elements (${multiSelectedIds.size})`}
          >
            <MultiSelectionToolbar
              anyLocked={elements.some((el) => multiSelectedIds.has(el.id) && el.locked === true)}
              allLocked={elements
                .filter((el) => multiSelectedIds.has(el.id))
                .every((el) => el.locked === true)}
              selectedElements={elements.filter((el) => multiSelectedIds.has(el.id))}
              onDuplicate={props.onDuplicateMultiSelected}
              onCombine={!readOnly && props.canCombine?.() ? props.onCombine : undefined}
              onDelete={props.onDeleteMultiSelected}
              onToggleLock={props.onToggleLockMultiSelected}
              onFilter={readOnly ? undefined : props.onFilterMultiSelected}
              onExport={props.onExportMultiSelected}
              onOpenContextMenu={readOnly ? undefined : onOpenMultiContextMenu}
            />
          </FloatingToolbar>
        </div>
      ) : null}
    </>
  );
}
