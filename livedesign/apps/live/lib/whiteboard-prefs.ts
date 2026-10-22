// The three markers' device-local settings (docs/specs/023-draw-mode/drawing-tools.md "Markers"):
// each one's colour and width. The user's, not the page's: stored in this browser, never sent with
// the document.

import {
  isCustomPenColour,
  isPenColourName,
  penColourLabel,
  type PenColour,
} from '@livedesign/document';
import {
  readLocalStorageSafe,
  safeJson,
  storedRecord,
  writeLocalStorageSafe,
} from './local-storage-safe';

// Named by their place in the palette, never by a colour: the second and third can be any colour.
export type WhiteboardPenId = 'main' | 'second' | 'third';
// `colour`: null is the canvas's own ink, the first stock colour, which any marker may take and the
// main one always has; a stock name ("blue") is drawn in its version for the canvas; a custom
// `#rrggbb` is the same on both. `width` is in px, derived from a named preset.
export type WhiteboardPen = { id: WhiteboardPenId; colour: PenColour | null; width: number };
// A marker width's preset name, stored in place of its px.
export type PenWidthId = 'fine' | 'medium' | 'bold' | 'thick' | 'heavy' | 'broad';
export type WhiteboardPrefs = { pens: WhiteboardPen[] };

// Subtle at 100%: a line, not a felt tip. Tuned with the operator: Medium is
// 1.5 px, a notch either side. Thick, Heavy and Broad step up by about half
// again each, for felt-tip and poster marks. The floor is 1 px, the least
// `penWidth` validates; Broad sits far below its 100 px ceiling.
export const WHITEBOARD_PEN_WIDTHS: readonly { id: PenWidthId; label: string; px: number }[] = [
  { id: 'fine', label: 'Fine', px: 1 },
  { id: 'medium', label: 'Medium', px: 1.5 },
  { id: 'bold', label: 'Bold', px: 2.5 },
  { id: 'thick', label: 'Thick', px: 4 },
  { id: 'heavy', label: 'Heavy', px: 6 },
  { id: 'broad', label: 'Broad', px: 9 },
];
const MEDIUM_PX = 1.5;

// In palette order.
export const DEFAULT_WHITEBOARD_PREFS: WhiteboardPrefs = {
  pens: [
    { id: 'main', colour: null, width: MEDIUM_PX },
    { id: 'second', colour: 'blue', width: MEDIUM_PX },
    { id: 'third', colour: 'red', width: MEDIUM_PX },
  ],
};

// What each marker is called, in the palette and in its flyout.
export const PEN_NAMES: Record<WhiteboardPenId, string> = {
  main: 'Marker 1',
  second: 'Marker 2',
  third: 'Marker 3',
};

/** The main pen always stays the board's ink; the second and third take any colour, the ink too. */
export function penAdjustsColour(pen: WhiteboardPen): boolean {
  return pen.id !== 'main';
}

/** "Ink", "Blue" or "#ff6b00": a colour's tooltip and accessible name. */
export function colourLabel(colour: PenColour | null): string {
  if (colour === null) return 'Ink';
  return isPenColourName(colour) ? penColourLabel(colour) : colour;
}

export function widthLabel(px: number): string {
  return WHITEBOARD_PEN_WIDTHS.find((w) => w.px === px)?.label ?? `${px}px`;
}

// --- Parsing ----------------------------------------------------------------

// A stored colour: the ink (null), a name or a custom hex; undefined for anything else.
function colourOf(v: unknown): PenColour | null | undefined {
  if (v === null) return null;
  if (isPenColourName(v)) return v;
  return isCustomPenColour(v) ? v.toLowerCase() : undefined;
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
  const o = storedRecord(raw);
  if (!o) return DEFAULT_WHITEBOARD_PREFS;
  return { pens: parsePens(o.pens) };
}

// --- Storage ----------------------------------------------------------------

const STORAGE_KEY = 'livedesign:v2:whiteboard-pens';

export function loadWhiteboardPrefs(): WhiteboardPrefs {
  const raw = readLocalStorageSafe(STORAGE_KEY);
  if (raw === null) return DEFAULT_WHITEBOARD_PREFS;
  const json = safeJson(raw);
  if (!json || typeof json !== 'object') console.warn('[markers] prefs reset: unreadable');
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
