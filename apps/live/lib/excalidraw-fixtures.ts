// Synthesised Excalidraw content for tests (docs/specs/020-import-export/blueprints/excalidraw-import.md).
// Mirrors the fields a real Excalidraw copy carries (every element type, `index` keys, bindings
// with `mode` / `fixedPoint`, freedraw `strokeOptions`, bound text, sticky notes, frames), so a
// test reads like the clipboard it stands for. Real boards are never fixtures.

import type {
  ExcalidrawElement,
  ExcalidrawEnvelopeType,
  ExcalidrawFiles,
  ExcalidrawPoint,
} from './excalidraw-types';

type Over = Partial<ExcalidrawElement>;

/** A fresh builder: ids `el-1`, `el-2`, … and ascending fractional `index` keys, deterministic. */
export function excalidrawBuilder() {
  let n = 0;
  const next = () => {
    n += 1;
    return { id: `el-${n}`, index: `a${n.toString(36).padStart(3, '0')}` };
  };

  const base = (type: string, over: Over): ExcalidrawElement => ({
    ...next(),
    type,
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    angle: 0,
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: [],
    updated: 1,
    link: null,
    locked: false,
    ...over,
  });

  const linear = (type: string, points: ExcalidrawPoint[], over: Over): ExcalidrawElement => {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    return base(type, {
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
      points,
      ...over,
    });
  };

  return {
    rectangle: (over: Over = {}) => base('rectangle', { roundness: { type: 3 }, ...over }),
    ellipse: (over: Over = {}) => base('ellipse', { roundness: { type: 2 }, ...over }),
    diamond: (over: Over = {}) => base('diamond', { roundness: { type: 2 }, ...over }),
    /** Standalone text: left / top, auto-resizing, Excalifont. */
    text: (text: string, over: Over = {}) =>
      base('text', {
        width: 80,
        height: 25,
        text,
        originalText: text,
        fontSize: 20,
        fontFamily: 5,
        textAlign: 'left',
        verticalAlign: 'top',
        containerId: null,
        autoResize: true,
        lineHeight: 1.25,
        baseFontSize: null,
        labelPosition: null,
        ...over,
      }),
    /** Text bound to `container`: centre / middle, as Excalidraw lays out a label. */
    label: (container: ExcalidrawElement, text: string, over: Over = {}) => {
      const el = base('text', {
        x: (container.x ?? 0) + 10,
        y: (container.y ?? 0) + 10,
        width: 60,
        height: 25,
        text,
        originalText: text,
        fontSize: 20,
        fontFamily: 5,
        textAlign: 'center',
        verticalAlign: 'middle',
        containerId: container.id ?? null,
        autoResize: true,
        lineHeight: 1.25,
        baseFontSize: null,
        labelPosition: container.type === 'arrow' ? 0.5 : null,
        ...over,
      });
      container.boundElements = [...(container.boundElements ?? []), { type: 'text', id: el.id }];
      return el;
    },
    freedraw: (points: ExcalidrawPoint[], over: Over = {}) =>
      linear('freedraw', points, {
        roughness: 2,
        pressures: [],
        simulatePressure: true,
        strokeOptions: { variability: 'constant', streamline: 0.5 },
        ...over,
      }),
    line: (points: ExcalidrawPoint[], over: Over = {}) =>
      linear('line', points, {
        roundness: { type: 2 },
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: null,
        polygon: false,
        ...over,
      }),
    /** An arrow; `from` / `to` bind its ends (mode `orbit`, a fixed point on the target). */
    arrow: (
      points: ExcalidrawPoint[],
      over: Over = {},
      ends: { from?: ExcalidrawElement; to?: ExcalidrawElement } = {},
    ) => {
      const el = linear('arrow', points, {
        roundness: { type: 2 },
        startBinding: ends.from
          ? { elementId: ends.from.id, mode: 'orbit', fixedPoint: [1, 0.5] }
          : null,
        endBinding: ends.to ? { elementId: ends.to.id, mode: 'orbit', fixedPoint: [0, 0.5] } : null,
        startArrowhead: null,
        endArrowhead: 'arrow',
        elbowed: false,
        moveMidPointsWithElement: false,
        ...over,
      });
      for (const target of [ends.from, ends.to]) {
        if (target) {
          target.boundElements = [...(target.boundElements ?? []), { type: 'arrow', id: el.id }];
        }
      }
      return el;
    },
    stickynote: (over: Over = {}) =>
      base('stickynote', {
        width: 250,
        height: 250,
        backgroundColor: '#ffdf6b',
        roughness: 2,
        roundness: { type: 2 },
        baseHeight: 250,
        ...over,
      }),
    frame: (name: string, over: Over = {}) =>
      base('frame', { width: 400, height: 300, name, boundElements: null, ...over }),
    image: (fileId: string | null, over: Over = {}) =>
      base('image', { fileId, status: 'saved', scale: [1, 1], crop: null, ...over }),
  };
}

/** A one-pixel PNG as a data URL: enough bytes for an image file entry. */
export const PIXEL_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** A `files` entry the way Excalidraw writes it. */
export const excalidrawFile = (id: string, dataURL = PIXEL_PNG_DATA_URL) => ({
  [id]: { id, mimeType: 'image/png', dataURL, created: 1 },
});

/**
 * The clipboard text Excalidraw writes on copy (`JSON.stringify` of the envelope, compact), or a
 * saved file's text (`type: 'excalidraw'`, indented, with `version`, `source` and `appState`).
 */
export function excalidrawText(
  elements: ExcalidrawElement[],
  options: {
    type?: ExcalidrawEnvelopeType;
    files?: ExcalidrawFiles;
    appState?: Record<string, unknown>;
  } = {},
): string {
  const type = options.type ?? 'excalidraw/clipboard';
  if (type === 'excalidraw') {
    return JSON.stringify(
      {
        type,
        version: 2,
        source: 'https://excalidraw.com',
        elements,
        appState: options.appState ?? { viewBackgroundColor: '#ffffff', gridSize: 20 },
        files: options.files ?? {},
      },
      null,
      2,
    );
  }
  return JSON.stringify({ type, elements, files: options.files ?? {} });
}
