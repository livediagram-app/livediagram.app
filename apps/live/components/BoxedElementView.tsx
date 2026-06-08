import { memo, type PointerEvent as ReactPointerEvent } from 'react';
import {
  activeCommentCount,
  BORDER_DASH_ARRAY,
  BORDER_STROKE_PX,
  catmullRomToBezierPath,
  DEFAULT_BORDER_STROKE,
  DEFAULT_BORDER_STYLE,
  defaultFillColor,
  defaultPadding,
  defaultStrokeColor,
  defaultTextAlign,
  defaultTextColor,
  PADDING_PX,
  type Anchor,
  type BoxedElement,
  type FreehandElement,
  type TextSize,
} from '@livediagram/diagram';
import type { DragMode } from '@/lib/canvas';
import { renderLabel } from './element-labels';
import { LockBadge, ResizeHandles, RotateHandle } from './element-parts';
import { ImageElementView } from './ImageElementView';
import { isSvgRenderedShape, ShapeSvgOverlay } from './shape-svg-overlay';
import { describeVariant } from './element-variant';
import { BadgeStrip, RemoteSelectorsStrip } from './element-badges';
import { IconGlyph } from './icon-glyph';
import { TableView } from './TableView';

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
  onBeginRotate: (
    id: string,
    centerClientX: number,
    centerClientY: number,
    e: ReactPointerEvent,
  ) => void;
  // Shift-click on an element fires this with the element id so the
  // page can toggle membership in the marquee multi-selection.
  onShiftSelect?: (id: string) => void;
  onBeginAnchorDrag: (id: string, anchor: Anchor, e: ReactPointerEvent) => void;
  // Element-id-bearing signatures so the parent can pass a single
  // stable callback per kind (rather than recreating a closure per
  // element on every render). The child has `element.id` in scope
  // and forwards it where needed. This is what makes the React.memo
  // wrapper around the export viable: with pre-bound callbacks,
  // every parent render would invalidate the memo via fresh function
  // identities.
  onBeginEdit: (id: string) => void;
  onCommitLabel: (id: string, label: string) => void;
  onCommitTable: (
    id: string,
    patch: Partial<
      Pick<
        import('@livediagram/diagram').TableElement,
        'cells' | 'colWidths' | 'rowHeights' | 'cellStyles'
      >
    >,
  ) => void;
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
  // True for view-role share visitors (session read-only). Shape / text
  // editing is blocked upstream in the editing handlers, but the table
  // edits in-component (TableView's own cell double-click + menus), so it
  // needs the flag passed through to stay read-only for viewers.
  readOnly: boolean;
  // Other participants whose realtime selection is currently on this
  // element. Rendered as a small initial-badge stack at the top-left
  // (opposite the link / comment badges).
  remoteSelectors: { id: string; name: string; color: string }[];
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
  onBeginRotate,
  onShiftSelect,
  onBeginAnchorDrag,
  onBeginEdit,
  onCommitLabel,
  onCommitTable,
  onCancelEdit,
  onFollowLink,
  onOpenComments,
  onOpenNote,
  imageContext,
  onContextSelect,
  remoteSelectors,
  badgeColor,
  tabLocked,
  readOnly,
}: BoxedElementViewProps) {
  const isLocked = element.locked === true || tabLocked;
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

  const handleShapeDown = (e: ReactPointerEvent) => {
    if (isEditing) return;
    e.stopPropagation();
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
    // Don't gate on isPaintMode here (the page-level beginEdit decides whether
    // edit can start; it rejects during format painter, and exits group mode).
    onBeginEdit(element.id);
  };

  // Right-click selects the element + asks the page to open a
  // context menu at the cursor. The page also keeps showing the
  // SelectionPopover (handled by the normal selection flow), so the
  // context menu is an additional surface, not a replacement.
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isEditing) return;
    onContextSelect(element.id, e.clientX, e.clientY);
  };

  const cursor = isPaintMode
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
  const variant = describeVariant(element, isSelected, isMultiSelected, remoteBorderColor);

  const commentCount = activeCommentCount(element.commentThread);
  // Both 'tab' and 'diagram' kinds get the "linked" badge; the
  // follow-handler dispatches off the kind via the parent's
  // onFollowLink callback. 'element' kind is the spec'd
  // jump-and-focus that isn't surfaced in the UI yet.
  const linked =
    element.link !== undefined && (element.link.kind === 'tab' || element.link.kind === 'diagram');

  return (
    <div
      data-element-id={element.id}
      onPointerDown={handleShapeDown}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      className={`absolute origin-center animate-pop-in touch-none select-none ${variant.className} ${cursor}`}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        color: textColor,
        opacity: element.opacity ?? 1,
        ...variant.style,
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
      {element.type === 'shape' && element.shape === 'icon' ? (
        // Curated glyph: line art tinted by the element's stroke
        // colour. Rendered separately from ShapeSvgOverlay because it
        // keeps aspect ratio (the catalogue art must not warp) and is
        // data-driven by `iconId`.
        <IconGlyph
          iconId={element.iconId}
          stroke={remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element)}
          strokeWidth={remoteBorderColor ? 3 : 2}
          hasLabel={(element.label ?? '').trim().length > 0}
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

      {element.type === 'image' && imageContext ? (
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
          {isEditing || label.length > 0
            ? renderLabel(
                element,
                label,
                textSize,
                alignX,
                alignY,
                PADDING_PX[element.padding ?? defaultPadding(element)],
                isEditing,
                (next) => onCommitLabel(element.id, next),
                onCancelEdit,
                editCursorAtEnd,
              )
            : null}
        </>
      ) : element.type === 'table' ? (
        <TableView
          element={element}
          isSelected={isSelected}
          readOnly={isLocked || readOnly}
          onCommitTable={onCommitTable}
        />
      ) : (
        renderLabel(
          element,
          label,
          textSize,
          alignX,
          alignY,
          PADDING_PX[element.padding ?? defaultPadding(element)],
          isEditing,
          (next) => onCommitLabel(element.id, next),
          onCancelEdit,
          editCursorAtEnd,
        )
      )}

      {isLocked ? <LockBadge zoom={zoom} /> : null}

      {remoteSelectors.length > 0 ? (
        <RemoteSelectorsStrip zoom={zoom} selectors={remoteSelectors} />
      ) : null}

      {linked || commentCount > 0 || (element.note && onOpenNote) ? (
        <BadgeStrip
          zoom={zoom}
          linked={linked}
          commentCount={commentCount}
          hasNote={!!element.note && !!onOpenNote}
          badgeColor={badgeColor}
          onFollowLink={() => {
            if (element.link) onFollowLink(element.link);
          }}
          onOpenComments={() => onOpenComments(element.id)}
          onOpenNote={onOpenNote ? () => onOpenNote(element.id) : undefined}
        />
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
          {showHandles && !isRotated ? (
            <ResizeHandles elementId={element.id} zoom={zoom} onBeginDrag={onBeginDrag} />
          ) : null}

          {showHandles ? (
            <RotateHandle elementId={element.id} zoom={zoom} onBeginRotate={onBeginRotate} />
          ) : null}

          {showAnchors ? (
            <>
              <AnchorDot
                anchor="n"
                elementId={element.id}
                zoom={zoom}
                onBeginAnchorDrag={onBeginAnchorDrag}
              />
              <AnchorDot
                anchor="e"
                elementId={element.id}
                zoom={zoom}
                onBeginAnchorDrag={onBeginAnchorDrag}
              />
              <AnchorDot
                anchor="s"
                elementId={element.id}
                zoom={zoom}
                onBeginAnchorDrag={onBeginAnchorDrag}
              />
              <AnchorDot
                anchor="w"
                elementId={element.id}
                zoom={zoom}
                onBeginAnchorDrag={onBeginAnchorDrag}
              />
            </>
          ) : null}
        </div>
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

const ANCHOR_STYLE: Record<'n' | 'e' | 's' | 'w', React.CSSProperties> = {
  n: { top: 0, left: '50%' },
  e: { top: '50%', left: '100%' },
  s: { top: '100%', left: '50%' },
  w: { top: '50%', left: 0 },
};

// Stack of small circular avatars pinned to the element's top-left. Each
// avatar shows another participant who currently has this element
// selected (per the realtime `select` op). The first avatar is fully
// visible; subsequent ones overlap with a small negative margin so a
// busy element doesn't push the stack across the canvas. Counter-scaled
// like the other badges so the on-screen size doesn't change with zoom.
function AnchorDot({
  anchor,
  elementId,
  zoom,
  onBeginAnchorDrag,
}: {
  anchor: 'n' | 'e' | 's' | 'w';
  elementId: string;
  zoom: number;
  onBeginAnchorDrag: (id: string, anchor: Anchor, e: ReactPointerEvent) => void;
}) {
  return (
    <div
      role="button"
      aria-label={`Create arrow from ${anchor} anchor`}
      onPointerDown={(e) => {
        e.stopPropagation();
        onBeginAnchorDrag(elementId, anchor, e);
      }}
      style={{
        ...ANCHOR_STYLE[anchor],
        // Counter-scale so the dot stays the same on-screen size at any zoom.
        transform: `translate(-50%, -50%) scale(${1 / zoom})`,
      }}
      className="pointer-events-auto absolute h-2.5 w-2.5 cursor-crosshair rounded-full border-2 border-white bg-brand-500 shadow-sm transition"
    />
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
