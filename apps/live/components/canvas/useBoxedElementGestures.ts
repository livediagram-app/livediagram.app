import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { isSelfDrawingShape, isVotable } from '@livediagram/diagram';
import { elementMenuAnchor } from '@/lib/context-menu-anchor';
import { useLongPress } from '@/hooks/ui/useLongPress';
import type { BoxedElementViewProps } from './BoxedElementView.types';

// The boxed element's press / double-click / context-menu routing,
// lifted out of BoxedElementView: which gesture wins for this element
// kind and session state (dot-vote cast, shift multi-select toggle,
// drag, per-kind double-click actions, the beside-the-element context
// menu and its touch long-press twin). The view owns the wrapper node
// and mounts the returned handlers; every callback comes from its
// props unchanged.
export function useBoxedElementGestures({
  element,
  wrapperRef,
  isEditing,
  remotelyLocked,
  isAnnotation,
  multiSelectActive,
  isMultiSelected,
  isSelected,
  vote,
  onCastVote,
  onShiftSelect,
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
  | 'onCastVote'
  | 'onShiftSelect'
  | 'onBeginDrag'
  | 'onBeginEdit'
  | 'onEditLink'
  | 'onEditCode'
  | 'onOpenNote'
  | 'imageContext'
  | 'onContextSelect'
> & {
  wrapperRef: RefObject<HTMLDivElement | null>;
  // Another participant holds this element selected (spec/07): block
  // select / drag / edit outright.
  remotelyLocked: boolean;
  isAnnotation: boolean;
  multiSelectActive: boolean;
  isMultiSelected: boolean;
  // Single-selection state, so a shift press on the selected element can
  // start the duplicate drag (spec/80) instead of only toggling.
  isSelected: boolean;
}) {
  const handleShapeDown = (e: ReactPointerEvent) => {
    if (isEditing) return;
    // Remotely locked: swallow the press so it neither starts a drag /
    // selection nor falls through to the canvas. The not-allowed cursor
    // + the remote-selector badge tell the user why nothing happened.
    if (remotelyLocked) {
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    // Dot-voting (spec/39): while a vote is open, pressing a votable
    // element casts one of your dots instead of selecting / dragging it.
    // Non-votable elements (text / frame / arrow / …) still select, so
    // the facilitator can keep arranging the board.
    if (vote?.active && onCastVote && isVotable(element)) {
      onCastVote(element.id);
      return;
    }
    // Shift modifier: on an element that is NOT part of the selection it
    // stays the immediate selection toggle (add to the marquee set), the
    // convention every drawing tool uses. On an element that IS selected
    // (single selection or a multi-select member) the toggle is DEFERRED
    // so shift can also start the duplicate drag (spec/80): begin a
    // normal move drag now, and only if the pointer never travels (a
    // true shift-CLICK) apply the toggle on release. A real shift-drag
    // moves the selection and the drag's release duplicates it.
    if (e.shiftKey) {
      if (!(isSelected || isMultiSelected)) {
        onShiftSelect?.(element.id);
        return;
      }
      const startX = e.clientX;
      const startY = e.clientY;
      const onUp = (ue: PointerEvent) => {
        window.removeEventListener('pointerup', onUp);
        // Same engage threshold as the drag machinery (DRAG_ENGAGE_PX).
        if (Math.hypot(ue.clientX - startX, ue.clientY - startY) <= 4) {
          onShiftSelect?.(element.id);
        }
      };
      window.addEventListener('pointerup', onUp);
      onBeginDrag(element.id, 'move', e);
      return;
    }
    // While a multi-selection is already active, a plain click on a
    // non-member promotes it into the marquee set instead of
    // collapsing back to single-select. Lets the user drag a box and
    // then refine the selection one element at a time without having
    // to remember the Shift modifier. Clicks on existing members
    // still start a drag — that's how the whole bundle gets moved.
    if (multiSelectActive && !isMultiSelected) {
      onShiftSelect?.(element.id);
      return;
    }
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
    // A link card has no inline label — double-click opens the link picker
    // to set / change its URL (spec/40).
    if (element.type === 'link-card') {
      onEditLink?.(element.id);
      return;
    }
    // An annotation has no inline label either — double-click opens its note
    // editor (spec/38). A single click just selects it now.
    if (isAnnotation) {
      onOpenNote?.(element.id);
      return;
    }
    // A code block has no inline label — double-click opens its edit
    // dialog (spec/82), the way a link card opens the link picker.
    if (element.type === 'shape' && element.shape === 'code-block') {
      onEditCode?.(element.id);
      return;
    }
    // The self-drawing data components (progress / rail / rating / charts /
    // checklist) draw their own content and have no editable text label, so
    // double-click never enters text-edit mode for them — it would pop an
    // empty, confusing editor. (beginEdit also guards this; belt-and-braces
    // so no entry point slips through.)
    if (element.type === 'shape' && isSelfDrawingShape(element.shape)) {
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
    e.preventDefault();
    e.stopPropagation();
    openContextMenuBesideElement();
  };

  // Touch long-press is the phone / tablet equivalent of right-click: it
  // opens the element's context menu (touch never fires `contextmenu`). Same
  // guards as handleContextMenu; a press that moves becomes a drag instead.
  const longPress = useLongPress(() => {
    if (isEditing || remotelyLocked) return;
    openContextMenuBesideElement();
  });

  return { handleShapeDown, handleDoubleClick, handleContextMenu, longPress };
}
