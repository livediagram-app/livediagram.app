// The slice of Excalidraw's format the parser reads (docs/specs/020-import-export/excalidraw-import-export.md).
// Types only. Every field is optional: the format is additive across versions, and clipboard and
// file content is untrusted, so the parser checks each value before it uses it.

export const EXCALIDRAW_ENVELOPE_TYPES = [
  'excalidraw',
  'excalidraw/clipboard',
  'excalidraw-api/clipboard',
] as const;
export type ExcalidrawEnvelopeType = (typeof EXCALIDRAW_ENVELOPE_TYPES)[number];

export type ExcalidrawPoint = [number, number];

export type ExcalidrawBinding = {
  elementId?: string;
  mode?: string;
  fixedPoint?: [number, number] | null;
} | null;

export type ExcalidrawElement = {
  id?: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  angle?: number;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: string;
  strokeWidth?: number;
  strokeStyle?: string;
  roughness?: number;
  opacity?: number;
  groupIds?: string[];
  frameId?: string | null;
  index?: string | null;
  roundness?: { type?: number; value?: number } | null;
  seed?: number;
  version?: number;
  versionNonce?: number;
  isDeleted?: boolean;
  boundElements?: { type?: string; id?: string }[] | null;
  updated?: number;
  created?: number | null;
  link?: string | null;
  locked?: boolean;
  // text
  text?: string;
  originalText?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: string;
  verticalAlign?: string;
  containerId?: string | null;
  autoResize?: boolean;
  lineHeight?: number;
  baseFontSize?: number | null;
  labelPosition?: number | null;
  // linear (line, arrow, freedraw)
  points?: ExcalidrawPoint[];
  startBinding?: ExcalidrawBinding;
  endBinding?: ExcalidrawBinding;
  startArrowhead?: string | null;
  endArrowhead?: string | null;
  elbowed?: boolean;
  polygon?: boolean;
  moveMidPointsWithElement?: boolean;
  pressures?: number[];
  simulatePressure?: boolean;
  strokeOptions?: { variability?: string; streamline?: number };
  // stickynote
  baseHeight?: number;
  // frame
  name?: string | null;
  // image
  fileId?: string | null;
  status?: string;
  scale?: [number, number];
  crop?: unknown;
};

/** The scene's picture bytes, keyed by the image elements' `fileId`. */
export type ExcalidrawFiles = Record<
  string,
  { id?: unknown; mimeType?: unknown; dataURL?: unknown } | undefined
>;

export type ExcalidrawAppState = { viewBackgroundColor?: unknown; gridModeEnabled?: unknown };

/** A read and checked envelope: `elements` holds only live element objects. */
export type ExcalidrawEnvelope = {
  type: ExcalidrawEnvelopeType;
  elements: ExcalidrawElement[];
  files: ExcalidrawFiles;
  appState?: ExcalidrawAppState;
};
