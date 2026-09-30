// The whiteboard's device-local tool settings (docs/specs/023-whiteboard/whiteboard.md "Pens"): the preset
// pens, which one is in hand, shape recognition and the eraser mode. The user's,
// not the board's: stored in this browser, never sent with the document.

import { readLocalStorageSafe, safeJson, writeLocalStorageSafe } from './local-storage-safe';

export type WhiteboardPenId = 'ink' | 'red' | 'blue' | 'green';
export type WhiteboardPen = { id: WhiteboardPenId; colour: string | null; width: number };
export type WhiteboardEraserMode = 'stroke' | 'partial';
export type WhiteboardPrefs = {
  pens: WhiteboardPen[];
  activePenId: WhiteboardPenId;
  recognise: boolean;
  eraserMode: WhiteboardEraserMode;
};

export const WHITEBOARD_PEN_WIDTHS: readonly { id: string; label: string; px: number }[] = [
  { id: 'fine', label: 'Fine', px: 2 },
  { id: 'medium', label: 'Medium', px: 4 },
  { id: 'bold', label: 'Bold', px: 8 },
];
const MEDIUM_PX = 4;

// Ink (null: the board's own ink, which follows the appearance) plus named
// colours that each read at 3:1 or better on both boards.
export const WHITEBOARD_PEN_COLOURS: readonly { hex: string | null; label: string }[] = [
  { hex: null, label: 'Ink' },
  { hex: '#e5484d', label: 'Red' },
  { hex: '#d9480f', label: 'Orange' },
  { hex: '#2f9e44', label: 'Green' },
  { hex: '#0c8599', label: 'Teal' },
  { hex: '#1d7afc', label: 'Blue' },
  { hex: '#9061f9', label: 'Violet' },
  { hex: '#e64980', label: 'Pink' },
];

const colourHex = (label: string) => WHITEBOARD_PEN_COLOURS.find((c) => c.label === label)!.hex;

export const DEFAULT_WHITEBOARD_PREFS: WhiteboardPrefs = {
  pens: [
    { id: 'ink', colour: null, width: MEDIUM_PX },
    { id: 'red', colour: colourHex('Red'), width: MEDIUM_PX },
    { id: 'blue', colour: colourHex('Blue'), width: MEDIUM_PX },
    { id: 'green', colour: colourHex('Green'), width: MEDIUM_PX },
  ],
  activePenId: 'ink',
  recognise: false,
  eraserMode: 'stroke',
};

const PEN_IDS: readonly WhiteboardPenId[] = ['ink', 'red', 'blue', 'green'];
const PEN_NAMES: Record<WhiteboardPenId, string> = {
  ink: 'Ink',
  red: 'Red',
  blue: 'Blue',
  green: 'Green',
};

export function colourLabel(hex: string | null): string {
  return WHITEBOARD_PEN_COLOURS.find((c) => c.hex === hex)?.label ?? 'Custom';
}

export function widthLabel(px: number): string {
  return WHITEBOARD_PEN_WIDTHS.find((w) => w.px === px)?.label ?? `${px}px`;
}

/** "Red pen, medium": what the pen draws, for its button's accessible name. */
export function penLabel(pen: WhiteboardPen): string {
  return `${colourLabel(pen.colour)} pen, ${widthLabel(pen.width).toLowerCase()}`;
}

/** The telemetry token: the pen's default name while it keeps its colour. */
export function penTelemetryType(pen: WhiteboardPen): string {
  const preset = DEFAULT_WHITEBOARD_PREFS.pens.find((p) => p.id === pen.id);
  return preset && preset.colour === pen.colour ? PEN_NAMES[pen.id] : 'Custom';
}

// --- Parsing ----------------------------------------------------------------

const isKnownColour = (v: unknown): v is string | null =>
  WHITEBOARD_PEN_COLOURS.some((c) => c.hex === v);
const isKnownWidth = (v: unknown): v is number => WHITEBOARD_PEN_WIDTHS.some((w) => w.px === v);

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
      colour: isKnownColour(found.colour) ? found.colour : preset.colour,
      width: isKnownWidth(found.width) ? found.width : preset.width,
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
  writeLocalStorageSafe(STORAGE_KEY, JSON.stringify(prefs));
}
