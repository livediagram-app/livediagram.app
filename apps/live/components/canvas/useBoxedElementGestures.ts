import { useRightClickRelease } from '@/hooks/canvas/useRightClickRelease';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { opensInlineLabelEditor, voteKeyOf } from '@livediagram/document';
import { elementMenuAnchor } from '@/lib/context-menu-anchor';
import { useLongPress } from '@/hooks/ui/useLongPress';
import { pressLedger } from '@/lib/double-press';
import { armPlainClick } from '@/lib/selection-click';
import type { BoxedElementViewProps } from './BoxedElementView.types';

// The boxed element's press / double-click / context-menu routing,
// lifted out of BoxedElementView: which gesture wins for this element
// kind and session state (dot-vote cast, shift multi-select toggle,
// drag, the plain click on a selected element, per-kind double-click actions, the beside-the-element context
// menu and its touch long-press twin). The view owns the wrapper node
// and mounts the returned handlers; every callback comes from its
// props unchanged.
export function useBoxedElementGestures({
  element,
  wrapperRef,
  isEditing,
  remotelyLocked,
  isAnnotation,
  isMultiSelected,
  isSelected,
  isPaintMode,
  vote,
  votableInVote,
  onCastVote,
  onShiftSelect,
  onPlainClick,
  onBeginDrag,
  onBeginEdit,
  onEditLink,
  onEditCode,
  onOpenNote,
  imageContext,
  onContextSelect,
}: Pick<
  BoxedElementViewProps,
  | 'element'
  | 'isEditing'
  | 'vote'
  | 'votableInVote'
  | 'onCastVote'
  | 'onShiftSelect'
  | 'onPlainClick'
  | 'onBeginDrag'
  | 'onBeginEdit'
  | 'onEditLink'
  | 'onEditCode'
  | 'onOpenNote'
  | 'imageContext'
  | 'onContextSelect'
> & {
  wrapperRef: RefObject<HTMLDivElement | null>;
  // Another participant holds this element selected (docs/specs/007-editor/live-app.md): block
  // select / drag / edit outright.
  remotelyLocked: boolean;
  isAnnotation: boolean;
  isMultiSelected: boolean;
  // Single-selection state, so a shift press on the selected element can
  // start the duplicate drag (docs/specs/008-canvas/shift-drag-duplicate.md) instead of only toggling.
  isSelected: boolean;
  // The format painter is armed: a press paints, so it never settles a click.
  isPaintMode: boolean;
}) {
  // The click rules (docs/specs/008-canvas/canvas-and-palette.md "Selection", "Marquee
  // box-select"): the host settles a plain click on a selected element (deselect it, or
  // select a multi-selection member alone), and reselects on a double-click's second press.
  // A selected table takes a click as a cell pick (TableCellView), never as a click on the table.
  const settlesClick = !isPaintMode && onPlainClick !== undefined && element.type !== 'table';
  const handleShapeDown = (e: ReactPointerEvent) => {
    if (isEditing) return;
    // Secondary / middle button: not a select, not a drag. The right button
    // belongs to the context-menu gesture (armed here, opened on release),
    // and the middle one to canvas pan — so we fall through WITHOUT
    // swallowing the press. Selecting on a right press also flashed the
    // selection popover while the button was still held, which is a left
    // click's job. PointerEvent.button is 0 for touch / pen contact, so
    // this only filters real mouse buttons.
    if (e.button !== 0) return;
    // Remotely locked: swallow the press so it neither starts a drag /
    // selection nor falls through to the canvas. The not-allowed cursor
    // + the remote-selector badge tell the user why nothing happened.
    if (remotelyLocked) {
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    // Dot-voting (docs/specs/012-collaboration/session-tools.md): while a vote is open, pressing a votable
    // element casts one of your dots instead of selecting / dragging it.
    // Non-votable elements (text / frame / arrow / …) still select, so
    // the facilitator can keep arranging the canvas.
    if (vote?.active && onCastVote && votableInVote) {
      // A Plan card element votes on its card (voteKeyOf).
      onCastVote(voteKeyOf(element));
      return;
    }
    // The double-press rule (docs/specs/008-canvas/arrow-bending.md): the second press of a
    // double-click never drags; the dblclick that follows edits. After the
    // vote branch, so two quick presses during a vote still cast two dots.
    const verdict = pressLedger.press({
      id: element.id,
      t: e.timeStamp,
      x: e.clientX,
      y: e.clientY,
      wasSelected: isSelected,
    });
    if (verdict.pairs) {
      // A path opens its edit mode on the pair itself: a double-tap brings no reliable dblclick
      // (docs/specs/023-draw-mode/path-tool.md "Editing").
      if (element.type === 'path') onBeginEdit(element.id);
      // A double-click's first click deselected the only selected element; its
      // second selects it again, as the editor opens.
      if (!isSelected && settlesClick) onPlainClick?.(element.id);
      return;
    }
    // Shift modifier: on an element that is NOT part of the selection it
    // stays the immediate selection toggle (add to the marquee set), the
    // convention every drawing tool uses. On an element that IS selected
    // (single selection or a multi-select member) the toggle is DEFERRED
    // so shift can also start the duplicate drag (docs/specs/008-canvas/shift-drag-duplicate.md): begin a
    // normal move drag now, and only if the pointer never travels (a
    // true shift-CLICK) apply the toggle on release. A real shift-drag
    // moves the selection and the drag's release duplicates it.
    if (e.shiftKey) {
      if (!(isSelected || isMultiSelected)) {
        onShiftSelect?.(element.id);
        return;
      }
      armPlainClick(e, () => onShiftSelect?.(element.id));
      onBeginDrag(element.id, 'move', e);
      return;
    }
    // A plain press selects and drags. Outside a multi-selection it selects
    // this element alone (the drag starter drops the set); on a member it
    // drags the whole set. On an element already selected, a release without
    // a drag is a click the host settles.
    if (isSelected && settlesClick) armPlainClick(e, () => onPlainClick?.(element.id));
    onBeginDrag(element.id, 'move', e);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditing) return;
    // Can't edit an element another participant holds.
    if (remotelyLocked) return;
    // Image elements double-click to open the image picker (swap /
    // upload). They have no inline label to edit, so the editor's
    // beginEdit branch doesn't apply. A single click stays the
    // selection / drag gesture so the user can move + resize the
    // placeholder freely without the picker popping up.
    if (element.type === 'image' && imageContext?.onOpenPicker) {
      imageContext.onOpenPicker(element.id);
      return;
    }
    // Tables edit per-cell (TableView handles the cell double-click),
    // so the element-level label editor never applies.
    if (element.type === 'table') return;
    // Neither a link card nor a video has an inline label — double-click
    // opens the link picker to set / change its URL (docs/specs/009-elements/link-cards.md, docs/specs/009-elements/youtube-video.md).
    if (element.type === 'link-card' || element.type === 'video') {
      onEditLink?.(element.id);
      return;
    }
    // An annotation has no inline label either — double-click opens its note
    // editor (docs/specs/009-elements/annotations.md). A single click just selects it now.
    if (isAnnotation) {
      onOpenNote?.(element.id);
      return;
    }
    // A code block has no inline label — double-click opens its edit
    // dialog (docs/specs/009-elements/code-block.md), the way a link card opens the link picker.
    if (element.type === 'shape' && element.shape === 'code-block') {
      onEditCode?.(element.id);
      return;
    }
    // The self-drawing data components (progress / rail / rating / charts /
    // checklist) draw their own content and have no editable text label, so
    // double-click never enters text-edit mode for them — it would pop an
    // empty, confusing editor. (beginEdit also guards this; belt-and-braces
    // so no entry point slips through.)
    if (element.type === 'shape' && !opensInlineLabelEditor(element.shape)) {
      return;
    }
    // Don't gate on isPaintMode here (the page-level beginEdit decides whether
    // edit can start; it rejects during format painter, and exits group mode).
    onBeginEdit(element.id);
  };

  // Open the context menu beside the element rather than under the cursor /
  // finger, so it never covers the thing you're editing. `elementMenuAnchor`
  // owns the top-right corner + flip-to-left + gap rule (shared with the
  // toolbar "More" button). Reads the live on-screen rect so zoom / scroll are
  // already baked in.
  const openContextMenuBesideElement = () => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) {
      onContextSelect(element.id, element.x, element.y);
      return;
    }
    const { x, y } = elementMenuAnchor(rect);
    onContextSelect(element.id, x, y);
  };

  // Right-click opens on release (see useRightClickRelease).
  //
  // Deliberately NOT gated on `remotelyLocked` any more: whether a locked
  // element has a menu now depends on who is asking (docs/specs/012-collaboration/facilitator.md — the
  // facilitator gets a one-item menu to free it), and this hook does not know
  // that. The host's `onElementContextMenu` owns the decision and still
  // refuses for everybody else, so nothing changed for them. `onContextSelect`
  // calls `onSelect` on the way through, which the lock already no-ops.
  const rightClick = useRightClickRelease(() => {
    if (isEditing) return;
    openContextMenuBesideElement();
  });

  const handlePointerUp = rightClick.onPointerUp;

  const handleContextMenu = (e: React.MouseEvent) => {
    // While editing the label, right-click surfaces the browser's native
    // TEXT context menu (cut / copy / paste / select all) so it acts on the
    // text being edited. We stop propagation — otherwise the canvas's own
    // onContextMenu hijacks the right-click and opens the tab / element menu
    // instead — but deliberately do NOT preventDefault, so the native menu
    // still opens.
    if (isEditing) {
      e.stopPropagation();
      return;
    }
    rightClick.onContextMenu(e);
  };

  // Touch long-press is the phone / tablet equivalent of right-click: it
  // opens the element's context menu (touch never fires `contextmenu`). Same
  // guards as handleContextMenu; a press that moves becomes a drag instead.
  const longPress = useLongPress(() => {
    if (isEditing) return;
    openContextMenuBesideElement();
  });

  return { handleShapeDown, handleDoubleClick, handleContextMenu, handlePointerUp, longPress };
}
