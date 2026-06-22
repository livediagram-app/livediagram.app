import {
  memo,
  useState,
  type DragEvent as ReactDragEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  acceptsInlineIcon,
  isVotable,
  activeCommentCount,
  ANIMATION_SPEED_FACTOR,
  BORDER_DASH_ARRAY,
  BORDER_RADIUS_PX,
  BORDER_STROKE_PX,
  catmullRomToBezierPath,
  DEFAULT_BORDER_STROKE,
  DEFAULT_BORDER_STYLE,
  defaultFillColor,
  defaultPadding,
  defaultStrokeColor,
  defaultTextAlign,
  defaultTextColor,
  hasRichFormatting,
  isBarShape,
  isLineShape,
  isPieShape,
  isProgressShape,
  isRailShape,
  isRatingShape,
  isSelfDrawingShape,
  PADDING_PX,
  type BoxedElement,
  type FreehandElement,
  type IconPosition,
  type ShapeElement,
  type ShapeMarker,
  type TextRun,
  type TextSize,
} from '@livediagram/diagram';
import { iconDropSide, type DragMode } from '@/lib/canvas';
import { renderLabel } from './element-labels';
import {
  ALIGN_ITEMS,
  effectiveRunStyle,
  FIXED_FONT_PX,
  labelTextStyleCss,
  TEXT_ALIGN,
} from './label-style';
import { EdgeResizeHandle, LockBadge, ResizeHandles } from './element-parts';
import { ImageElementView } from './ImageElementView';
import { ProgressView } from './ProgressView';
import { isSvgRenderedShape, ShapeSvgOverlay } from './shape-svg-overlay';
import { BoxBorderOverlay } from './BoxBorderOverlay';
import { isCssNativeBorderStyle } from './border-css';
import { describeVariant } from './element-variant';
import { BadgeStrip, RemoteSelectorsStrip } from './element-badges';
import { AnnotationGlyph, AnnotationHoverNote } from './AnnotationMarker';
import { LinkCardView } from './LinkCardView';
import { IconGlyph } from './icon-glyph';
import { ShapeMarkerGlyph } from './ShapeMarker';
import { RailView } from './RailView';
import { RatingView } from './RatingView';
import { PieChartView } from './PieChartView';
import { BarChartView } from './BarChartView';
import { LineChartView } from './LineChartView';
import { TechIconGlyph } from './tech-icon-glyph';
import { ICON_DND_MIME } from '@/lib/icons';
import { isTechIconId } from '@/lib/tech-icons';
import { useLongPress } from '@/hooks/useLongPress';
import { describeLink } from '@/lib/link-label';
import { TableView } from './TableView';
import { Tooltip } from './Tooltip';

type BoxedElementViewProps = {
  element: BoxedElement;
  isSelected: boolean;
  // True when this element is part of an active marquee multi-selection.
  // Drives a louder selection ring (brand-500 instead of brand-200) so
  // it's obvious which elements are bundled into a multi-action like
  // Delete or Duplicate.
  isMultiSelected?: boolean;
  // True when *any* marquee multi-selection is currently active (size > 0).
  // While active, plain clicks on a non-member promote it into the
  // multi-set instead of replacing the selection — that's the "drag a
  // box, then click a few more" flow users expect.
  multiSelectActive?: boolean;
  isEditing: boolean;
  // When the current edit session began via type-to-edit (spec/09), the
  // label was seeded with the first typed char and the editor should
  // place the caret at the end instead of selecting all.
  editCursorAtEnd?: boolean;
  isPaintMode: boolean;
  showHandles: boolean;
  showAnchors: boolean;
  zoom: number;
  onBeginDrag: (id: string, mode: DragMode, e: ReactPointerEvent) => void;
  // Shift-click on an element fires this with the element id so the
  // page can toggle membership in the marquee multi-selection.
  onShiftSelect?: (id: string) => void;
  // Element-id-bearing signatures so the parent can pass a single
  // stable callback per kind (rather than recreating a closure per
  // element on every render). The child has `element.id` in scope
  // and forwards it where needed. This is what makes the React.memo
  // wrapper around the export viable: with pre-bound callbacks,
  // every parent render would invalidate the memo via fresh function
  // identities.
  onBeginEdit: (id: string) => void;
  onCommitLabel: (id: string, label: string, runs?: TextRun[]) => void;
  // Whole-element alignment + padding setters, surfaced in the rich-text
  // edit toolbar (spec/09). They operate on the current selection (= the
  // editing element). Optional so read-only paths can omit them.
  onSetTextAlign?: (
    x: import('@livediagram/diagram').TextAlignX,
    y: import('@livediagram/diagram').TextAlignY,
  ) => void;
  onSetPadding?: (padding: import('@livediagram/diagram').Padding) => void;
  onSetFont?: (font: string | null) => void;
  onSetTextSize?: (size: TextSize) => void;
  onCommitTable: (
    id: string,
    patch: Partial<
      Pick<
        import('@livediagram/diagram').TableElement,
        'cells' | 'colWidths' | 'rowHeights' | 'cellStyles'
      >
    >,
  ) => void;
  // Edit a timeline-rail point's label (spec/51). Omitted in read-only mode.
  onSetRailLabel?: (elementId: string, index: number, text: string) => void;
  // Theme-derived default slice colours for pie charts (spec/53).
  chartPalette?: readonly string[];
  onCancelEdit: () => void;
  onFollowLink: (link: import('@livediagram/diagram').ElementLink) => void;
  onOpenComments: (id: string) => void;
  // Image element context: the editor passes these so the inner
  // ImageElementView can fetch the bitmap with the right
  // owner / share / diagram identity (the bytes are auth-gated by
  // the API, see spec/19). View-role visitors are still allowed to
  // see images; they just can't upload new ones via the picker.
  imageContext?: {
    ownerId: string;
    diagramId: string;
    shareCode: string | null;
    onOpenPicker?: (elementId: string) => void;
  };
  // Open the per-element note popover. Optional so read-only viewers
  // (who shouldn't see a clickable badge) can omit it. When omitted
  // the note badge does not render.
  onOpenNote?: (id: string) => void;
  // Open the link picker for a link-card element (spec/40), on double-click.
  // Omitted for read-only viewers.
  onEditLink?: (id: string) => void;
  // Live dot-vote (spec/39). `vote` is the active tab's vote session
  // (undefined when none). `selfId` is the local participant (for "my
  // dots"); `voteMax` is the highest dot count on the tab (for the
  // winner highlight once revealed). cast/retract are omitted for
  // read-only viewers, who watch but can't vote.
  vote?: import('@livediagram/diagram').TabVote;
  selfId?: string;
  voteMax?: number;
  onCastVote?: (id: string) => void;
  onRetractVote?: (id: string) => void;
  // Drop a dragged palette icon onto this shape. The view computes which
  // side of the text the icon landed on and reports it. Omitted in
  // read-only mode so visitors can't drop icons.
  onDropIcon?: (id: string, iconId: string, position: IconPosition) => void;
  // Open the link picker for one of this table's cells. Only used by
  // table elements; omitted for read-only viewers.
  onLinkCell?: (tableId: string, r: number, c: number) => void;
  // Right-click on the element. Receives the element id + the
  // cursor's screen-space coords so the caller can anchor a context
  // menu under it. The caller is also responsible for selecting the
  // element (the menu's actions assume it is the current selection).
  onContextSelect: (id: string, screenX: number, screenY: number) => void;
  // The colour for the link/comment badges. Comes from the active
  // tab's theme so the icons read as part of the diagram rather than
  // floating brand-blue dots on a coloured palette.
  badgeColor: string;
  // True when the tab as a whole is locked. Shows the LockBadge on
  // every element regardless of its own per-element lock state.
  tabLocked: boolean;
  // This diagram's tabs (id + name), so a link badge's tooltip can
  // name the tab/element it points at (spec/09). Stable reference.
  tabSummaries: { id: string; name: string }[];
  // True for view-role share visitors (session read-only). Shape / text
  // editing is blocked upstream in the editing handlers, but the table
  // edits in-component (TableView's own cell double-click + menus), so it
  // needs the flag passed through to stay read-only for viewers.
  readOnly: boolean;
  // Other participants whose realtime selection is currently on this
  // element. Rendered as a small initial-badge stack at the top-left
  // (opposite the link / comment badges).
  remoteSelectors: { id: string; name: string; color: string }[];
  // Resolved CSS font-family stack for this element's text (spec/28):
  // its own font, else the tab's, else undefined (inherit the editor
  // default). Applied to the label / cell text + their live editors.
  fontFamily?: string;
};

// Wrapped in React.memo at the export below: with id-bearing
// callbacks the parent passes a single stable function per kind
// (rather than recreating per-element closures every render), so
// shallow prop equality on `element` + the per-id selection flags
// + `zoom` etc. lets BoxedElementView skip the work when only an
// unrelated element changed. Defaulting parameters happen inside
// the function body (rather than the destructure) so the memo's
// shallow check sees the underlying undefined vs concrete value
// rather than the defaulted boolean.
function BoxedElementViewImpl({
  element,
  isSelected,
  isMultiSelected = false,
  multiSelectActive = false,
  isEditing,
  editCursorAtEnd = false,
  isPaintMode,
  showHandles,
  showAnchors,
  zoom,
  onBeginDrag,
  onShiftSelect,
  onBeginEdit,
  onCommitLabel,
  onSetTextAlign,
  onSetPadding,
  onSetFont,
  onSetTextSize,
  onCommitTable,
  onSetRailLabel,
  chartPalette,
  onCancelEdit,
  onFollowLink,
  onOpenComments,
  onOpenNote,
  onEditLink,
  vote,
  selfId,
  voteMax,
  onCastVote,
  onRetractVote,
  onDropIcon,
  onLinkCell,
  imageContext,
  onContextSelect,
  remoteSelectors,
  badgeColor,
  tabLocked,
  tabSummaries,
  readOnly,
  fontFamily,
}: BoxedElementViewProps) {
  const isLocked = element.locked === true || tabLocked;
  // Concurrent-selection lock (spec/07): another participant has this
  // element selected (remoteSelectors already excludes our own
  // selection). We block select / drag / edit and show a not-allowed
  // cursor so two people don't fight over the same element. Distinct
  // from `isLocked` above, which is the persisted user-set padlock.
  const remotelyLocked = remoteSelectors.length > 0;
  // Clockwise rotation about the element centre. `isRotated` gates the
  // resize handles off while rotated: the resize math runs in canvas-
  // axis space, so dragging a corner of a spun box would make it
  // "swim". Rotating back to 0 restores resize. The rotate handle
  // itself stays available at any angle so the user can always undo a
  // rotation by dragging.
  const rotation = element.rotation ?? 0;
  const isRotated = rotation % 360 !== 0;
  const label = element.label ?? '';
  const textSize: TextSize = element.textSize ?? 'scale';
  const defaultAlign = defaultTextAlign(element);
  const alignX = element.textAlignX ?? defaultAlign.x;
  const alignY = element.textAlignY ?? defaultAlign.y;
  const textColor = element.textColor ?? defaultTextColor(element);

  // Annotation marker (spec/38): a fixed-size note circle. Hovering it
  // floats its note above everything; clicking it (handled in the drag
  // engine's click-vs-drag test) opens the editable note popover.
  const isAnnotation = element.type === 'annotation';
  const [hovering, setHovering] = useState(false);

  // Dot-vote tally for this element (spec/39): total dots, how many are
  // mine (clicking the pill retracts one), and whether it's a revealed
  // winner. The pill only shows once at least one dot has landed.
  const voteTotal = vote ? (vote.votes[element.id]?.length ?? 0) : 0;
  const myVotes =
    vote && selfId ? (vote.votes[element.id]?.filter((id) => id === selfId).length ?? 0) : 0;
  const showVotePill = !!vote && voteTotal > 0 && isVotable(element);
  const isVoteWinner = !!vote?.revealed && voteTotal > 0 && voteTotal === (voteMax ?? 0);

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
    // Shift modifier turns the down-event into a selection toggle
    // (add or remove this element from the marquee multi-selection)
    // instead of starting a drag. Matches the convention every
    // drawing tool uses.
    if (e.shiftKey) {
      onShiftSelect?.(element.id);
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
    // The self-drawing data components (progress / rail / rating / charts) draw
    // their own content and have no editable text label, so double-click never
    // enters text-edit mode for them — it would pop an empty, confusing editor.
    // (beginEdit also guards this; belt-and-braces so no entry point slips
    // through.)
    if (element.type === 'shape' && isSelfDrawingShape(element.shape)) {
      return;
    }
    // Don't gate on isPaintMode here (the page-level beginEdit decides whether
    // edit can start; it rejects during format painter, and exits group mode).
    onBeginEdit(element.id);
  };

  // Right-click selects the element + asks the page to open a
  // context menu at the cursor. The page also keeps showing the
  // SelectionPopover (handled by the normal selection flow), so the
  // context menu is an additional surface, not a replacement.
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
    onContextSelect(element.id, e.clientX, e.clientY);
  };

  // Touch long-press is the phone / tablet equivalent of right-click: it
  // opens the element's context menu (touch never fires `contextmenu`). Same
  // guards as handleContextMenu; a press that moves becomes a drag instead.
  const longPress = useLongPress((x, y) => {
    if (isEditing || remotelyLocked) return;
    onContextSelect(element.id, x, y);
  });

  const cursor = remotelyLocked
    ? 'cursor-not-allowed'
    : isPaintMode
      ? 'cursor-copy'
      : isEditing
        ? 'cursor-text'
        : isLocked
          ? 'cursor-default'
          : 'cursor-move';

  // When at least one remote participant has selected this element, the
  // border / stroke colour is overridden with the first remote selector's
  // colour so the realtime "X is here" signal is glanceable from anywhere
  // on the canvas — not just from the small initial-badge.
  const remoteBorderColor = remoteSelectors.length > 0 ? remoteSelectors[0]!.color : null;
  // Accent for the data-element fills (progress bar / ring, rail line, rating
  // stars): a remote selector colour wins, else the element's own stroke, else
  // the theme default stroke. Shared by the ProgressView / RailView / RatingView
  // branches below so they all read the same accent.
  const accent = remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element);
  const variant = describeVariant(element, isSelected, isMultiSelected, remoteBorderColor);

  const commentCount = activeCommentCount(element.commentThread);
  // Both 'tab' and 'diagram' kinds get the "linked" badge; the
  // follow-handler dispatches off the kind via the parent's
  // onFollowLink callback. 'element' kind is the spec'd
  // jump-and-focus that isn't surfaced in the UI yet. A link-card is
  // EXCLUDED: the card itself is the link (its bottom half follows it),
  // so the corner badge would be redundant.
  const linked =
    element.type !== 'link-card' &&
    element.link !== undefined &&
    (element.link.kind === 'tab' || element.link.kind === 'diagram' || element.link.kind === 'url');

  // An inline icon sits beside the label on a regular shape (the
  // dedicated 'icon' shape kind has its own glyph-above-caption render
  // above and is excluded here). Computed before the label so the editor
  // can render as a flex child (keeping the icon visible while typing).
  const inlineIcon = element.type === 'shape' && element.shape !== 'icon' && element.iconId;
  // A status marker (spec/49) sits just left of the label (or centred when the
  // shape has no label). Progress shapes render their own centred percentage,
  // so they skip it. Shares the icon+label flex layout below.
  const marker: ShapeMarker | undefined =
    element.type === 'shape' && !isSelfDrawingShape(element.shape) ? element.marker : undefined;
  // The text label, computed once so the freehand branch, the plain
  // shape branch, and the inline-icon layout below all share it.
  const labelNode = renderLabel(
    element,
    label,
    textSize,
    alignX,
    alignY,
    PADDING_PX[element.padding ?? defaultPadding(element)],
    isEditing,
    (next, runs) => onCommitLabel(element.id, next, runs),
    onCancelEdit,
    editCursorAtEnd,
    zoom,
    fontFamily,
    onSetTextAlign,
    onSetPadding,
    onSetFont,
    onSetTextSize,
    !!inlineIcon,
  );

  // Drag a palette icon onto a regular shape to drop it inside, on the
  // side of the text nearest the cursor. `dropSide` drives the live
  // preview band so the user sees WHERE the icon will land before
  // releasing (null = not currently a drag target).
  const acceptsIconDrop = !!onDropIcon && acceptsInlineIcon(element);
  const [dropSide, setDropSide] = useState<IconPosition | null>(null);
  const handleIconDragOver = (e: ReactDragEvent) => {
    if (!acceptsIconDrop || !e.dataTransfer.types.includes(ICON_DND_MIME)) return;
    // preventDefault marks this element as a valid drop target.
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const side = iconDropSide(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
    setDropSide((prev) => (prev === side ? prev : side));
  };
  const handleIconDragLeave = () => setDropSide(null);
  const handleIconDrop = (e: ReactDragEvent) => {
    if (!acceptsIconDrop) return;
    const iconId = e.dataTransfer.getData(ICON_DND_MIME);
    setDropSide(null);
    if (!iconId) return;
    e.preventDefault();
    e.stopPropagation();
    onDropIcon!(
      element.id,
      iconId,
      iconDropSide(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect()),
    );
  };
  // Reposition the EXISTING inline icon by dragging it (when its shape is
  // selected). Pointer-drag rather than HTML5 DnD since it starts on a
  // canvas element; on release the nearest side becomes the new
  // iconPosition (reuses onDropIcon with the same iconId). The live
  // preview band reuses `dropSide`.
  const canRepositionIcon =
    isSelected && !readOnly && !!onDropIcon && element.type === 'shape' && !!element.iconId;
  const startIconReposition = (e: ReactPointerEvent) => {
    if (!canRepositionIcon || !element.iconId) return;
    e.stopPropagation();
    e.preventDefault();
    const wrapper = (e.currentTarget as HTMLElement).closest('[data-element-id]');
    if (!wrapper) return;
    const iconId = element.iconId;
    const move = (ev: PointerEvent) => {
      setDropSide(iconDropSide(ev.clientX, ev.clientY, wrapper.getBoundingClientRect()));
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const side = iconDropSide(ev.clientX, ev.clientY, wrapper.getBoundingClientRect());
      setDropSide(null);
      onDropIcon!(element.id, iconId, side);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  // Translucent band on the target side + a ring, shown while dragging an
  // icon over this shape so the drop position is obvious.
  const DROP_BAND: Record<IconPosition, string> = {
    left: 'left-0 top-0 bottom-0 w-1/3',
    right: 'right-0 top-0 bottom-0 w-1/3',
    above: 'left-0 right-0 top-0 h-1/3',
    below: 'left-0 right-0 bottom-0 h-1/3',
  };

  // trace / gradient / pulse / glow on an SVG-rendered shape (diamond,
  // triangle, hexagon, …) render against the true outline / fill / silhouette
  // inside ShapeSvgOverlay, so the wrapper must NOT also paint its
  // bounding-box version (pulse / glow as a box-shadow would ring the
  // rectangle, not the shape; trace / gradient would double up). Every other
  // animation — and these four on CSS-rendered shapes (circle / stadium /
  // square / browser, where the wrapper's border-radius already matches the
  // outline) and non-shape boxed elements — stays a wrapper class.
  const svgAnim =
    element.animation === 'trace' ||
    element.animation === 'gradient' ||
    element.animation === 'pulse' ||
    element.animation === 'glow'
      ? element.animation
      : undefined;
  const svgHandlesAnim =
    element.type === 'shape' && isSvgRenderedShape(element.shape) && svgAnim !== undefined;
  const wrapperAnimClass = element.animation
    ? svgHandlesAnim
      ? ''
      : `lvd-anim-${element.animation}`
    : 'animate-pop-in';

  return (
    <div
      data-element-id={element.id}
      onPointerDown={(e) => {
        longPress.onPointerDown(e);
        handleShapeDown(e);
      }}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onPointerEnter={isAnnotation ? () => setHovering(true) : undefined}
      onPointerLeave={isAnnotation ? () => setHovering(false) : undefined}
      onDragOver={acceptsIconDrop ? handleIconDragOver : undefined}
      onDragLeave={acceptsIconDrop ? handleIconDragLeave : undefined}
      onDrop={acceptsIconDrop ? handleIconDrop : undefined}
      className={`absolute origin-center touch-none select-none ${
        // A looping animation (spec/09) replaces the one-shot pop-in entry
        // class (both drive the `animation` property, so they can't co-exist).
        wrapperAnimClass
      } ${variant.className} ${cursor}`}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        color: textColor,
        opacity: element.opacity ?? 1,
        ...variant.style,
        // Pulse / glow rings take the element's accent (its stroke, else its
        // text colour); the speed factor scales the keyframe duration. See
        // .lvd-anim-* in globals.css.
        ...(element.animation
          ? ({
              '--lvd-anim-color': element.strokeColor ?? textColor,
              '--lvd-anim-speed': ANIMATION_SPEED_FACTOR[element.animationSpeed ?? 'normal'],
              // The moving-gradient animation blends the fill into the accent;
              // expose the fill (shared by the wrapper CSS gradient and the SVG
              // <stop> cycle that ShapeSvgOverlay inherits).
              ...(element.animation === 'gradient'
                ? { '--lvd-anim-bg': element.fillColor ?? defaultFillColor(element) }
                : {}),
            } as React.CSSProperties)
          : {}),
        // Spin about the centre (the wrapper already has origin-center).
        // Handles + anchors are children, so they rotate with the box.
        ...(isRotated ? { transform: `rotate(${rotation}deg)` } : {}),
        // Deliberately do NOT raise z-index on plain selection. Keeping
        // the element at its natural paint order means selecting a
        // container doesn't jump it above the content layered on top of
        // it — users resize containers against their visible content.
        // While EDITING the label, though, raise it so the text the user
        // is typing isn't hidden behind elements painted above it. (The
        // selection handles get lifted separately via SelectionHandles.)
        ...(isEditing ? { zIndex: 10 } : {}),
      }}
    >
      {element.type === 'shape' && element.shape === 'icon' && isTechIconId(element.iconId) ? (
        // Technology (brand) icon: a fixed-colour tile + white glyph
        // (spec/41). Same shape kind as a curated icon, but the id
        // resolves in the tech catalogue, so it renders coloured rather
        // than stroke-tinted.
        <TechIconGlyph
          iconId={element.iconId}
          hasLabel={(element.label ?? '').trim().length > 0}
          animation={element.iconAnimation}
          animationSpeed={element.iconAnimationSpeed}
        />
      ) : element.type === 'shape' && element.shape === 'icon' ? (
        // Curated glyph: line art tinted by the element's stroke
        // colour. Rendered separately from ShapeSvgOverlay because it
        // keeps aspect ratio (the catalogue art must not warp) and is
        // data-driven by `iconId`.
        <IconGlyph
          iconId={element.iconId}
          stroke={remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element)}
          strokeWidth={remoteBorderColor ? 3 : 2}
          hasLabel={(element.label ?? '').trim().length > 0}
          // Per-icon looping animation (spec/09). Picked from the icon context
          // menu; undefined = static.
          animation={element.iconAnimation}
          animationSpeed={element.iconAnimationSpeed}
        />
      ) : element.type === 'shape' && isProgressShape(element.shape) ? (
        // Progress elements (spec/46): a bar / donut showing element.progress.
        // The fill takes the stroke accent; the track takes the fill colour.
        <ProgressView
          element={element}
          accent={accent}
          track={element.fillColor ?? '#e2e8f0'}
          textColor={textColor}
        />
      ) : element.type === 'shape' && isRailShape(element.shape) ? (
        // Timeline rail (spec/51): a line + evenly-spaced points, with an
        // add-point affordance at the right end when selected + editable.
        <RailView
          element={element}
          accent={accent}
          textColor={textColor}
          fontFamily={fontFamily}
          editable={isSelected && !readOnly && !isLocked}
          onSetLabel={onSetRailLabel}
        />
      ) : element.type === 'shape' && isRatingShape(element.shape) ? (
        // Rating (spec/52): a row of stars showing element.rating.
        <RatingView element={element} accent={accent} />
      ) : element.type === 'shape' && isPieShape(element.shape) ? (
        // Pie chart (spec/53): slices sized by value + a legend.
        <PieChartView
          element={element}
          fontFamily={fontFamily}
          textColor={textColor}
          palette={chartPalette}
        />
      ) : element.type === 'shape' && isBarShape(element.shape) ? (
        // Bar chart (spec/53): bars sized by value + a legend.
        <BarChartView
          element={element}
          fontFamily={fontFamily}
          textColor={textColor}
          palette={chartPalette}
        />
      ) : element.type === 'shape' && isLineShape(element.shape) ? (
        // Line chart (spec/53): multi-series lines + a legend.
        <LineChartView
          element={element}
          fontFamily={fontFamily}
          textColor={textColor}
          palette={chartPalette}
        />
      ) : element.type === 'shape' && isSvgRenderedShape(element.shape) ? (
        <ShapeSvgOverlay
          shape={element.shape}
          fill={element.fillColor ?? defaultFillColor(element)}
          stroke={remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element)}
          strokeWidth={
            remoteBorderColor ? 3 : BORDER_STROKE_PX[element.strokeWidth ?? DEFAULT_BORDER_STROKE]
          }
          strokeDasharray={
            BORDER_DASH_ARRAY[element.strokeStyle ?? DEFAULT_BORDER_STYLE] ?? undefined
          }
          aspect={element.height > 0 ? element.width / element.height : 1}
          // trace / gradient / pulse / glow render against the true SVG
          // geometry here; blink / bounce / wobble (shape-agnostic) stay on the
          // wrapper. svgHandlesAnim above suppresses the wrapper class so these
          // don't double up.
          animation={svgAnim}
        />
      ) : null}
      {/* CSS-rendered shapes (square / circle / stadium / browser) paint
          their border via the wrapper's CSS `border`, which can't draw the
          composite dash patterns. When one of those is picked, stroke the
          outline here instead (element-variant drops the CSS border to
          match). Solid / dashed / dotted stay on the cheaper CSS path. */}
      {element.type === 'shape' &&
      !isSvgRenderedShape(element.shape) &&
      !remoteBorderColor &&
      !isCssNativeBorderStyle(element.strokeStyle ?? DEFAULT_BORDER_STYLE) ? (
        <BoxBorderOverlay
          shape={element.shape}
          width={element.width}
          height={element.height}
          stroke={element.strokeColor ?? defaultStrokeColor(element)}
          strokeWidth={BORDER_STROKE_PX[element.strokeWidth ?? DEFAULT_BORDER_STROKE]}
          dasharray={BORDER_DASH_ARRAY[element.strokeStyle ?? DEFAULT_BORDER_STYLE] ?? ''}
          radiusPx={element.borderRadius !== undefined ? BORDER_RADIUS_PX[element.borderRadius] : 8}
        />
      ) : null}
      {/* Browser-only HTML chrome overlay. SVG handles only the
          outer frame + divider so the user's border style applies;
          the dots / nav / URL bar render here so their geometry is
          fixed-pixel and doesn't deform with the box's aspect
          ratio. */}
      {element.type === 'shape' && element.shape === 'browser' ? (
        <BrowserChrome
          stroke={remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element)}
          zoom={zoom}
        />
      ) : null}

      {element.type === 'annotation' ? (
        <AnnotationGlyph
          stroke={remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element)}
        />
      ) : element.type === 'link-card' ? (
        <LinkCardView
          element={element}
          tabs={tabSummaries}
          onFollow={element.link ? () => onFollowLink(element.link!) : undefined}
        />
      ) : element.type === 'image' && imageContext ? (
        <ImageElementView
          element={element}
          ownerId={imageContext.ownerId}
          diagramId={imageContext.diagramId}
          shareCode={imageContext.shareCode}
          canOpenPicker={!!imageContext.onOpenPicker}
        />
      ) : element.type === 'freehand' ? (
        <>
          <FreehandSvg
            element={element}
            fill={element.fillColor ?? defaultFillColor(element)}
            stroke={remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element)}
          />
          {/* Render the label on top of the SVG path so a freehand
              can carry text the same way a shape does (the Editor
              panel's Text accordion lights up for it). Both the SVG
              and the label use absolute inset-0 so they overlay
              cleanly inside the element's bounding box. Skipped when
              there's no label AND we're not mid-edit, to avoid the
              empty placeholder taking up space and competing with
              the drawn stroke. */}
          {isEditing || label.length > 0 ? labelNode : null}
        </>
      ) : element.type === 'table' ? (
        <TableView
          element={element}
          isSelected={isSelected}
          readOnly={isLocked || readOnly}
          tabSummaries={tabSummaries}
          onCommitTable={onCommitTable}
          onLinkCell={onLinkCell}
          onFollowLink={onFollowLink}
          fontFamily={fontFamily}
          zoom={zoom}
        />
      ) : element.type === 'shape' && (inlineIcon || marker) ? (
        <ShapeInlineIconLayout
          element={element}
          showIcon={!!inlineIcon}
          marker={marker}
          markerSize={element.markerSize ?? 'scale'}
          position={element.iconPosition ?? 'left'}
          iconStroke={textColor}
          isEditing={isEditing}
          editor={labelNode}
          label={label}
          textColor={textColor}
          textSize={textSize}
          alignX={alignX}
          alignY={alignY}
          padding={PADDING_PX[element.padding ?? defaultPadding(element)]}
          fontFamily={fontFamily}
          draggableIcon={canRepositionIcon}
          onIconPointerDown={startIconReposition}
        />
      ) : element.type === 'shape' && isSelfDrawingShape(element.shape) ? (
        // Progress / rail / rating / chart elements draw their own content, so
        // they render no standard editable label.
        <></>
      ) : (
        labelNode
      )}

      {/* Live drop preview while dragging a palette icon over this shape:
          a brand ring + a translucent band on the side the icon will
          land. Cleared on drop / drag-leave. */}
      {dropSide ? (
        <div
          className="pointer-events-none absolute inset-0 z-20 ring-2 ring-brand-400"
          style={{ borderRadius: 'inherit' }}
        >
          <div className={`absolute bg-brand-400/25 ${DROP_BAND[dropSide]}`} />
        </div>
      ) : null}

      {isLocked ? <LockBadge zoom={zoom} /> : null}

      {remoteSelectors.length > 0 ? (
        <RemoteSelectorsStrip zoom={zoom} selectors={remoteSelectors} />
      ) : null}

      {/* The annotation marker IS the note affordance, so it suppresses
          the generic note badge (it would be redundant). */}
      {linked || commentCount > 0 || (element.note && onOpenNote && !isAnnotation) ? (
        <BadgeStrip
          zoom={zoom}
          linked={linked}
          linkLabel={element.link ? describeLink(element.link, tabSummaries) : undefined}
          commentCount={commentCount}
          hasNote={!!element.note && !!onOpenNote && !isAnnotation}
          badgeColor={badgeColor}
          onFollowLink={() => {
            if (element.link) onFollowLink(element.link);
          }}
          onOpenComments={() => onOpenComments(element.id)}
          onOpenNote={onOpenNote ? () => onOpenNote(element.id) : undefined}
        />
      ) : null}

      {/* Dot-vote tally pill (spec/39): live count, brand-filled when it
          holds your dots (click to retract one), amber-ringed if it's a
          revealed winner. */}
      {isVoteWinner ? (
        <div
          className="pointer-events-none absolute inset-0 ring-2 ring-amber-400"
          style={{ borderRadius: 'inherit' }}
        />
      ) : null}
      {showVotePill ? (
        <div
          className="absolute -bottom-1 -right-1 origin-bottom-right"
          style={{ transform: `scale(${1 / zoom})` }}
        >
          <Tooltip
            title={`${voteTotal} ${voteTotal === 1 ? 'vote' : 'votes'}`}
            description={myVotes > 0 ? 'Click to remove one of your dots.' : undefined}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (myVotes > 0) onRetractVote?.(element.id);
              }}
              aria-label={`${voteTotal} votes`}
              className={
                'pointer-events-auto flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold shadow-sm ' +
                (myVotes > 0
                  ? 'bg-brand-500 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100')
              }
            >
              {voteTotal}
            </button>
          </Tooltip>
        </div>
      ) : null}

      {showHandles || showAnchors ? (
        // Selection chrome (resize / rotate / arrow-anchor handles) rides
        // in its own layer ABOVE the elements. On plain selection the
        // element wrapper is not a stacking context, so this z-index
        // resolves at the canvas-elements level: the handles paint above
        // neighbouring elements WITHOUT lifting this element's own content
        // (lifting it would re-hide a container's contents — the whole
        // point of not raising z on select). pointer-events-none keeps the
        // body draggable; every handle re-enables pointer events on itself.
        <div className="pointer-events-none absolute inset-0" style={{ zIndex: 30 }}>
          {/* Annotations resize too (aspect-locked by default so the marker
              stays round); they just keep rotation off — a tilted note marker
              reads as a mistake. Corner handles show even when rotated — the
              resize math projects the drag into the element's local frame
              (useEditorDrag). */}
          {showHandles ? (
            <ResizeHandles
              elementId={element.id}
              zoom={zoom}
              rotation={rotation}
              onBeginDrag={onBeginDrag}
            />
          ) : null}

          {showAnchors ? (
            <>
              {(['n', 'e', 's', 'w'] as const).map((a) => (
                <EdgeResizeHandle
                  key={a}
                  anchor={a}
                  elementId={element.id}
                  zoom={zoom}
                  rotation={rotation}
                  onBeginDrag={onBeginDrag}
                />
              ))}
            </>
          ) : null}
        </div>
      ) : null}

      {/* Hover preview: float this annotation's note above every element
          (spec/38). Suppressed while selected — the click/edit popover owns
          that surface then — and only when there's note text to show. */}
      {isAnnotation && hovering && !isSelected && !isEditing && element.note ? (
        <AnnotationHoverNote elementId={element.id} note={element.note} />
      ) : null}
    </div>
  );
}

// Default shallow-prop comparison is good enough here: `element` is
// reference-stable across renders that don't touch it (commit /
// commitTabs return new arrays only when something actually
// changed), every other prop is a primitive or an id-bearing
// callback that the parent keeps stable.
export const BoxedElementView = memo(BoxedElementViewImpl);

// Browser chrome rendered as fixed-pixel HTML rather than scaled SVG so
// the window dots stay round, the nav icons keep their stroke weight,
// and the URL bar grows to fill the available width at any aspect
// ratio. The outer frame comes from the SVG layer (so the user's
// themed fill / border style / dashed pattern apply); the divider line
// under the chrome is drawn here as this strip's bottom border so it
// rides with the FIXED chrome height rather than scaling with the box.
// Counter-scaled by `zoom` is intentionally NOT applied — chrome
// elements should scale with the canvas zoom like the rest of the
// shape so a small browser at low zoom still reads as a browser.
const BROWSER_CHROME_HEIGHT_PX = 48;
function BrowserChrome({ stroke, zoom: _zoom }: { stroke: string; zoom: number }) {
  return (
    <div
      aria-hidden
      // The address bar is a FIXED height pinned to the top: resizing
      // the browser only grows the content area below, never the
      // chrome. The height is in element space, so it still scales
      // with canvas zoom like the rest of the shape. pointer-events:
      // none so it never intercepts clicks on the shape itself.
      // Span the full width: the frame is now the wrapper's own CSS
      // border, so left-0 / right-0 lands the bottom divider exactly on
      // the inner edges of the side border instead of overhanging it.
      className="pointer-events-none absolute left-0 right-0 top-0 flex items-center gap-2.5 px-4 py-2.5"
      style={{
        height: BROWSER_CHROME_HEIGHT_PX,
        color: stroke,
        borderBottom: `1px solid ${stroke}`,
      }}
    >
      {/* Three traffic-light window dots. Fixed-pixel so they stay
          round regardless of how the box stretches. */}
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: stroke }} aria-hidden />
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: stroke }} aria-hidden />
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: stroke }} aria-hidden />
      </div>
      {/* Back / forward / reload icons. Single SVG group with fixed
          pixel size so the icon weight + spacing stays consistent. */}
      <svg
        width="56"
        height="18"
        viewBox="0 0 44 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
        aria-hidden
      >
        <path d="M 7 3 L 3 7 L 7 11" />
        <path d="M 15 11 L 19 7 L 15 3" />
        <path d="M 30 4 A 4 4 0 1 1 27 11 M 30 4 L 33 4 M 30 4 L 30 7" />
      </svg>
      {/* URL pill. Flex-fills the remaining width so it scales with
          the shape; the height stays fixed so it always reads as a
          pill no matter how tall the chrome strip is. */}
      <div
        className="h-5 min-w-0 flex-1 rounded-full border"
        style={{ borderColor: stroke }}
        aria-hidden
      />
    </div>
  );
}

function FreehandSvg({
  element,
  fill,
  stroke,
}: {
  element: FreehandElement;
  fill: string;
  stroke: string;
}) {
  // Map normalised points to the 100x100 viewBox before threading
  // them through the smoothing helper. `points.length < 2` collapses
  // to an empty path; the renderer then draws nothing, which is the
  // right behaviour for a degenerate single-click "stroke".
  const vbPoints = element.points.map((p) => ({ x: p.nx * 100, y: p.ny * 100 }));
  const d = vbPoints.length < 2 ? '' : catmullRomToBezierPath(vbPoints, element.closed);
  const dasharray = BORDER_DASH_ARRAY[element.strokeStyle ?? DEFAULT_BORDER_STYLE];
  const widthPx = BORDER_STROKE_PX[element.strokeWidth ?? DEFAULT_BORDER_STROKE];
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {d ? (
        <path
          d={d}
          // Closed paths get the fill; open strokes leave fill at
          // none so the bounding box doesn't read as a closed shape.
          fill={element.closed ? fill : 'none'}
          stroke={stroke}
          strokeWidth={widthPx}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dasharray ?? undefined}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  );
}

// Lays out an inline icon beside a shape's text label. The icon sits on
// the side named by `position`; icon + label are centred together as a
// group. Everything is pointer-events-none so a drag still grabs the
// shape; the label's own editor re-enables pointer events when active.

function ShapeInlineIconLayout({
  element,
  showIcon = true,
  marker,
  markerSize = 'scale',
  position,
  iconStroke,
  isEditing,
  editor,
  label,
  textColor,
  textSize,
  alignX,
  alignY,
  padding,
  fontFamily,
  draggableIcon,
  onIconPointerDown,
}: {
  element: ShapeElement;
  // Whether an inline icon glyph is present. False for a marker-only shape, so
  // the layout draws just the marker + label.
  showIcon?: boolean;
  // Optional status marker (spec/49), drawn immediately left of the label.
  marker?: ShapeMarker;
  markerSize?: TextSize;
  position: IconPosition;
  iconStroke: string;
  isEditing: boolean;
  // The full label renderer (incl. the inline editor). Shown full-box
  // while editing so typing keeps the normal editor; the icon reappears
  // once the edit commits.
  editor: ReactNode;
  label: string;
  textColor: string;
  textSize: TextSize;
  // The element's resolved text alignment + padding, so the icon + label
  // group honours them the same way a label-only shape does (it used to be
  // hardcoded centre + a fixed 8px inset, ignoring both).
  alignX: import('@livediagram/diagram').TextAlignX;
  alignY: import('@livediagram/diagram').TextAlignY;
  padding: number;
  fontFamily?: string;
  // When true the glyph itself is grabbable (parent shape selected): a
  // pointer-drag repositions it to a different side via onIconPointerDown.
  draggableIcon?: boolean;
  onIconPointerDown?: (e: ReactPointerEvent) => void;
}) {
  const isRow = position === 'left' || position === 'right';
  const iconFirst = position === 'left' || position === 'above';
  // Fixed sizes reuse element-labels' FIXED_FONT_PX; 'scale' has no fixed px,
  // so derive a reasonable size from the box for the inline icon+label case.
  const fontSize =
    textSize === 'scale'
      ? Math.max(12, Math.min(element.height * 0.26, 26))
      : FIXED_FONT_PX[textSize];
  // Element-proportional size: a fraction of the shorter side, clamped so
  // it's neither a speck nor dominant. Used as the ceiling (and as the
  // size itself for an icon with no label — nothing to scale against).
  const elementIconSize = Math.max(
    16,
    Math.min(Math.min(element.width, element.height) * 0.32, 48),
  );
  // With a label, tie the glyph to the label's font size so small text
  // gets a small icon instead of a 48px glyph dwarfing it; still capped by
  // the element-proportional size so it can't overflow a small shape.
  const iconSize = label.trim()
    ? Math.max(16, Math.min(fontSize * 1.6, elementIconSize))
    : elementIconSize;

  const iconGlyph = (
    <div
      className={`relative shrink-0 ${draggableIcon ? 'pointer-events-auto cursor-grab' : ''}`}
      style={{ width: iconSize, height: iconSize }}
      onPointerDown={draggableIcon ? onIconPointerDown : undefined}
    >
      <IconGlyph iconId={element.iconId} stroke={iconStroke} strokeWidth={2} hasLabel={false} />
    </div>
  );
  // Only the draggable icon earns a tooltip (the affordance hint); a static
  // icon needs none, so it skips the wrapper entirely.
  const iconBox = draggableIcon ? (
    <Tooltip title="Drag to move" description="Move the icon to another side of the label.">
      {iconGlyph}
    </Tooltip>
  ) : (
    iconGlyph
  );
  // The text flows (NOT absolute / flex-1) so the icon sits right beside
  // it and the whole group stays centred — `flex-1` previously stretched
  // the label and shoved the icon to the element edge. min-w-0 lets a
  // long label wrap / shrink instead of overflowing.
  // The wrapper carries the inline base font + colour; the inner content
  // carries the text styling. Per-range rich text (spec/09) renders one span
  // per run so an inline icon doesn't drop the formatting — the plain
  // whole-element path below ignored `richText`, which is why bold/italic
  // "didn't apply" once a shape also had an icon. `effectiveRunStyle` only
  // emits a run's overrides, so unstyled runs inherit this wrapper's size +
  // colour.
  const text = label.trim() ? (
    <span
      className="min-w-0 whitespace-pre-wrap break-words font-medium leading-tight"
      style={{ color: textColor, fontSize, fontFamily, textAlign: TEXT_ALIGN[alignX] }}
    >
      {hasRichFormatting(element.richText) ? (
        element.richText!.map((run, i) => (
          <span key={i} style={effectiveRunStyle(run, element, FIXED_FONT_PX)}>
            {run.text}
          </span>
        ))
      ) : (
        <span
          style={labelTextStyleCss({
            bold: element.textBold,
            italic: element.textItalic,
            underline: element.textUnderline,
            strikethrough: element.textStrikethrough,
          })}
        >
          {label}
        </span>
      )}
    </span>
  ) : null;
  // Position the icon + label group per the element's alignment. The flex
  // main axis runs along the icon/label arrangement (horizontal for a side
  // icon, vertical for a stacked one), so the X alignment drives justify on a
  // row and align on a column, and vice-versa for Y. `padding` replaces the
  // old fixed 8px inset so the Text category's padding preset applies here too.
  const xFlex = X_ALIGN_FLEX[alignX];
  const yFlex = ALIGN_ITEMS[alignY];
  // While editing, the editor (rendered as a flex child via `inline`) takes
  // the text slot so the icon stays visible beside it as the user types and
  // both honour the element's alignment. On commit it swaps back to the
  // static `text`.
  const slot = isEditing ? editor : text;
  // The marker (spec/49) sits immediately left of the label, sized from its
  // own bucket: 'scale' tracks the label's font size (capped to the box), the
  // fixed buckets are small / medium / large dots.
  const markerPx = marker
    ? markerSize === 'scale'
      ? Math.max(10, Math.min(fontSize * 1.1, elementIconSize))
      : MARKER_FIXED_PX[markerSize]
    : 0;
  const markerGlyph = marker ? (
    <span className="shrink-0" style={{ width: markerPx, height: markerPx, lineHeight: 0 }}>
      <ShapeMarkerGlyph marker={marker} size={markerPx} color={textColor} />
    </span>
  ) : null;
  // Marker + label form one inline group so the marker hugs the text and the
  // pair stays centred together (or the marker centres alone when no label).
  const content = markerGlyph ? (
    <div
      className="flex min-w-0 items-center"
      style={{ gap: Math.max(4, Math.round(markerPx * 0.4)) }}
    >
      {markerGlyph}
      {slot}
    </div>
  ) : (
    slot
  );
  return (
    <div
      className="pointer-events-none absolute inset-0 flex"
      style={{
        flexDirection: isRow ? 'row' : 'column',
        justifyContent: isRow ? xFlex : yFlex,
        alignItems: isRow ? yFlex : xFlex,
        padding,
        // Side-by-side icon + text wants more breathing room than the
        // stacked layout, so the glyph doesn't crowd the first letter.
        gap: isRow ? Math.max(8, Math.round(iconSize * 0.32)) : Math.round(iconSize * 0.2),
      }}
    >
      {showIcon ? (iconFirst ? iconBox : content) : content}
      {showIcon ? (iconFirst ? content : iconBox) : null}
    </div>
  );
}

// Fixed marker sizes (px) for the small / medium / large buckets; 'scale'
// tracks the label font size instead (see above).
const MARKER_FIXED_PX: Record<Exclude<TextSize, 'scale'>, number> = {
  sm: 12,
  md: 18,
  lg: 26,
};

// Cross-axis flex mapping for the horizontal text alignment (the label-style
// ALIGN_ITEMS table covers the vertical one).
const X_ALIGN_FLEX: Record<
  import('@livediagram/diagram').TextAlignX,
  'flex-start' | 'center' | 'flex-end'
> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
};
