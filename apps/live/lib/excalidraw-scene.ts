// Excalidraw to board scene (docs/specs/020-import-export/excalidraw-import-export.md "Scene mapping"):
// the one Excalidraw parser behind paste, drop and the Import dialog. Pure: no ids are minted here
// (the landing does that), colours stay light-reference, and everything the scene cannot hold
// becomes a counted note, never a throw.

import type {
  BoardScene,
  SceneAsset,
  SceneConnector,
  SceneItem,
  SceneShape,
  SceneText,
} from './board-scene/scene';
import { absolutePoints, closeIfLoop } from './excalidraw-scene-geometry';
import { EXCALIDRAW_NOTE, SceneNotes, skippedTypeRule } from './excalidraw-scene-notes';
import { fillOf, headOf, readColour, sceneTextOf, strokeOf } from './excalidraw-scene-style';
import type { ExcalidrawElement, ExcalidrawEnvelope } from './excalidraw-types';

/** Excalidraw's `DEFAULT_STROKE_STREAMLINE`. */
export const EXCALIDRAW_DEFAULT_STREAMLINE = 0.5;
/** Excalidraw's default `labelPosition`: the middle of the arrow. */
export const EXCALIDRAW_LABEL_POSITION_MIDDLE = 0.5;
/** Excalidraw's sticky-note yellow, for a note whose fill can't be read. */
export const EXCALIDRAW_STICKY_FILL = '#ffdf6b';

const SHAPES: Record<string, SceneShape['shape']> = {
  rectangle: 'rectangle',
  ellipse: 'ellipse',
  diamond: 'diamond',
};
/** Types whose bound text becomes their label. */
const LABELLED = new Set(['rectangle', 'ellipse', 'diamond', 'stickynote', 'arrow']);
/** Types that land as an item. */
const MAPPED = new Set([
  ...Object.keys(SHAPES),
  'text',
  'freedraw',
  'line',
  'arrow',
  'stickynote',
  'frame',
  'magicframe',
  'image',
]);

const num = (v: unknown, fallback = 0) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/** Order by fractional `index` when every element has one (stable), else array order. */
function inSceneOrder(elements: ExcalidrawElement[]): ExcalidrawElement[] {
  if (!elements.every((e) => typeof e.index === 'string')) return elements;
  return elements
    .map((e, at) => ({ e, at }))
    .sort((a, b) => (a.e.index! < b.e.index! ? -1 : a.e.index! > b.e.index! ? 1 : a.at - b.at))
    .map(({ e }) => e);
}

function boxOf(el: ExcalidrawElement) {
  const angle = num(el.angle);
  return {
    x: num(el.x),
    y: num(el.y),
    width: Math.max(1, num(el.width, 1)),
    height: Math.max(1, num(el.height, 1)),
    ...(angle !== 0 ? { rotationDeg: (angle * 180) / Math.PI } : {}),
  };
}

function commonOf(el: ExcalidrawElement, key: string) {
  return {
    key,
    ...(el.locked === true ? { locked: true } : {}),
    ...(typeof el.link === 'string' && el.link ? { link: el.link } : {}),
  };
}

export function excalidrawToBoardScene(envelope: ExcalidrawEnvelope): BoardScene {
  const notes = new SceneNotes();
  const elements = inSceneOrder(envelope.elements);
  const keyOf = new Map<ExcalidrawElement, string>();
  elements.forEach((e, at) => {
    keyOf.set(e, typeof e.id === 'string' && e.id ? e.id : `excalidraw-${at}`);
  });
  const byId = new Map<string, ExcalidrawElement>();
  for (const e of elements) if (e.id) byId.set(e.id, e);

  // Bound text a container takes as its label; the text itself does not land.
  const labelOf = new Map<string, ExcalidrawElement>();
  for (const e of elements) {
    if (e.type !== 'text' || !e.containerId) continue;
    const container = byId.get(e.containerId);
    if (container && LABELLED.has(container.type ?? '')) labelOf.set(e.containerId, e);
  }
  const consumed = new Set(labelOf.values());

  // Keys of everything that lands, so an arrow can bind to an element later in the order.
  const landing = new Set<string>();
  for (const e of elements) {
    if (!consumed.has(e) && MAPPED.has(e.type ?? '')) landing.add(keyOf.get(e)!);
  }

  const labelText = (container: ExcalidrawElement): SceneText | undefined => {
    const t = container.id ? labelOf.get(container.id) : undefined;
    return t ? sceneTextOf(t, notes) : undefined;
  };

  const groups = new Set<string>();
  const items: SceneItem[] = [];
  const assetKeys = new Set<string>();
  const assets: SceneAsset[] = [];

  for (const el of elements) {
    if (consumed.has(el)) continue;
    const key = keyOf.get(el)!;
    const type = el.type ?? '';
    if (!MAPPED.has(type)) {
      notes.add(skippedTypeRule(type || 'unknown'), 'skipped');
      continue;
    }
    for (const g of Array.isArray(el.groupIds) ? el.groupIds : []) {
      if (typeof g === 'string') groups.add(g);
    }
    const common = commonOf(el, key);

    if (SHAPES[type]) {
      const fill = fillOf(el, notes);
      const label = labelText(el);
      items.push({
        ...common,
        kind: 'shape',
        shape: SHAPES[type]!,
        ...boxOf(el),
        ...(el.roundness ? { rounded: true } : {}),
        stroke: strokeOf(el, notes),
        ...(fill ? { fill } : {}),
        ...(label ? { label } : {}),
      });
    } else if (type === 'text') {
      items.push({
        ...common,
        kind: 'text',
        ...boxOf(el),
        autoWidth: el.autoResize !== false,
        text: sceneTextOf(el, notes),
      });
    } else if (type === 'freedraw') {
      items.push(inkOf(el, common, notes));
    } else if (type === 'line') {
      items.push(polylineOf(el, common, notes));
    } else if (type === 'arrow') {
      items.push(connectorOf(el, common, notes, landing, labelOf));
    } else if (type === 'stickynote') {
      const read = readColour(el.backgroundColor);
      const text = labelText(el);
      items.push({
        ...common,
        kind: 'sticky',
        ...boxOf(el),
        fill: read.kind === 'colour' ? read.colour : { hex: EXCALIDRAW_STICKY_FILL },
        ...(text ? { text } : {}),
      });
    } else if (type === 'frame' || type === 'magicframe') {
      items.push({
        ...common,
        kind: 'frame',
        ...boxOf(el),
        ...(typeof el.name === 'string' && el.name ? { name: el.name } : {}),
      });
    } else {
      // image
      const asset = typeof el.fileId === 'string' && el.fileId ? el.fileId : key;
      items.push({
        ...common,
        kind: 'image',
        ...boxOf(el),
        asset,
        ...(el.crop && typeof el.crop === 'object' ? { crop: true } : {}),
      });
      const dataUrl = envelope.files[asset]?.dataURL;
      if (!assetKeys.has(asset) && typeof dataUrl === 'string' && dataUrl) {
        assetKeys.add(asset);
        assets.push({ key: asset, source: { kind: 'data-url', dataUrl } });
      }
    }
  }
  notes.add(EXCALIDRAW_NOTE.groups, 'degraded', groups.size);

  const scene: BoardScene = {
    source: 'excalidraw',
    authoredOn: 'unknown',
    items,
    assets,
    notes: notes.list(),
  };
  const background = backgroundOf(envelope);
  if (background) scene.background = background;
  return scene;
}

function inkOf(
  el: ExcalidrawElement,
  common: ReturnType<typeof commonOf>,
  notes: SceneNotes,
): SceneItem {
  const raw = Array.isArray(el.points) ? el.points : [];
  const pressures =
    el.simulatePressure === false &&
    Array.isArray(el.pressures) &&
    el.pressures.length === raw.length
      ? el.pressures
      : undefined;
  const variable = el.strokeOptions?.variability !== 'constant';
  if (variable && !pressures) notes.add(EXCALIDRAW_NOTE.taperedStrokes);
  const { points, closed } = closeIfLoop(absolutePoints(el, pressures));
  const streamline = el.strokeOptions?.streamline;
  const fill = fillOf(el, notes);
  return {
    ...common,
    kind: 'ink',
    points,
    stroke: lineStrokeOf(el, notes),
    ...(closed ? { closed } : {}),
    ...(fill ? { fill } : {}),
    streamline:
      typeof streamline === 'number' && streamline >= 0 && streamline <= 1
        ? streamline
        : EXCALIDRAW_DEFAULT_STREAMLINE,
  };
}

function headsOf(el: ExcalidrawElement, notes: SceneNotes, defaultEnd: boolean) {
  const start = headOf(el.startArrowhead, notes);
  const end = defaultEnd && !('endArrowhead' in el) ? 'arrow' : headOf(el.endArrowhead, notes);
  return { ...(start ? { start } : {}), ...(end ? { end } : {}) };
}

function polylineOf(
  el: ExcalidrawElement,
  common: ReturnType<typeof commonOf>,
  notes: SceneNotes,
): SceneItem {
  const { points, closed } = closeIfLoop(absolutePoints(el), el.polygon === true);
  const heads = headsOf(el, notes, false);
  const fill = closed ? fillOf(el, notes) : undefined;
  return {
    ...common,
    kind: 'polyline',
    points,
    stroke: lineStrokeOf(el, notes),
    ...(closed ? { closed } : {}),
    ...(el.roundness && points.length >= 3 ? { curved: true } : {}),
    ...(fill ? { fill } : {}),
    ...(heads.start || heads.end ? { heads } : {}),
  };
}

function connectorOf(
  el: ExcalidrawElement,
  common: ReturnType<typeof commonOf>,
  notes: SceneNotes,
  landing: Set<string>,
  labelOf: Map<string, ExcalidrawElement>,
): SceneConnector {
  const points = absolutePoints(el);
  const bound = (b: ExcalidrawElement['startBinding']) =>
    b && typeof b.elementId === 'string' && landing.has(b.elementId) ? b.elementId : undefined;
  const from = bound(el.startBinding);
  const to = bound(el.endBinding);
  const labelEl = el.id ? labelOf.get(el.id) : undefined;
  if (
    labelEl &&
    typeof labelEl.labelPosition === 'number' &&
    labelEl.labelPosition !== EXCALIDRAW_LABEL_POSITION_MIDDLE
  ) {
    notes.add(EXCALIDRAW_NOTE.labelPosition);
  }
  return {
    ...common,
    kind: 'connector',
    points,
    stroke: lineStrokeOf(el, notes),
    ...(el.roundness && el.elbowed !== true && points.length >= 3 ? { curved: true } : {}),
    heads: headsOf(el, notes, true),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(labelEl ? { label: sceneTextOf(labelEl, notes) } : {}),
  };
}

function backgroundOf(envelope: ExcalidrawEnvelope): BoardScene['background'] {
  const app = envelope.appState;
  if (!app) return undefined;
  const read = readColour(app.viewBackgroundColor);
  const background: NonNullable<BoardScene['background']> = {};
  if (read.kind === 'colour') background.colour = read.colour;
  if (app.gridModeEnabled === true) background.pattern = 'grid';
  return Object.keys(background).length > 0 ? background : undefined;
}

/** A line always draws: a `transparent` one keeps its width in the board's ink. */
function lineStrokeOf(el: ExcalidrawElement, notes: SceneNotes) {
  return (
    strokeOf(el, notes) ?? { ...strokeOf({ ...el, strokeColor: '#000000' }, notes)!, colour: 'ink' }
  );
}
