// Reading a replayed board's elements (docs/specs/020-import-export/blueprints/
// ms-whiteboard-import.md "Elements"): each canvas child by its type to a typed element.
import type { SceneColour } from '@/lib/board-scene/scene';
import { MSWB_STICKY_YELLOW, MSWB_TEXT_COLOURS, MSWB_TRAIT as T, MSWB_TYPE } from './format';
import { decodePenStroke, type PenStroke } from './pen-stroke';
import type { ReplayedBoard } from './replay';
import { children, single, type WbNode } from './tree';
import { readArgb, readNumber, readPackedDouble, readPenColour, utf8 } from './values';

export type Point = { x: number; y: number };
export type StrokePreset = 'pen' | 'highlighter' | 'rainbow' | 'galaxy';

export type WbStroke = {
  preset: StrokePreset;
  stroke: PenStroke;
  colour?: SceneColour;
  widthFactor: number;
  dx: number;
  dy: number;
  /** The arrowhead drawn with the stroke: its own small stroke, from its origin. */
  arrowheads: PenStroke[];
  /** Arrowheads whose payload could not be read. */
  unreadableArrowheads: number;
};

export type WbText = { text: string; fontPx: number; bold: boolean; colour: SceneColour };

type Placed = { x: number; y: number; scale: number; rotationDeg: number };

export type WbInk = Placed & { kind: 'ink'; strokes: WbStroke[]; unreadable: number };

export type WbElement =
  | WbInk
  | (Placed & {
      kind: 'shape';
      width: number;
      height: number;
      borderWidth: number;
      dashed: boolean;
      border?: SceneColour;
      fill?: SceneColour;
      text?: WbText;
    })
  | (Placed & { kind: 'sticky'; width: number; height: number; fill: SceneColour; text?: WbText })
  | (Placed & { kind: 'text'; width?: number; height?: number; text: WbText })
  | (Placed & { kind: 'image'; width: number; height: number; imageNodeId?: string })
  | { kind: 'polygon'; cx: number; cy: number; corners: Point[]; colour?: SceneColour }
  | (Placed & {
      kind: 'line';
      from: Point;
      to: Point;
      width: number;
      dashed: boolean;
      colour?: SceneColour;
      heads: { start: boolean; end: boolean };
    })
  | (Placed & {
      kind: 'table';
      rows: { height: number; cells: WbInk[][] }[];
      columns: number[];
      colour?: SceneColour;
    })
  | { kind: 'unknown'; type: string };

export type WbBoard = {
  background?: SceneColour;
  pattern: 'plain' | 'dots' | 'grid';
  elements: WbElement[];
};

const numberOf = (n: WbNode | undefined): number | undefined => {
  const v = n?.payload ? readNumber(n.payload) : null;
  return v !== null && Number.isFinite(v) ? v : undefined;
};
const num = (node: WbNode, trait: string) => numberOf(single(node, trait));
const pointOf = (n: WbNode | undefined): Point | undefined => {
  if (!n) return undefined;
  const [x, y] = children(n, T.children).map(numberOf);
  return x !== undefined && y !== undefined ? { x, y } : undefined;
};
const argbOf = (n: WbNode | undefined) =>
  n?.payload ? (readArgb(n.payload) ?? undefined) : undefined;

function placed(node: WbNode): Placed | null {
  const pos = pointOf(single(node, T.position));
  if (!pos) return null;
  return { ...pos, scale: num(node, T.scale) ?? 1, rotationDeg: num(node, T.rotation) ?? 0 };
}

/** A text body's plain text: paragraphs joined by line breaks, runs and strings concatenated. */
export function readText(node: WbNode): string {
  return children(node, T.children)
    .filter((p) => p.type === MSWB_TYPE.paragraph)
    .map((p) =>
      children(p, T.children)
        .flatMap((run) => children(run, T.children))
        .map((s) => (s.payload ? utf8(s.payload) : ''))
        .join(''),
    )
    .join('\n');
}

function textOf(node: WbNode, colour: SceneColour): WbText | undefined {
  const text = readText(node);
  if (text.trim() === '') return undefined;
  return {
    text,
    fontPx: num(node, T.fontSize) ?? 24,
    bold: single(node, T.weight)?.type === MSWB_TYPE.bold,
    colour,
  };
}

const BLACK: SceneColour = { hex: '#000000' };

const PRESETS: Readonly<Record<string, StrokePreset>> = {
  [MSWB_TYPE.pen]: 'pen',
  [MSWB_TYPE.highlighter]: 'highlighter',
  [MSWB_TYPE.highlighterOld]: 'highlighter',
  [MSWB_TYPE.rainbow]: 'rainbow',
  [MSWB_TYPE.galaxy]: 'galaxy',
};

/** The first packed double after a leading flags byte, or the fallback. */
function leadingDoubles(bytes: Uint8Array | undefined, count: number): number[] | undefined {
  if (!bytes) return undefined;
  const out: number[] = [];
  let at = 1;
  for (let i = 0; i < count; i++) {
    const read = readPackedDouble(bytes, at);
    if (!read || !Number.isFinite(read[0])) return undefined;
    out.push(read[0]);
    at = read[1];
  }
  return out;
}

function arrowheadsOf(node: WbNode) {
  const arrowheads: PenStroke[] = [];
  let unreadableArrowheads = 0;
  for (const head of children(node, T.arrowhead)) {
    const decoded = head.payload ? decodePenStroke(head.payload) : null;
    if (decoded) arrowheads.push(decoded);
    else unreadableArrowheads++;
  }
  return { arrowheads, unreadableArrowheads };
}

function readStroke(node: WbNode): WbStroke | null {
  const preset = PRESETS[node.type];
  const stroke = node.payload ? decodePenStroke(node.payload) : null;
  if (!preset || !stroke) return null;
  const colourNode = single(node, T.penColour);
  const colour = colourNode?.payload ? readPenColour(colourNode.payload) : null;
  const factor = leadingDoubles(single(node, T.widthFactor)?.payload, 1)?.[0];
  const translate = leadingDoubles(single(node, T.strokeTransform)?.payload, 2);
  return {
    preset,
    stroke,
    ...(colour ? { colour } : {}),
    widthFactor: factor && factor > 0 ? factor : 1,
    dx: translate?.[0] ?? 0,
    dy: translate?.[1] ?? 0,
    ...arrowheadsOf(node),
  };
}

function readInk(node: WbNode): WbInk | null {
  const at = placed(node);
  if (!at) return null;
  const strokes: WbStroke[] = [];
  let unreadable = 0;
  for (const s of children(node, T.strokes)) {
    const stroke = readStroke(s);
    if (stroke) strokes.push(stroke);
    else unreadable++;
  }
  return { kind: 'ink', ...at, strokes, unreadable };
}

function readSize(node: WbNode) {
  const size = pointOf(single(node, T.size));
  return size && size.x > 0 && size.y > 0 ? { width: size.x, height: size.y } : undefined;
}

function readTable(node: WbNode, at: Placed): WbElement {
  const extent = (n: WbNode) => num(n, T.tableExtent) ?? 0;
  return {
    kind: 'table',
    ...at,
    rows: children(node, T.tableRows).map((row) => ({
      height: extent(row),
      cells: children(row, T.tableCells).map((cell) =>
        children(cell, T.tableCellContent)
          .filter((c) => c.type === MSWB_TYPE.inkGroup)
          .map(readInk)
          .filter((ink): ink is WbInk => ink !== null),
      ),
    })),
    columns: children(node, T.tableColumns).map(extent),
    ...(argbOf(single(node, T.tableColour))
      ? { colour: argbOf(single(node, T.tableColour))! }
      : {}),
  };
}

/** One canvas child, or `unknown` when its type or its required fields are not readable. */
export function readElement(node: WbNode): WbElement {
  const unknown = { kind: 'unknown', type: node.type } as const;
  if (node.type === MSWB_TYPE.inkGroup) return readInk(node) ?? unknown;
  if (node.type === MSWB_TYPE.polygon) {
    const centre = pointOf(single(node, T.position));
    if (!centre) return unknown;
    const corners = children(node, T.corners)
      .map((c) => pointOf(single(c, T.cornerPoint)))
      .filter((p): p is Point => p !== undefined);
    const colour = argbOf(single(node, T.polygonColour));
    return { kind: 'polygon', cx: centre.x, cy: centre.y, corners, ...(colour ? { colour } : {}) };
  }
  const at = placed(node);
  if (!at) return unknown;
  switch (node.type) {
    case MSWB_TYPE.shape: {
      const size = readSize(node);
      if (!size) return unknown;
      const border = argbOf(single(node, T.border));
      const fill = argbOf(single(node, T.fill));
      const text = textOf(node, BLACK);
      return {
        kind: 'shape',
        ...at,
        ...size,
        borderWidth: num(node, T.borderWidth) ?? 2,
        dashed: (num(node, T.dash) ?? 0) !== 0,
        ...(border ? { border } : {}),
        ...(fill ? { fill } : {}),
        ...(text ? { text } : {}),
      };
    }
    case MSWB_TYPE.sticky: {
      const size = readSize(node);
      if (!size) return unknown;
      const text = textOf(node, BLACK);
      return {
        kind: 'sticky',
        ...at,
        ...size,
        fill: { hex: MSWB_STICKY_YELLOW },
        ...(text ? { text } : {}),
      };
    }
    case MSWB_TYPE.textBox: {
      const hex = MSWB_TEXT_COLOURS[single(node, T.textColour)?.type ?? ''] ?? BLACK.hex;
      const text = textOf(node, { hex });
      if (!text) return unknown;
      return { kind: 'text', ...at, ...(readSize(node) ?? {}), text };
    }
    case MSWB_TYPE.image: {
      const size = readSize(node);
      if (!size) return unknown;
      const data = children(node, T.children).find((c) => c.type === MSWB_TYPE.imageData);
      return { kind: 'image', ...at, ...size, ...(data?.id ? { imageNodeId: data.id } : {}) };
    }
    case MSWB_TYPE.line: {
      const from = pointOf(single(node, T.lineFrom));
      const to = pointOf(single(node, T.lineTo));
      if (!from || !to) return unknown;
      const colour = argbOf(single(node, T.border));
      return {
        kind: 'line',
        ...at,
        from,
        to,
        width: num(node, T.borderWidth) ?? 2,
        dashed: (num(node, T.dash) ?? 0) !== 0,
        ...(colour ? { colour } : {}),
        heads: {
          start: (num(node, T.lineStartHead) ?? 0) !== 0,
          end: (num(node, T.lineEndHead) ?? 0) !== 0,
        },
      };
    }
    case MSWB_TYPE.table:
      return readTable(node, at);
    default:
      return unknown;
  }
}

const PATTERNS: Readonly<Record<string, WbBoard['pattern']>> = {
  [MSWB_TYPE.patternPlain]: 'plain',
  [MSWB_TYPE.patternDots]: 'dots',
  [MSWB_TYPE.patternGrid]: 'grid',
  [MSWB_TYPE.patternGridSmall]: 'grid',
};

/** The board: background, pattern and elements back to front. */
export function readBoard(replayed: ReplayedBoard): WbBoard {
  const canvas = replayed.canvas;
  if (!canvas) return { pattern: 'plain', elements: [] };
  const background = argbOf(single(canvas, T.background));
  return {
    ...(background ? { background } : {}),
    pattern: PATTERNS[single(canvas, T.pattern)?.type ?? ''] ?? 'plain',
    elements: children(canvas, T.children).map(readElement),
  };
}
