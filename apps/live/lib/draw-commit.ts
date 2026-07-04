import { ARROW_SNAP_THRESHOLD_PX, inheritedSizeFor } from '@/lib/canvas';
import {
  COMPONENT_SIZE,
  createComponent,
  createImage,
  createShape,
  createSticky,
  createText,
  scaleElements,
  snapToArrowPoint,
  type ArrowElement,
  type ComponentKind,
  type Element,
  type Endpoint,
  type Tab,
} from '@livediagram/diagram';
import { deriveNewBoxedColours } from '@/lib/themes';
import type { ThemeDefinition } from '@livediagram/diagram';
import { isTechIconId } from '@/lib/tech-icons';
import type { PendingDraw } from '@/lib/draw-mode';

// The pure element construction behind commitDraw (spec/09 draw-to-add),
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

export const isDrawTap = (startX: number, startY: number, endX: number, endY: number): boolean =>
  Math.abs(endX - startX) < TAP_TRAVEL_PX && Math.abs(endY - startY) < TAP_TRAVEL_PX;

// Arrow branch. A stray click lays the default 160px horizontal arrow
// across the click point (so the user isn't left wondering why nothing
// appeared); a real drag uses the dragged endpoints as-is. Y is always
// anchored at startY for a click (a click wants a flat line). Each
// drawn endpoint snaps onto a nearby arrow's line at draw time
// (spec/50) so drawing a message onto another arrow connects
// immediately; a stray click lays the placeholder free (no snapping).
export function buildDrawnArrow(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  elements: Element[],
  theme: ThemeDefinition,
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
    arrowEnds: 'none',
    strokeColor: theme.elementStroke ?? NEW_ARROW_THEME_STROKE_FALLBACK,
  };
}

// Component branch (spec/09): build the composite at the theme's
// colours, then a tap drops it at its natural size centred on the tap,
// while a drag scales the whole group uniformly to fill the dragged box
// (keeps proportions; pinned connectors follow).
export function buildDrawnComponent(
  kind: ComponentKind,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  theme: ThemeDefinition,
): Element[] {
  const colors = {
    accent: theme.elementStroke ?? '#0284c7',
    surface: theme.elementFill ?? '#ffffff',
    ink: theme.elementText ?? '#0f172a',
  };
  const def = COMPONENT_SIZE[kind];
  const isTap = isDrawTap(startX, startY, endX, endY);
  const centreX = isTap ? startX : (startX + endX) / 2;
  const centreY = isTap ? startY : (startY + endY) / 2;
  const made = createComponent(kind, centreX, centreY, colors);
  if (isTap) return made;
  const dragW = Math.max(TAP_TRAVEL_PX, Math.abs(endX - startX));
  const dragH = Math.max(TAP_TRAVEL_PX, Math.abs(endY - startY));
  const s = Math.min(8, Math.max(0.25, Math.max(dragW / def.width, dragH / def.height)));
  return scaleElements(made, centreX, centreY, s);
}

// Boxed branch (shape / text / sticky / image). A tap drops the element
// centred on the tap at its inherited size (the armed-time selection's
// size, else the factory default; circle/diamond stay square); a real
// drag sizes it to the dragged box (16px floor). Mirrors the arrow
// branch's stray-click handling.
export function buildDrawnBoxed(
  intent: Extract<PendingDraw, { type: 'shape' | 'text' | 'sticky' | 'image' }>,
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
      ? createShape(intent.kind, startX, startY)
      : intent.type === 'text'
        ? createText(startX, startY)
        : intent.type === 'sticky'
          ? createSticky(startX, startY)
          : createImage(startX, startY);
  const tapSize = inheritedSizeFor(base, inheritFrom);
  const width = isTap ? tapSize.width : Math.max(TAP_TRAVEL_PX, Math.abs(endX - startX));
  const height = isTap ? tapSize.height : Math.max(TAP_TRAVEL_PX, Math.abs(endY - startY));
  const x = isTap ? startX - width / 2 : Math.min(startX, endX);
  const y = isTap ? startY - height / 2 : Math.min(startY, endY);
  const colours = deriveNewBoxedColours(base, {
    backgroundColor: activeTab.backgroundColor,
    patternColor: activeTab.patternColor,
    theme: activeTab.theme,
  });
  // Seed the tab's default text size onto the new element (spec/28).
  return {
    ...base,
    ...colours,
    x,
    y,
    width,
    height,
    ...(activeTab.defaultTextSize ? { textSize: activeTab.defaultTextSize } : {}),
    // Icon draw intent: carry the chosen glyph id + seed label onto the
    // freshly-drawn 'icon' shape (so palette icons / tech icons draw to
    // size like any shape, see draw-mode.ts).
    ...(intent.type === 'shape' && intent.iconId
      ? { iconId: intent.iconId, ...(intent.label ? { label: intent.label } : {}) }
      : {}),
    // Technology marks render at a fixed size (spec/41), so warping the
    // box can't warp the mark — the aspect lock createShape('icon') bakes
    // in would only fight resizing the caption room, so drop it.
    ...(intent.type === 'shape' && intent.iconId && isTechIconId(intent.iconId)
      ? { aspectLocked: false }
      : {}),
  } as typeof base;
}
