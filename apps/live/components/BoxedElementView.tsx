import { memo, type PointerEvent as ReactPointerEvent } from 'react';
import {
  activeCommentCount,
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
  PADDING_PX,
  type Anchor,
  type BoxedElement,
  type FreehandElement,
  type TextSize,
} from '@livediagram/diagram';
import type { DragMode } from '@/lib/canvas';
import { initialsOf } from '@/lib/identity';
import {
  FixedSizeLabel,
  MultilineLabel,
  MultilineLabelEditor,
  ScalingLabel,
  SingleLineLabelEditor,
} from './element-labels';
import { LockBadge, ResizeHandles, RotateHandle } from './element-parts';
import { ImageElementView } from './ImageElementView';
import { isSvgRenderedShape, ShapeSvgOverlay } from './shape-svg-overlay';
import { IconGlyph } from './icon-glyph';
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
  onCommitCells: (id: string, cells: string[][]) => void;
  onCommitColWidths: (id: string, colWidths: (number | null)[]) => void;
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
  onCommitCells,
  onCommitColWidths,
  onCancelEdit,
  onFollowLink,
  onOpenComments,
  onOpenNote,
  imageContext,
  onContextSelect,
  remoteSelectors,
  badgeColor,
  tabLocked,
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
          readOnly={isLocked}
          onCommitCells={onCommitCells}
          onCommitColWidths={onCommitColWidths}
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
function RemoteSelectorsStrip({
  zoom,
  selectors,
}: {
  zoom: number;
  selectors: { id: string; name: string; color: string }[];
}) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'left top' }}
      className="pointer-events-none absolute -left-1 -top-1 flex"
    >
      {selectors.map((p, i) => (
        // Margin / z-index live on the outer wrapper so the Tooltip's
        // inline-flex span doesn't disturb the overlap stack.
        <div
          key={p.id}
          style={{
            marginLeft: i === 0 ? 0 : -6,
            zIndex: selectors.length - i,
          }}
        >
          <Tooltip title={p.name} description="is editing this element.">
            <div
              aria-label={`${p.name} is here`}
              style={{ backgroundColor: p.color }}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-white text-[9px] font-semibold text-white shadow-sm"
            >
              {initialsOf(p.name)}
            </div>
          </Tooltip>
        </div>
      ))}
    </div>
  );
}

// Floating cluster at the top-right of the element. Holds the link badge
// (if linked) and the comment badge (if there are unresolved comments) as
// individual buttons inside a single rounded card — same shape language as
// ZoomControls. Counter-scaled so the badges keep their on-screen size at
// any canvas zoom.
function BadgeStrip({
  zoom,
  linked,
  commentCount,
  hasNote,
  badgeColor,
  onFollowLink,
  onOpenComments,
  onOpenNote,
}: {
  zoom: number;
  linked: boolean;
  commentCount: number;
  hasNote: boolean;
  badgeColor: string;
  onFollowLink: () => void;
  onOpenComments: () => void;
  onOpenNote?: () => void;
}) {
  // Order (LTR inside the flex strip, which is anchored to the top-
  // right of the element): link, note, comment. Comment sits at the
  // far right because it's the highest-traffic affordance: an
  // unresolved comment count needs the most visible perch. Note sits
  // to its left, link to the far left.
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'right top' }}
      className="pointer-events-auto absolute -right-1 -top-1 flex items-center gap-0.5 rounded-full border border-slate-200 bg-white p-0.5 shadow-sm"
    >
      {linked ? (
        <BadgeButton label="Follow link" color={badgeColor} onClick={onFollowLink}>
          <LinkBadgeIcon />
        </BadgeButton>
      ) : null}
      {hasNote && onOpenNote ? (
        <BadgeButton label="Open note" color={badgeColor} onClick={onOpenNote}>
          <NoteBadgeIcon />
        </BadgeButton>
      ) : null}
      {commentCount > 0 ? (
        <BadgeButton
          label={`Open ${commentCount} comment${commentCount === 1 ? '' : 's'}`}
          color={badgeColor}
          onClick={onOpenComments}
          dataAttr="data-comment-trigger"
        >
          <CommentBadgeIcon />
          <span className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold leading-none text-white">
            {commentCount}
          </span>
        </BadgeButton>
      ) : null}
    </div>
  );
}

function NoteBadgeIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 2.5h7l3 3v8a0.5 0.5 0 0 1 -0.5 0.5h-9.5a0.5 0.5 0 0 1 -0.5 -0.5v-10.5a0.5 0.5 0 0 1 0.5 -0.5z" />
      <path d="M10 2.5v3h3" />
      <path d="M5.5 9h5M5.5 11.5h5" />
    </svg>
  );
}

function BadgeButton({
  label,
  color,
  onClick,
  dataAttr,
  children,
}: {
  label: string;
  color: string;
  onClick: () => void;
  dataAttr?: string;
  children: React.ReactNode;
}) {
  const extra = dataAttr ? { [dataAttr]: '' } : {};
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      // Theme-driven background via inline style so any hex/rgb the
      // theme provides works — Tailwind utility classes only cover the
      // brand palette. Tailwind keeps the layout / shape.
      style={{ backgroundColor: color }}
      className="relative flex h-5 w-5 items-center justify-center rounded-full text-white shadow-sm transition hover:brightness-110"
      {...extra}
    >
      {children}
    </button>
  );
}

function LinkBadgeIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 4.5l1.5-1.5a3.25 3.25 0 0 1 4.6 4.6L11 9.5" />
      <path d="M9 11.5l-1.5 1.5a3.25 3.25 0 0 1-4.6-4.6L5 7" />
      <line x1="6" y1="10" x2="10" y2="6" />
    </svg>
  );
}

function CommentBadgeIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 4a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 13.5 4v5A1.5 1.5 0 0 1 12 10.5H7l-3 2.5V10.5A1.5 1.5 0 0 1 2.5 9z" />
    </svg>
  );
}

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

function describeVariant(
  element: BoxedElement,
  isSelected: boolean,
  isMultiSelected: boolean,
  remoteBorderColor: string | null,
): { className: string; style: React.CSSProperties } {
  // Multi-selection uses a much louder ring (solid brand-500, offset)
  // so a busy canvas with many selected elements reads unambiguously.
  // Single selection keeps the subtler brand-200 / brand-300 rings.
  const singleRing = (cls: string) => (isSelected && !isMultiSelected ? cls : '');
  const multiRing = isMultiSelected ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-white' : '';
  // When a remote participant has this element selected, draw a thicker
  // 3-pixel border in their colour so the realtime signal is glanceable.
  // We apply it as a box-shadow inset on text (which has no real border)
  // and as an actual border on shape / sticky. The local selection ring
  // stays on top so the active user still sees their own selection.
  const remoteBorderWidth = remoteBorderColor ? 3 : 0;
  switch (element.type) {
    case 'shape': {
      const ring = `${singleRing('ring-2 ring-brand-200')} ${multiRing}`.trim();
      // SVG-rendered shapes (diamond, cylinder, parallelogram, hexagon,
      // document) draw themselves via an inner SVG overlay; the wrapper div
      // carries no border/background, just the selection ring. The
      // border colour for those propagates through ShapeSvgOverlay's
      // `stroke` prop, not this style block.
      if (isSvgRenderedShape(element.shape)) {
        return {
          className: `text-brand-800 ${ring}`,
          style: { borderRadius: '4px' },
        };
      }
      // CSS-rendered shapes (square / circle / stadium and the
      // rectangular device frames). The user-pickable border
      // strength + style apply here as the HTML element's
      // borderWidth / borderStyle; borderRadius only applies to
      // free-corner shapes (NOT circle / stadium, whose radii
      // are part of the silhouette).
      const fixedRadius =
        element.shape === 'circle' ? '50%' : element.shape === 'stadium' ? '9999px' : null;
      const userRadius =
        element.borderRadius !== undefined ? BORDER_RADIUS_PX[element.borderRadius] : null;
      const strokePx = BORDER_STROKE_PX[element.strokeWidth ?? DEFAULT_BORDER_STROKE];
      const dashStyle = (element.strokeStyle ??
        DEFAULT_BORDER_STYLE) as React.CSSProperties['borderStyle'];
      return {
        // Drop the border-2 class so we can drive border width from
        // the user's strokeWidth pick instead of a fixed 2px.
        className: `text-brand-800 shadow-sm ${ring}`,
        style: {
          borderRadius: fixedRadius ?? (userRadius !== null ? `${userRadius}px` : '8px'),
          backgroundColor: element.fillColor ?? defaultFillColor(element),
          borderColor: remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element),
          borderWidth: remoteBorderColor ? remoteBorderWidth : strokePx,
          borderStyle: dashStyle,
        },
      };
    }
    case 'text': {
      const ring = isMultiSelected
        ? multiRing
        : isSelected
          ? 'ring-2 ring-brand-300 ring-offset-2 ring-offset-white'
          : 'ring-1 ring-dashed ring-slate-300';
      return {
        className: `text-slate-800 rounded-sm ${ring}`,
        // Text elements have no real border; render the remote-selector
        // halo as an outline so it shows up regardless of the element
        // having transparent fill.
        style: remoteBorderColor
          ? { outline: `${remoteBorderWidth}px solid ${remoteBorderColor}`, outlineOffset: 2 }
          : {},
      };
    }
    case 'sticky': {
      const ring = `${singleRing('ring-2 ring-brand-200')} ${multiRing}`.trim();
      return {
        className: `border text-amber-950 shadow-md ${ring}`,
        style: {
          borderRadius: '4px',
          backgroundColor: element.fillColor ?? defaultFillColor(element),
          borderColor: remoteBorderColor ?? element.strokeColor ?? defaultStrokeColor(element),
          borderWidth: remoteBorderColor ? remoteBorderWidth : undefined,
        },
      };
    }
    case 'image': {
      // The image element renders its bitmap (or upload placeholder)
      // via the dedicated ImageElementView, which slots in as the
      // children of this wrapper. The wrapper here just contributes
      // the selection ring + remote-selector border, with a
      // transparent background so the bitmap shows through.
      // No overflow-hidden on the wrapper: the lock / comment /
      // note badges sit at -right-1 / -top-1 outside the box, and
      // clipping the wrapper cuts them off (the bitmap clipping
      // happens inside ImageElementView instead).
      const ring = `${singleRing('ring-2 ring-brand-300')} ${multiRing}`.trim();
      return {
        className: `rounded ${ring}`,
        style: {
          borderColor: remoteBorderColor ?? undefined,
          borderWidth: remoteBorderColor ? remoteBorderWidth : undefined,
          borderStyle: remoteBorderColor ? 'solid' : undefined,
        },
      };
    }
    case 'freehand': {
      // The freehand element renders its SVG path as the child
      // content. The wrapper here just contributes the selection
      // ring + remote-selector outline, with a transparent
      // background so the SVG geometry is what the user sees, not
      // a bounding rectangle. Same shape as the image case
      // (selection-via-outline, not selection-via-border) so a
      // dashed / dotted stroke doesn't get overridden by a box
      // border around it.
      const ring = `${singleRing('ring-2 ring-brand-300')} ${multiRing}`.trim();
      return {
        className: `${ring}`,
        style: remoteBorderColor
          ? { outline: `${remoteBorderWidth}px solid ${remoteBorderColor}`, outlineOffset: 2 }
          : {},
      };
    }
    case 'table': {
      // TableView draws the grid + cell borders as the child
      // content; the wrapper only contributes the selection ring
      // (transparent background so the grid is what shows).
      const ring = `${singleRing('ring-2 ring-brand-300')} ${multiRing}`.trim();
      return {
        className: `${ring}`,
        style: remoteBorderColor
          ? { outline: `${remoteBorderWidth}px solid ${remoteBorderColor}`, outlineOffset: 2 }
          : {},
      };
    }
  }
}

function renderLabel(
  element: BoxedElement,
  label: string,
  textSize: TextSize,
  alignX: import('@livediagram/diagram').TextAlignX,
  alignY: import('@livediagram/diagram').TextAlignY,
  padding: number,
  isEditing: boolean,
  onCommitLabel: (label: string) => void,
  onCancelEdit: () => void,
  editCursorAtEnd: boolean,
) {
  const isSticky = element.type === 'sticky';
  // Shape elements don't carry a placeholder during edit. The user
  // is already mid-double-click on a visible shape, so the empty
  // input doesn't need "Label" filler nudging them; the surrounding
  // shape silhouette communicates context already. Sticky notes
  // and standalone text elements DO get a placeholder because their
  // pre-edit affordance is just an empty rectangle / nothing.
  const placeholder = element.type === 'text' ? 'Text' : isSticky ? 'Note' : '';

  const textStyle = {
    bold: element.textBold,
    italic: element.textItalic,
    underline: element.textUnderline,
    strikethrough: element.textStrikethrough,
  };

  if (isEditing) {
    if (isSticky) {
      return (
        <MultilineLabelEditor
          initial={label}
          placeholder={placeholder}
          textSize={textSize}
          alignX={alignX}
          style={textStyle}
          onCommit={onCommitLabel}
          onCancel={onCancelEdit}
          textClassName="text-amber-950 placeholder:text-amber-700/50"
        />
      );
    }
    // Only the placeholder colour is pinned; the typed text inherits
    // the element's resolved textColor (set as `color` on the wrapper)
    // via currentColor, so editing shows the same colour as the
    // committed label instead of snapping to black / brand.
    const textClass =
      element.type === 'text' ? 'placeholder:text-slate-400' : 'placeholder:text-brand-300';
    return (
      <SingleLineLabelEditor
        initial={label}
        placeholder={placeholder}
        textSize={textSize}
        alignX={alignX}
        alignY={alignY}
        padding={padding}
        style={textStyle}
        onCommit={onCommitLabel}
        onCancel={onCancelEdit}
        textClassName={textClass}
        cursorAtEnd={editCursorAtEnd}
      />
    );
  }

  if (isSticky) {
    return (
      <MultilineLabel
        text={label}
        placeholder={placeholder}
        textSize={textSize}
        alignX={alignX}
        alignY={alignY}
        padding={padding}
        className="text-amber-950"
        style={textStyle}
      />
    );
  }

  if (textSize === 'scale') {
    if (!label) return null;
    return (
      <ScalingLabel
        text={label}
        alignX={alignX}
        alignY={alignY}
        padding={padding}
        style={textStyle}
      />
    );
  }

  return (
    <FixedSizeLabel
      text={label}
      size={textSize}
      alignX={alignX}
      alignY={alignY}
      padding={padding}
      style={textStyle}
    />
  );
}

// Renders a FreehandElement's stored polyline as a smooth SVG path.
// Points are stored normalised into [0..1] within the element's
// bounding box (see createFreehand), so the renderer maps them into
// viewBox [0..100] and lets `preserveAspectRatio="none"` stretch the
// curve when the user resizes. The stroke colour comes from theme
// (with the per-element override), matching how other boxed elements
// pick their accent.
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
