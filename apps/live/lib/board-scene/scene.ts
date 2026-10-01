// The board scene (docs/specs/020-import-export/board-scene.md): the one source-neutral picture
// of a board every import and paste reduces to. Parsers (Excalidraw, Microsoft Whiteboard) produce
// it; one landing (land.ts) turns it into elements. Types only: no values, no React, no DOM.
//
// Units: coordinates are canvas px; `widthPx` is a line's drawn width at medium pressure; `fontPx`
// is the rendered font size. Colours are light-reference: what the line looks like on a light
// board. 'ink' names the board's own adaptive ink.

export type SceneAppearance = 'light' | 'dark';

/** A point in canvas px; `p` is the pen pressure there, 0 to 1. */
export type ScenePoint = { x: number; y: number; p?: number };

/** A light-reference colour: '#rrggbb', with an optional alpha 0 to 1 (absent: opaque). */
export type SceneColour = { hex: string; alpha?: number };

export type SceneStroke = {
  colour: SceneColour | 'ink';
  widthPx: number;
  dash?: 'solid' | 'dashed' | 'dotted';
  /** 0 to 1; absent is 1. */
  opacity?: number;
  /** Multicolour ink: its colour stops; the landing degrades it per the spec. */
  stops?: SceneColour[];
};

export type SceneText = {
  /** Plain text, '\n' line breaks. */
  text: string;
  fontPx: number;
  family: 'hand' | 'sans' | 'serif' | 'mono';
  colour: SceneColour | 'ink';
  alignX?: 'left' | 'center' | 'right';
  alignY?: 'top' | 'middle' | 'bottom';
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
};

export type SceneHead =
  | 'arrow'
  | 'triangle'
  | 'triangle-hollow'
  | 'circle'
  | 'circle-hollow'
  | 'diamond'
  | 'diamond-hollow'
  | 'bar';

type Base = {
  /** Unique within its scene: bindings and assets refer to it. */
  key: string;
  /** Clockwise degrees about the item's centre. */
  rotationDeg?: number;
  locked?: boolean;
  link?: string;
};

export type SceneInk = Base & {
  kind: 'ink';
  points: ScenePoint[];
  stroke: SceneStroke;
  closed?: boolean;
  highlighter?: boolean;
  fill?: SceneColour;
  /** perfect-freehand streamline the points are drawn with; absent is 0 (final geometry). */
  streamline?: number;
};

export type ScenePolyline = Base & {
  kind: 'polyline';
  points: ScenePoint[];
  stroke: SceneStroke;
  closed?: boolean;
  curved?: boolean;
  fill?: SceneColour;
  heads?: { start?: SceneHead; end?: SceneHead };
};

export type SceneShape = Base & {
  kind: 'shape';
  shape: 'rectangle' | 'ellipse' | 'diamond' | 'triangle';
  x: number;
  y: number;
  width: number;
  height: number;
  rounded?: boolean;
  stroke: SceneStroke | null;
  fill?: SceneColour;
  label?: SceneText;
};

export type SceneConnector = Base & {
  kind: 'connector';
  points: ScenePoint[];
  stroke: SceneStroke;
  curved?: boolean;
  heads: { start?: SceneHead; end?: SceneHead };
  /** Item keys the ends are bound to. */
  from?: string;
  to?: string;
  label?: SceneText;
};

export type SceneTextItem = Base & {
  kind: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  autoWidth: boolean;
  text: SceneText;
};

export type SceneSticky = Base & {
  kind: 'sticky';
  x: number;
  y: number;
  width: number;
  height: number;
  fill: SceneColour;
  text?: SceneText;
};

export type SceneImage = Base & {
  kind: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  /** The key of the asset holding its bytes. */
  asset: string;
  crop?: boolean;
};

export type SceneFrame = Base & {
  kind: 'frame';
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
};

export type SceneItem =
  | SceneInk
  | ScenePolyline
  | SceneShape
  | SceneConnector
  | SceneTextItem
  | SceneSticky
  | SceneImage
  | SceneFrame;

export type SceneItemKind = SceneItem['kind'];

export type SceneAsset = {
  key: string;
  source:
    { kind: 'data-url'; dataUrl: string } | { kind: 'bytes'; bytes: Uint8Array; mimeType: string };
};

/**
 * A rule the parser could not keep as it was, for the report: `rule` is a short user-facing
 * sentence ("Groups were dropped"); `kind` absent is 'degraded'.
 */
export type SceneNote = { rule: string; count: number; kind?: 'degraded' | 'skipped' };

export type BoardScene = {
  source: 'excalidraw' | 'microsoft-whiteboard';
  title?: string;
  /** Tool plus the tool's board id, when it has one. */
  sourceId?: string;
  authoredOn: SceneAppearance | 'unknown';
  background?: {
    appearance?: SceneAppearance;
    pattern?: 'plain' | 'dots' | 'grid';
    /** The source's canvas colour: the diagram profile's tab background. */
    colour?: SceneColour;
  };
  /** Back to front. */
  items: SceneItem[];
  assets: SceneAsset[];
  /** Parser-side degradations and skips. */
  notes: SceneNote[];
};
