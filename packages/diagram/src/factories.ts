// Runtime constants come from the './data-shapes' LEAF (not './index'):
// SHAPE_DEFAULT_SIZE reads RAIL_* at module-init time, and a runtime
// read through the index ⇄ factories cycle TDZ-crashes plain-Node ESM
// consumers. `isBoxed` stays on './index' — it's only called inside
// function bodies, after the cycle has settled.
import { DEFAULT_BUTTON_MODE } from './selection-mode';
import {
  CHECKLIST_DEFAULT_ITEMS,
  LINE_DEFAULT_CATEGORIES,
  LINE_DEFAULT_SERIES,
  PIE_DEFAULT_SLICES,
  RAIL_DEFAULT_POINTS,
  RAIL_POINT_STEP_PX,
  RATING_DEFAULT,
} from './data-shapes';
import {
  isBoxed,
  type Anchor,
  type AnnotationElement,
  type LinkCardElement,
  type ArrowElement,
  type Element,
  type ElementId,
  type FreehandElement,
  type ImageElement,
  type ShapeElement,
  type ShapeKind,
  type StickyElement,
  type TableElement,
  type TextElement,
} from './index';

// --- Factories -------------------------------------------------------------

// Default size per shape kind. Uniform 120 for square / circle / diamond,
// natural aspect ratios for the flowchart-vocabulary shapes (cylinder
// taller than wide, parallelogram + hexagon + document wider than tall).
// Exported so the editor can offer "reset to default aspect ratio" — the
// width:height proportion here is each shape's canonical look.
export const SHAPE_DEFAULT_SIZE: Record<ShapeKind, { width: number; height: number }> = {
  square: { width: 120, height: 120 },
  circle: { width: 120, height: 120 },
  diamond: { width: 120, height: 120 },
  cylinder: { width: 100, height: 140 },
  parallelogram: { width: 160, height: 100 },
  hexagon: { width: 140, height: 120 },
  document: { width: 140, height: 110 },
  // Document (spec/100): 420x594 is the A-series root-2 ratio, at a size that
  // reads as a page beside a 120px square without swallowing the canvas.
  page: { width: 420, height: 594 },
  // Stadium / pill — the conventional flowchart "Start / End" terminator
  // shape. Wider than tall by default; the CSS `border-radius: 9999px`
  // render path means the ends stay perfectly semicircular at any
  // aspect ratio the user resizes to.
  stadium: { width: 160, height: 64 },
  // Actor (UML stickman): line-art figure with its label below. Taller
  // than wide and aspect-locked on create so the figure never distorts.
  // Default size hugs the figure tightly — earlier 90×150 left a 38-
  // unit band below the legs which read as wasted padding under bare
  // (unlabelled) stickmen. 90×130 keeps room for a short label
  // (y 112..130) without dominating the box.
  actor: { width: 90, height: 130 },
  // Cloud: a container shape (networking / architecture). Stretches to
  // fit its label like the other flowchart shapes.
  cloud: { width: 180, height: 140 },
  triangle: { width: 130, height: 120 },
  trapezoid: { width: 160, height: 110 },
  star: { width: 130, height: 130 },
  // Speech bubble: wider than tall, with room for the tail beneath the body.
  'speech-bubble': { width: 180, height: 130 },
  // Frame / section: a large container drawn around content, so it starts
  // big. Transparent body (see shape-svg-overlay) with a top-left label.
  frame: { width: 360, height: 260 },
  // UI device frames. Sized to evoke each device's natural aspect
  // ratio at a glance: browser + monitor land on a 4:3-ish landscape
  // (with the monitor a touch taller to leave room for its stand);
  // laptop is wider with a flatter total profile (screen + keyboard
  // base stacked); phone + tablet are portrait at typical phone /
  // tablet ratios.
  browser: { width: 240, height: 160 },
  monitor: { width: 220, height: 170 },
  laptop: { width: 240, height: 150 },
  phone: { width: 90, height: 170 },
  tablet: { width: 140, height: 180 },
  // Smartwatch: a square-ish face with bands above + below, so portrait.
  smartwatch: { width: 110, height: 150 },
  // Curated glyph. Square + aspect-locked on create (set in createShape) so
  // the line art never distorts; the label sits below. Sized generously so a
  // two-line caption (e.g. "Durable Objects") clears the glyph rather than
  // crowding it.
  icon: { width: 120, height: 120 },
  // Progress bar: a wide, short pill. Progress ring: a square donut
  // (aspect-locked on create so it stays circular).
  'progress-bar': { width: 220, height: 44 },
  'progress-ring': { width: 130, height: 130 },
  // Timeline rail: width carries the default points at RAIL_POINT_STEP_PX
  // spacing; height leaves room for the dots + ticks above the line.
  'timeline-rail': { width: RAIL_DEFAULT_POINTS * RAIL_POINT_STEP_PX, height: 96 },
  // Rating: a row of five stars.
  rating: { width: 200, height: 44 },
  // Pie chart: the pie + a legend beside it.
  'pie-chart': { width: 280, height: 180 },
  // Bar chart: bars + a legend beside them.
  'bar-chart': { width: 280, height: 180 },
  // Line chart: axes + lines + a legend; a touch wider for the x-axis labels.
  'line-chart': { width: 320, height: 200 },
  // Code block: room for a dozen-ish monospace lines (spec/82).
  'code-block': { width: 320, height: 180 },
  // Checklist: a card of starter rows (spec/83).
  checklist: { width: 240, height: 180 },
  // Mode button (spec/103): a square-ish tile, sized for an icon ABOVE its
  // label — the shape a toolbar button has, rather than a wide pill that read
  // as just another labelled box.
  'mode-button': { width: 104, height: 96 },
  // Door (spec/104): door-shaped — taller than it is wide, like a door.
  door: { width: 72, height: 112 },
};

// New boxed elements default to Medium text size per spec 09 ("Text size").
export function createShape(kind: ShapeKind, x: number, y: number): ShapeElement {
  const { width, height } = SHAPE_DEFAULT_SIZE[kind];
  const base: ShapeElement = {
    id: crypto.randomUUID(),
    type: 'shape',
    shape: kind,
    x,
    y,
    width,
    height,
    textSize: 'md',
  };
  // Mode button (spec/103): looks like a button, so it arrives pill-shaped
  // with a call to action already written and pointed at Avatar mode — the
  // walkthrough case it exists for. The author retypes the label like any
  // other shape's, and picks a different mode from the element menu.
  if (kind === 'mode-button') {
    return {
      ...base,
      // NO default label: the face reads "Switch to <Mode>", derived from the
      // mode it carries, so re-pointing a button relabels it instead of leaving
      // yesterday's copy on it. An author who types their own label wins — it
      // is still a shape's label — but the useful default is the derived one.
      mode: DEFAULT_BUTTON_MODE,
      // A button has to look pressable BEFORE anyone styles it, and the
      // theme-derived shape fill made it read as one more labelled box on the
      // canvas. So it ships with a real button's colours — a solid brand fill,
      // white text, a soft lift off the surface (spec/86) — as ELEMENT colours,
      // so they behave like any user-picked colour and can still be changed
      // from the menu. deriveNewBoxedColours skips the kind for the same
      // reason it skips a page.
      fillColor: '#0ea5e9',
      strokeColor: '#0284c7',
      textColor: '#ffffff',
      shadow: { offsetX: 0, offsetY: 2, blur: 6, opacity: 0.24 },
      borderRadius: 'lg',
      textSize: 'sm',
      textBold: true,
    };
  }
  // Door (spec/104): ships unpaired (there is nothing to pair with until a
  // second door exists) with a label the author replaces. Warm timber colours
  // rather than the theme's node fill, because a door is scenery you walk
  // through, not a box in the diagram.
  if (kind === 'door') {
    return {
      ...base,
      label: 'Door',
      fillColor: '#b45309',
      strokeColor: '#78350f',
      textColor: '#ffffff',
      borderRadius: 'md',
      textSize: 'sm',
      textBold: true,
      textAlignY: 'bottom',
      // A door has a natural shape: stretched wide it stops reading as one at
      // all (the panel and knob distort with the box). Locking the aspect keeps
      // drag-to-draw and every later resize door-shaped; the user can still
      // unlock it from the menu like any other element.
      aspectLocked: true,
    };
  }
  // Document (spec/100): prose sits TOP-LEFT. Centred body text is the
  // strongest tell that something is a label pretending to be a document,
  // and every other shape defaults to centred.
  if (kind === 'page') {
    return {
      ...base,
      textAlignX: 'left',
      textAlignY: 'top',
      // Paper, explicitly, rather than whatever fill the tab theme gives
      // every other box — a page tinted like the shapes around it stops
      // reading as a page. Set as ELEMENT colours (not a theme entry), so
      // they behave like any user-picked colour and can be changed from the
      // menu; a theme with per-shape overrides can still claim the kind.
      fillColor: '#ffffff',
      strokeColor: '#d4d4d8',
      // A soft lift is the other half of "paper": it sits ON the canvas
      // rather than being drawn into it (spec/86).
      shadow: { offsetX: 0, offsetY: 2, blur: 8, opacity: 0.18 },
      // Body text wants reading size, not the label size a shape defaults to.
      textSize: 'sm',
      // A generous margin, like a word processor's — text running to the
      // edge of a page is the other half of "this isn't paper".
      padding: 'lg',
    };
  }
  // The actor is a figure with its label beneath the legs, not text
  // inside a box. Lock the aspect ratio so resizing never warps the
  // stickman, and default the label to the bottom band.
  if (kind === 'actor') {
    return { ...base, aspectLocked: true, textAlignY: 'bottom' };
  }
  // Icons: aspect-locked so the glyph never warps, label sits beneath
  // the glyph (the icon fills the box, text below reads as a caption).
  if (kind === 'icon') {
    return { ...base, aspectLocked: true, textAlignY: 'bottom' };
  }
  // Frame: a container drawn around other elements. Its label sits in the
  // top-right (like a section title) rather than centred, and the body is
  // transparent (rendered fill-less in shape-svg-overlay) so content shows
  // through.
  if (kind === 'frame') {
    // Frames start with a "Frame" section title in the top-right, padded in
    // off the border so it doesn't touch the outline, so they read as a
    // labelled container the moment they're dropped.
    return { ...base, label: 'Frame', textAlignY: 'top', textAlignX: 'right', padding: 'lg' };
  }
  // Progress ring is drawn as a donut, so lock the aspect ratio to keep it
  // circular. Both progress kinds start half-filled so the fill is visible the
  // moment they're dropped, and default to the `fill` animation — which plays
  // once on drop and holds the filled state (it doesn't loop), so a freshly
  // dropped progress element animates in and stays done.
  if (kind === 'progress-ring') {
    return { ...base, aspectLocked: true, progress: 50, progressAnim: 'fill' };
  }
  if (kind === 'progress-bar') {
    return { ...base, progress: 50, progressAnim: 'fill' };
  }
  // Timeline rail: starts with the default number of points; no label inside
  // (the rail draws its own dots + line). See spec/51.
  if (kind === 'timeline-rail') {
    return { ...base, railCount: RAIL_DEFAULT_POINTS, strokeColor: '#64748b' };
  }
  // Rating: a row of stars, three filled by default, amber accent. See spec/52.
  if (kind === 'rating') {
    return { ...base, rating: RATING_DEFAULT, strokeColor: '#f59e0b' };
  }
  // Pie + bar charts: start with three sample data points; edit from the menu.
  // See spec/53.
  if (kind === 'pie-chart' || kind === 'bar-chart') {
    return { ...base, pieSlices: PIE_DEFAULT_SLICES.map((s) => ({ ...s })) };
  }
  // Line chart: shared categories + a couple of sample series (CSV-importable).
  if (kind === 'line-chart') {
    return {
      ...base,
      lineCategories: [...LINE_DEFAULT_CATEGORIES],
      lineSeries: LINE_DEFAULT_SERIES.map((s) => ({ ...s, values: [...s.values] })),
    };
  }
  // Code block: empty snippet, plain language; the view renders a
  // double-click-to-edit placeholder until code lands. See spec/82.
  if (kind === 'code-block') {
    return { ...base, codeLanguage: 'plain' };
  }
  // Checklist: starter rows so the affordance is obvious on drop. See spec/83.
  if (kind === 'checklist') {
    return { ...base, checklistItems: CHECKLIST_DEFAULT_ITEMS.map((i) => ({ ...i })) };
  }
  return base;
}

export function createText(x: number, y: number): TextElement {
  return {
    id: crypto.randomUUID(),
    type: 'text',
    x,
    y,
    width: 220,
    height: 64,
    label: 'Text',
    // Standalone text renders at the fixed px for its size (sm = 14px), and a
    // text element is plain text on the canvas, not a label inside a box, so
    // 'md' (22px) read oversized — especially on a phone. Default to 'sm';
    // the user can bump it from the edit toolbar.
    textSize: 'sm',
  };
}

// A fresh 3x3 table with an empty header row. Sized so the default
// cells are comfortably clickable; the grid divides the box evenly.
export function createTable(x: number, y: number): TableElement {
  const rows = 3;
  const cols = 3;
  return {
    id: crypto.randomUUID(),
    type: 'table',
    x,
    y,
    width: 360,
    height: 150,
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')),
    headerRow: true,
    textSize: 'md',
  };
}

export function createSticky(x: number, y: number): StickyElement {
  return {
    id: crypto.randomUUID(),
    type: 'sticky',
    x,
    y,
    width: 200,
    height: 200,
    textSize: 'md',
  };
}

// Fixed marker size for an annotation (see specs/38). It never resizes, so
// this is its size for life; `inheritedSizeFor` keeps it at this regardless
// of the current selection.
const ANNOTATION_SIZE = 44;

// A note marker dropped at (x, y). The note text starts empty — the user
// clicks the marker to add it. Aspect-locked by default so resizing keeps
// the marker round (spec/38).
export function createAnnotation(x: number, y: number): AnnotationElement {
  return {
    id: crypto.randomUUID(),
    type: 'annotation',
    x,
    y,
    width: ANNOTATION_SIZE,
    height: ANNOTATION_SIZE,
    aspectLocked: true,
  };
}

// A link-card / bookmark (spec/40) at (x, y). No link yet — the user sets
// the URL via the link picker, and the editor fills `meta` from the unfurl
// endpoint. Default size suits a favicon + title row above an optional image.
export function createLinkCard(x: number, y: number): LinkCardElement {
  return {
    id: crypto.randomUUID(),
    type: 'link-card',
    x,
    y,
    width: 280,
    height: 120,
  };
}

// Scale a set of elements uniformly about (ox, oy) — used to drag-to-draw a
// component to size (spec/09). Boxed elements scale position + size; arrows
// scale only their FREE endpoints (pinned ones track their elements). Font
// sizes are unchanged (matches group resize).
export function scaleElements(elements: Element[], ox: number, oy: number, s: number): Element[] {
  return elements.map((el) => {
    if (isBoxed(el)) {
      return {
        ...el,
        x: ox + (el.x - ox) * s,
        y: oy + (el.y - oy) * s,
        width: el.width * s,
        height: el.height * s,
      };
    }
    const from =
      el.from.kind === 'free'
        ? { ...el.from, x: ox + (el.from.x - ox) * s, y: oy + (el.from.y - oy) * s }
        : el.from;
    const to =
      el.to.kind === 'free'
        ? { ...el.to, x: ox + (el.to.x - ox) * s, y: oy + (el.to.y - oy) * s }
        : el.to;
    return { ...el, from, to };
  });
}

// Spawns an image element in the empty-state (placeholder) shape. The
// imageId stays null until the user picks an image from the picker;
// the renderer shows the upload affordance in the meantime.
export function createImage(x: number, y: number): ImageElement {
  return {
    id: crypto.randomUUID(),
    type: 'image',
    x,
    y,
    width: 200,
    height: 150,
    imageId: null,
    // Aspect-lock default: once a real image lands, the lock keeps
    // its width:height ratio. Holding Shift while resizing the
    // corner handle breaks it via the existing aspect-lock toggle.
    aspectLocked: true,
  };
}

// Mints a freehand element from raw canvas-coord points. Caller is
// responsible for the simplification + smoothing decision (see
// `simplifyPolyline` and `catmullRomToBezierPath` below); this just
// computes the bounding box and normalises the points into [0..1]
// inside it so the saved element resizes proportionally without the
// renderer needing the original canvas coords back. A degenerate
// (single-point) gesture returns a 1x1 box with one normalised point
// at the origin, which the caller can detect and reject.
export function createFreehand(
  rawPoints: { x: number; y: number }[],
  closed: boolean,
): FreehandElement {
  if (rawPoints.length === 0) {
    return {
      id: crypto.randomUUID(),
      type: 'freehand',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      points: [],
      closed,
    };
  }
  let minX = rawPoints[0]!.x;
  let maxX = rawPoints[0]!.x;
  let minY = rawPoints[0]!.y;
  let maxY = rawPoints[0]!.y;
  for (const p of rawPoints) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  // Pad the box by a single pixel on each side so a perfectly
  // straight line (zero width OR zero height) still has a non-zero
  // dimension to normalise against. Without this, dividing by 0
  // produces NaN points and the renderer breaks.
  const PAD = 1;
  const width = Math.max(1, maxX - minX + PAD * 2);
  const height = Math.max(1, maxY - minY + PAD * 2);
  const ox = minX - PAD;
  const oy = minY - PAD;
  const points = rawPoints.map((p) => ({
    nx: (p.x - ox) / width,
    ny: (p.y - oy) / height,
  }));
  return {
    id: crypto.randomUUID(),
    type: 'freehand',
    x: ox,
    y: oy,
    width,
    height,
    points,
    closed,
  };
}

export function createArrow(fromX: number, fromY: number, toX: number, toY: number): ArrowElement {
  return {
    id: crypto.randomUUID(),
    type: 'arrow',
    from: { kind: 'free', x: fromX, y: fromY },
    to: { kind: 'free', x: toX, y: toY },
  };
}

export function createPinnedArrow(
  fromId: ElementId,
  fromAnchor: Anchor,
  toId: ElementId,
  toAnchor: Anchor,
): ArrowElement {
  return {
    id: crypto.randomUUID(),
    type: 'arrow',
    from: { kind: 'pinned', elementId: fromId, anchor: fromAnchor },
    to: { kind: 'pinned', elementId: toId, anchor: toAnchor },
  };
}
