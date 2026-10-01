// The whiteboard's device-local tool settings (docs/specs/023-whiteboard/whiteboard.md "Pens"): the main,
// second and third pens, which one is in hand, shape recognition and the eraser mode. The user's,
// not the board's: stored in this browser, never sent with the document.

import {
  isCustomPenColour,
  isPenColourName,
  penColourLabel,
  type PenColour,
  type PenColourName,
} from '@livediagram/document';
import { readLocalStorageSafe, safeJson, writeLocalStorageSafe } from './local-storage-safe';
import {
  DEFAULT_PEN_CURSOR,
  PEN_CURSOR_VARIANTS,
  type PenCursorVariant,
} from './whiteboard-pen-cursor';

// Named by their place in the dock, never by a colour: the second and third can be any colour.
export type WhiteboardPenId = 'main' | 'second' | 'third';
// `colour` (docs/specs/023-whiteboard/whiteboard.md "The colour picker"): null is the board's own
// ink, the first stock colour, which any pen may take and the main pen always has; a stock name
// ("blue") is drawn in its version for the board; a custom `#rrggbb` is the same on both. `width`
// is in px, derived from a named preset.
export type WhiteboardPen = { id: WhiteboardPenId; colour: PenColour | null; width: number };
export type WhiteboardEraserMode = 'stroke' | 'partial';
export type WhiteboardPrefs = {
  pens: WhiteboardPen[];
  activePenId: WhiteboardPenId;
  recognise: boolean;
  eraserMode: WhiteboardEraserMode;
  // The cursor while a pen is in hand (lib/whiteboard-pen-cursor).
  cursor: PenCursorVariant;
};

// Subtle at 100%: a line, not a felt tip. Tuned with the operator: Medium is
// 1.5 px, a notch either side. The floor is 1 px, the least `penWidth` validates.
export const WHITEBOARD_PEN_WIDTHS: readonly { id: string; label: string; px: number }[] = [
  { id: 'fine', label: 'Fine', px: 1 },
  { id: 'medium', label: 'Medium', px: 1.5 },
  { id: 'bold', label: 'Bold', px: 2.5 },
];
const MEDIUM_PX = 1.5;

// The fixed colours the second and third pens had before stock colours were named: a stored one is
// read as the name it went by.
const LEGACY_PEN_COLOURS: Readonly<Record<string, PenColourName>> = {
  '#1d7afc': 'blue',
  '#e5484d': 'red',
  '#d9480f': 'orange',
  '#2f9e44': 'green',
  '#0c8599': 'teal',
  '#9061f9': 'violet',
  '#e64980': 'pink',
};

// Left to right in the dock.
export const DEFAULT_WHITEBOARD_PREFS: WhiteboardPrefs = {
  pens: [
    { id: 'main', colour: null, width: MEDIUM_PX },
    { id: 'second', colour: 'blue', width: MEDIUM_PX },
    { id: 'third', colour: 'red', width: MEDIUM_PX },
  ],
  activePenId: 'main',
  recognise: false,
  eraserMode: 'stroke',
  cursor: DEFAULT_PEN_CURSOR,
};

const PEN_IDS: readonly WhiteboardPenId[] = ['main', 'second', 'third'];

// What each pen is called, in the dock and in its flyout.
export const PEN_NAMES: Record<WhiteboardPenId, string> = {
  main: 'Marker 1',
  second: 'Marker 2',
  third: 'Marker 3',
};
const PEN_TELEMETRY: Record<WhiteboardPenId, string> = {
  main: 'Main',
  second: 'Second',
  third: 'Third',
};

/** The main pen always stays the board's ink; the second and third take any colour, the ink too. */
export function penAdjustsColour(pen: WhiteboardPen): boolean {
  return pen.id !== 'main';
}

/** "Ink", "Blue" or "Custom #ff6b00": a colour's tooltip and accessible name. */
export function colourLabel(colour: PenColour | null): string {
  if (colour === null) return 'Ink';
  return isPenColourName(colour) ? penColourLabel(colour) : `Custom ${colour}`;
}

export function widthLabel(px: number): string {
  return WHITEBOARD_PEN_WIDTHS.find((w) => w.px === px)?.label ?? `${px}px`;
}

/** "Second pen, blue, medium": the pen and what it draws, for its button's name. */
export function penLabel(pen: WhiteboardPen): string {
  const width = widthLabel(pen.width).toLowerCase();
  if (!penAdjustsColour(pen)) return `${PEN_NAMES[pen.id]}, ${width}`;
  return `${PEN_NAMES[pen.id]}, ${colourLabel(pen.colour).toLowerCase()}, ${width}`;
}

/** The telemetry token: the pen's place, never its colour. */
export function penTelemetryType(pen: WhiteboardPen): string {
  return PEN_TELEMETRY[pen.id];
}

// --- Parsing ----------------------------------------------------------------

// A stored colour: the ink (null), a name, a custom hex, or one of the old fixed colours read as its
// name; undefined for anything else.
function colourOf(v: unknown): PenColour | null | undefined {
  if (v === null) return null;
  if (isPenColourName(v)) return v;
  if (!isCustomPenColour(v)) return undefined;
  const hex = v.toLowerCase();
  return LEGACY_PEN_COLOURS[hex] ?? hex;
}
// Widths are stored by preset NAME, so retuning a preset's px never
// reinterprets somebody's choice; anything else (a bare px) falls back.
const widthPxOf = (v: unknown): number | undefined =>
  WHITEBOARD_PEN_WIDTHS.find((w) => w.id === v)?.px;

const orPreset = (colour: PenColour | null | undefined, preset: PenColour | null) =>
  colour === undefined ? preset : colour;

function parsePens(raw: unknown): WhiteboardPen[] {
  const stored = Array.isArray(raw) ? raw : [];
  return DEFAULT_WHITEBOARD_PREFS.pens.map((preset) => {
    const found = stored.find(
      (p): p is Record<string, unknown> =>
        !!p && typeof p === 'object' && (p as { id?: unknown }).id === preset.id,
    );
    if (!found) return preset;
    return {
      id: preset.id,
      colour: penAdjustsColour(preset) ? orPreset(colourOf(found.colour), preset.colour) : null,
      width: widthPxOf(found.width) ?? preset.width,
    };
  });
}

export function parseWhiteboardPrefs(raw: unknown): WhiteboardPrefs {
  const parsed: unknown = typeof raw === 'string' ? safeJson(raw) : raw;
  if (!parsed || typeof parsed !== 'object') return DEFAULT_WHITEBOARD_PREFS;
  const o = parsed as Record<string, unknown>;
  return {
    pens: parsePens(o.pens),
    activePenId: PEN_IDS.includes(o.activePenId as WhiteboardPenId)
      ? (o.activePenId as WhiteboardPenId)
      : DEFAULT_WHITEBOARD_PREFS.activePenId,
    recognise: o.recognise === true,
    eraserMode: o.eraserMode === 'partial' ? 'partial' : 'stroke',
    cursor: PEN_CURSOR_VARIANTS.includes(o.cursor as PenCursorVariant)
      ? (o.cursor as PenCursorVariant)
      : DEFAULT_PEN_CURSOR,
  };
}

// --- Storage ----------------------------------------------------------------

const STORAGE_KEY = 'livediagram:v2:whiteboard-pens';

export function loadWhiteboardPrefs(): WhiteboardPrefs {
  const raw = readLocalStorageSafe(STORAGE_KEY);
  if (raw === null) return DEFAULT_WHITEBOARD_PREFS;
  const json = safeJson(raw);
  if (!json || typeof json !== 'object') console.warn('[whiteboard] prefs reset: unreadable');
  return parseWhiteboardPrefs(json);
}

export function saveWhiteboardPrefs(prefs: WhiteboardPrefs): void {
  const stored = {
    ...prefs,
    pens: prefs.pens.map((p) => ({
      ...p,
      width: WHITEBOARD_PEN_WIDTHS.find((w) => w.px === p.width)?.id ?? 'medium',
    })),
  };
  writeLocalStorageSafe(STORAGE_KEY, JSON.stringify(stored));
}
