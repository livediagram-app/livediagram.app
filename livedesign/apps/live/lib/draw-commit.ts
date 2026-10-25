import { isFixedSizeShape } from '@livedesign/design';
import { ARROW_SNAP_THRESHOLD_PX, inheritedSizeFor } from '@/lib/canvas';
import {
  createComponent,
  createImage,
  createLinkCard,
  applyShapeVariant,
  createShape,
  createSticky,
  createTable,
  createText,
  createVideo,
  defaultIconAnimation,
  snapToArrowPoint,
  type ArrowElement,
  type ArrowEnds,
  type ComponentKind,
  type Element,
  type Endpoint,
  type Tab,
} from '@livedesign/design';
import { deriveNewBoxedColours } from '@/lib/themes';
import type { ThemeDefinition } from '@livedesign/design';
import { isTechIconId } from '@liveworkspace/workbench/lib/tech-icons';
import { getSticker, stickerDropSize } from '@liveworkspace/workbench/lib/stickers';
import type { PendingDraw } from '@/lib/draw-mode';

// The pure element construction behind commitDraw (docs/specs/008-canvas/canvas-and-palette.md draw-to-add),
// lifted out of useShapeDrawing: each builder interprets the gesture's
// raw start + end canvas points for its intent kind (box vs line vs
// composite) and returns the minted element(s). The hook stays the
// owner of everything stateful — the functional commit, selection,
// telemetry, and the image-picker follow-up.

// Stroke for a new arrow when the active theme has no explicit
// `elementStroke` (the Brand theme). brand-500 — matches the shape
// default stroke (`defaultStrokeColor`) so an added arrow reads as the
// accent like every other new element, instead of ArrowView's slate-700
// fallback (which looked like an un-themed black line + arrowhead).
export const NEW_ARROW_THEME_STROKE_FALLBACK = '#0ea5e9';

// A press with under 16 canvas-px of travel in either axis is a tap /
// stray click rather than a real drag; every intent branch shares the
// same threshold so the two gestures can't disagree.
const TAP_TRAVEL_PX = 16;

const isDrawTap = (startX: number, startY: number, endX: number, endY: number): boolean =>
  Math.abs(endX - startX) < TAP_TRAVEL_PX && Math.abs(endY - startY) < TAP_TRAVEL_PX;

// Largest box of the given aspect (width / height) that fits inside w x h.
// Used by the embed draw (docs/specs/009-elements/youtube-video.md): its 16:9 lock means the drag chooses the
// scale, not the ratio, so the frame is fitted into the drawn box rather than
// stretched to fill it.
function fitToAspect(w: number, h: number, aspect: number): { width: number; height: number } {
  return w / h > aspect ? { width: h * aspect, height: h } : { width: w, height: w / aspect };
}

// The embed's locked ratio (docs/specs/009-elements/youtube-video.md), read off the factory rather than
// written twice — createVideo's 480x270 IS the definition of 16:9 here.
const EMBED_ASPECT = 16 / 9;

// The box a DRAG lands, in canvas coords: the drawn rectangle as-is for every
// intent except an aspect-locked embed, which is fitted inside it and centred
// on it (docs/specs/009-elements/youtube-video.md). Exported so CanvasDrawPreview outlines exactly the box
// that will commit — previewing the raw drag while the commit fitted it would
// show the user one rectangle and hand them another.
export function drawnDragBox(
  intent: PendingDraw,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): { x: number; y: number; width: number; height: number } {
  const drawnWidth = Math.max(TAP_TRAVEL_PX, Math.abs(endX - startX));
  const drawnHeight = Math.max(TAP_TRAVEL_PX, Math.abs(endY - startY));
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  if (intent.type !== 'video') {
    return { x: left, y: top, width: drawnWidth, height: drawnHeight };
  }
  const fitted = fitToAspect(drawnWidth, drawnHeight, EMBED_ASPECT);
  return {
    // Centre the slack, so the frame sits where the user aimed rather than
    // hugging one corner of the box they drew.
    x: left + (drawnWidth - fitted.width) / 2,
    y: top + (drawnHeight - fitted.height) / 2,
    ...fitted,
  };
}

// Arrow branch. A stray click lays the default 160px horizontal arrow
// across the click point (so the user isn't left wondering why nothing
// appeared); a real drag uses the dragged endpoints as-is. Y is always
// anchored at startY for a click (a click wants a flat line). Each
// drawn endpoint snaps onto a nearby arrow's line at draw time
// (docs/specs/008-canvas/arrow-to-arrow.md) so drawing a message onto another arrow connects
// immediately; a stray click lays the placeholder free (no snapping).
export function buildDrawnArrow(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  elements: Element[],
  theme: ThemeDefinition,
  // The Line / Arrow tiles' heads.
  opts: { ends?: ArrowEnds } = {},
): ArrowElement {
  const isClick = isDrawTap(startX, startY, endX, endY);
  const arrowStartX = isClick ? startX - 80 : startX;
  const arrowEndX = isClick ? startX + 80 : endX;
  const arrowEndY = isClick ? startY : endY;
  const snapDrawn = (x: number, y: number): Endpoint => {
    if (isClick) return { kind: 'free', x, y };
    const hit = snapToArrowPoint({ x, y }, elements, ARROW_SNAP_THRESHOLD_PX, '');
    return hit ? { kind: 'on-arrow', arrowId: hit.arrowId, t: hit.t } : { kind: 'free', x, y };
  };
  return {
    id: crypto.randomUUID(),
    type: 'arrow',
    from: snapDrawn(arrowStartX, startY),
    to: snapDrawn(arrowEndX, arrowEndY),
    arrowEnds: opts.ends ?? 'none',
    strokeColor: theme.elementStroke ?? NEW_ARROW_THEME_STROKE_FALLBACK,
  };
}

// The arrow a draw gesture lands, dressed as it lands: in its tool's remembered style. The live
// preview and the commit both build it here, so what the drag shows is what the release lands,
// down to the stroke width and the arrowhead.
export function buildDressedDrawnArrow(
  intent: Extract<PendingDraw, { type: 'arrow' }>,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  board: { elements: Element[]; theme: ThemeDefinition },
  styleNewElement: <T extends Element>(el: T) => T,
): ArrowElement {
  const drawn = buildDrawnArrow(startX, startY, endX, endY, board.elements, board.theme, {
    ends: intent.ends,
  });
  return styleNewElement(drawn);
}

// Component branch (docs/specs/008-canvas/canvas-and-palette.md, docs/specs/009-elements/web-components-and-no-groups.md): build the component at the theme's
// colours, then a tap drops it at its natural size centred on the tap, while
// a drag sizes it to the dragged box like any shape. A component is one
// element that lays itself out, so it re-flows into the box rather than
// zooming; an aspect-locked one (the Avatar) keeps its square, fitted into
// the box.
export function buildDrawnComponent(
  kind: ComponentKind,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  theme: ThemeDefinition,
): Element {
  const colors = {
    accent: theme.elementStroke ?? '#0284c7',
    surface: theme.elementFill ?? '#ffffff',
    ink: theme.elementText ?? '#0f172a',
  };
  if (isDrawTap(startX, startY, endX, endY)) return createComponent(kind, startX, startY, colors);
  const made = createComponent(kind, (startX + endX) / 2, (startY + endY) / 2, colors);
  if (made.type === 'arrow') return made;
  const box = drawnDragBox({ type: 'component', kind }, startX, startY, endX, endY);
  const side = Math.min(box.width, box.height);
  const size = made.aspectLocked ? { width: side, height: side } : box;
  return {
    ...made,
    ...size,
    x: box.x + (box.width - size.width) / 2,
    y: box.y + (box.height - size.height) / 2,
  };
}

// Boxed branch (shape / text / sticky / image / table / link card / embed).
// A tap drops the element centred on the tap at its inherited size (the
// armed-time selection's size, else the factory default; circle/diamond stay
// square); a real drag sizes it to the dragged box (16px floor). Mirrors the
// arrow branch's stray-click handling.
export function buildDrawnBoxed(
  intent: Extract<
    PendingDraw,
    { type: 'shape' | 'text' | 'sticky' | 'image' | 'table' | 'link-card' | 'video' }
  >,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  inheritFrom: Element | null,
  activeTab: Tab,
) {
  const isTap = isDrawTap(startX, startY, endX, endY);
  const base =
    intent.type === 'shape'
      ? applyShapeVariant(createShape(intent.kind, startX, startY), intent.variant)
      : intent.type === 'text'
        ? createText(startX, startY)
        : intent.type === 'sticky'
          ? createSticky(startX, startY)
          : intent.type === 'table'
            ? createTable(startX, startY)
            : intent.type === 'link-card'
              ? createLinkCard(startX, startY)
              : intent.type === 'video'
                ? // The Media tab has a tile per service (docs/specs/009-elements/embed-providers.md), so the
                  // choice arrives on the intent and lands on the element
                  // here rather than leaving a bare embed to re-point.
                  createVideo(startX, startY, intent.provider)
                : createImage(startX, startY);
  const tapSize = inheritedSizeFor(base, inheritFrom);
  // A fixed-size kind (docs/specs/009-elements/badge.md) ignores the drag entirely: dragging one out
  // still places it, at the one size it is meant to be.
  const fixedSize = base.type === 'shape' && isFixedSizeShape(base.shape);
  // Shared with the live preview so the outline the user sizes against is the
  // box that lands — including the embed's 16:9 fit (docs/specs/009-elements/youtube-video.md).
  const dragBox = drawnDragBox(intent, startX, startY, endX, endY);
  const drawnWidth = fixedSize || isTap ? tapSize.width : dragBox.width;
  const height = fixedSize || isTap ? tapSize.height : dragBox.height;
  // A tapped sticker (docs/specs/010-palette/stickers.md) takes its flavour's aspect rather than the
  // per-kind default: emoji stickers are square, badge pills are wide, and
  // both are the one `sticker` kind, so the default-size table can't say it.
  // A DRAGGED one keeps the box the user dragged, like anything else.
  const width =
    isTap && intent.type === 'shape' && intent.kind === 'sticker' && intent.stickerId
      ? stickerDropSize(getSticker(intent.stickerId), { width: drawnWidth, height }).width
      : drawnWidth;
  const x = isTap ? startX - width / 2 : dragBox.x;
  const y = isTap ? startY - height / 2 : dragBox.y;
  const colours = deriveNewBoxedColours(base, {
    backgroundColor: activeTab.backgroundColor,
    patternColor: activeTab.patternColor,
    theme: activeTab.theme,
  });
  // Seed the tab's default text size onto the new element (docs/specs/004-interface-design/fonts.md).
  const textSize = activeTab.defaultTextSize ? { textSize: activeTab.defaultTextSize } : {};
  return {
    ...base,
    ...colours,
    x,
    y,
    width,
    height,
    ...textSize,
    // Icon draw intent: carry the chosen glyph id + seed label onto the
    // freshly-drawn 'icon' shape (so palette icons / tech icons draw to
    // size like any shape, see draw-mode.ts).
    ...(intent.type === 'shape' && intent.iconId
      ? {
          iconId: intent.iconId,
          ...(intent.label ? { label: intent.label } : {}),
          // The four animated glyphs arrive already moving (docs/specs/008-canvas/canvas-and-palette.md).
          ...(defaultIconAnimation(intent.iconId)
            ? { iconAnimation: defaultIconAnimation(intent.iconId) }
            : {}),
        }
      : {}),
    // Technology marks render at a fixed size (docs/specs/010-palette/technology-icons.md), so warping the
    // box can't warp the mark — the aspect lock createShape('icon') bakes
    // in would only fight resizing the caption room, so drop it.
    ...(intent.type === 'shape' && intent.iconId && isTechIconId(intent.iconId)
      ? { aspectLocked: false }
      : {}),
    // Sticker draw intent (docs/specs/010-palette/stickers.md): carry the chosen art. Lands SQUARE to
    // the canvas — an automatic tilt was tried and dropped, see the spec.
    // Rotation is still available by hand, from the element's Rotation menu.
    ...(intent.type === 'shape' && intent.kind === 'sticker' && intent.stickerId
      ? { stickerId: intent.stickerId }
      : {}),
  } as typeof base;
}
