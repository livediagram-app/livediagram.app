import { elementHasText, elementKindLabel } from '@livediagram/diagram';
import { elementMenuAnchor } from '@/lib/context-menu-anchor';
import type { deriveCanvasSelection } from '@/lib/canvas-selection';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { FloatingToolbar } from '@/components/chrome/FloatingToolbar';
import { MultiSelectionToolbar } from '@/components/canvas/MultiSelectionToolbar';
import { SelectionPopover } from '@/components/canvas/SelectionPopover';

// The floating selection toolbars (spec/09): the single-selection popover
// and the marquee multi-selection toolbar, each riding a sibling wrapper
// that mirrors the canvas transform so they counter-scale with zoom and
// float over the selection. Extracted from Canvas as one cohesive layer —
// Canvas passes its props plus the derived selection view-model through.
export function CanvasSelectionToolbars({
  props,
  selection,
  quickRingOpen,
}: {
  props: CanvasProps;
  selection: ReturnType<typeof deriveCanvasSelection>;
  // A quick-connect ring owns the space around the element while open; the
  // popover fades out (kept mounted) so it animates away and back.
  quickRingOpen: boolean;
}) {
  const {
    selected,
    selectionScope,
    selectedIsGrouped,
    selectionBounds,
    selectedLocked,
    showPopover,
    multiToolbarBounds,
    showMultiToolbar,
  } = selection;
  const {
    elements,
    readOnly,
    canvasTool,
    viewportZoom,
    viewportOffset,
    multiSelectedIds,
    onDuplicateSelected,
    onUngroup,
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
          Diagram elements stay in the original wrapper at z-auto
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
            opacity: quickRingOpen ? 0 : 1,
            // Transition visibility too so it stays interactive through the
            // fade-out then goes non-interactive (hidden) at the end.
            visibility: quickRingOpen ? 'hidden' : 'visible',
            transition: 'opacity 150ms ease, visibility 150ms ease',
          }}
        >
          <SelectionPopover
            bounds={selectionBounds}
            canvasOffset={viewportOffset}
            zoom={viewportZoom}
            title={
              selectionScope === 'group'
                ? 'Selected Group'
                : selected
                  ? `Selected ${elementKindLabel(selected)}`
                  : 'Selected Element'
            }
            // In view-only mode we mount the popover with just
            // `onOpenComments`: visitors should be able to read +
            // post comments on a diagram they don't own, but no
            // other edit affordances apply. Every other handler
            // becomes undefined and the matching button drops out.
            locked={readOnly ? undefined : selectedLocked}
            // Edit text: only when the element already has a label to edit.
            // Enters inline edit mode on it (same path as double-click).
            onEditText={
              !readOnly && selected && elementHasText(selected)
                ? () => props.onBeginEdit(selected.id)
                : undefined
            }
            onDuplicate={readOnly ? undefined : selected ? onDuplicateSelected : undefined}
            // "Group with another" is intentionally absent from the
            // single-element toolbar: grouping needs a multi-selection,
            // so the action lives only on the marquee MultiSelectionToolbar.
            // Ungroup stays here so a selected group can be broken apart.
            onUngroup={!readOnly && selectedIsGrouped ? onUngroup : undefined}
            onToggleLock={readOnly ? undefined : onToggleLockSelected}
            onDelete={readOnly ? undefined : onDeleteSelected}
            // Comment button is VIEW-ROLE ONLY now. Editors reach
            // comments via the right-click / ellipsis context menu (which
            // is gated !isReadOnly), so the toolbar button was a
            // duplicate for them. View-role visitors get no context menu,
            // so the toolbar stays their only way into a thread.
            onOpenComments={readOnly && selected ? () => onOpenComments(selected.id) : undefined}
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
            compact={readOnly}
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
          }}
        >
          <FloatingToolbar
            bounds={multiToolbarBounds}
            canvasOffset={viewportOffset}
            zoom={viewportZoom}
            title={`Selected Elements (${multiSelectedIds.size})`}
          >
            <MultiSelectionToolbar
              anyLocked={elements.some((el) => multiSelectedIds.has(el.id) && el.locked === true)}
              allLocked={elements
                .filter((el) => multiSelectedIds.has(el.id))
                .every((el) => el.locked === true)}
              selectedElements={elements.filter((el) => multiSelectedIds.has(el.id))}
              onDuplicate={props.onDuplicateMultiSelected}
              onDelete={props.onDeleteMultiSelected}
              onGroup={props.onGroupMultiSelected}
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
