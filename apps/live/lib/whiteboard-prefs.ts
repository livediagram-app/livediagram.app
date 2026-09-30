// The whiteboard's device-local tool settings (docs/specs/023-whiteboard/whiteboard.md "Pens"): the main,
// second and third pens, which one is in hand, shape recognition and the eraser mode. The user's,
// not the board's: stored in this browser, never sent with the document.

import { readLocalStorageSafe, safeJson, writeLocalStorageSafe } from './local-storage-safe';

// Named by their place in the dock, never by a colour: the second and third can be any colour.
export type WhiteboardPenId = 'main' | 'second' | 'third';
// `colour` null is the board's own ink, which follows the appearance; only the
// main pen has it. `width` is in px, derived from a named preset.
export type WhiteboardPen = { id: WhiteboardPenId; colour: string | null; width: number };
export type WhiteboardEraserMode = 'stroke' | 'partial';
export type WhiteboardPrefs = {
  pens: WhiteboardPen[];
  activePenId: WhiteboardPenId;
  recognise: boolean;
  eraserMode: WhiteboardEraserMode;
};

// Subtle at 100%: a line, not a felt tip. Tuned with the operator: Medium is
// 1.5 px, a notch either side. The floor is 1 px, the least `penWidth` validates.
export const WHITEBOARD_PEN_WIDTHS: readonly { id: string; label: string; px: number }[] = [
  { id: 'fine', label: 'Fine', px: 1 },
  { id: 'medium', label: 'Medium', px: 1.5 },
  { id: 'bold', label: 'Bold', px: 2.5 },
];
const MEDIUM_PX = 1.5;

// The named colours an adjustable pen can take, each 3:1 or better on both
// boards. The ink is not among them: it is the main pen's, and only its.
export const WHITEBOARD_PEN_COLOURS: readonly { hex: string; label: string }[] = [
  { hex: '#1d7afc', label: 'Blue' },
  { hex: '#e5484d', label: 'Red' },
  { hex: '#d9480f', label: 'Orange' },
  { hex: '#2f9e44', label: 'Green' },
  { hex: '#0c8599', label: 'Teal' },
  { hex: '#9061f9', label: 'Violet' },
  { hex: '#e64980', label: 'Pink' },
];

const colourHex = (label: string) => WHITEBOARD_PEN_COLOURS.find((c) => c.label === label)!.hex;

// Left to right in the dock.
export const DEFAULT_WHITEBOARD_PREFS: WhiteboardPrefs = {
  pens: [
    { id: 'main', colour: null, width: MEDIUM_PX },
    { id: 'second', colour: colourHex('Blue'), width: MEDIUM_PX },
    { id: 'third', colour: colourHex('Red'), width: MEDIUM_PX },
  ],
  activePenId: 'main',
  recognise: false,
  eraserMode: 'stroke',
};

const PEN_IDS: readonly WhiteboardPenId[] = ['main', 'second', 'third'];

// What each pen is called, in the dock and in its flyout.
export const PEN_NAMES: Record<WhiteboardPenId, string> = {
  main: 'Main pen',
  second: 'Second pen',
  third: 'Third pen',
};
const PEN_TELEMETRY: Record<WhiteboardPenId, string> = {
  main: 'Main',
  second: 'Second',
  third: 'Third',
};

/** The main pen always stays the board's ink; the second and third take any named colour. */
export function penAdjustsColour(pen: WhiteboardPen): boolean {
  return pen.id !== 'main';
}

export function colourLabel(hex: string | null): string {
  if (hex === null) return 'Ink';
  return WHITEBOARD_PEN_COLOURS.find((c) => c.hex === hex)?.label ?? 'Custom';
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

const isNamedColour = (v: unknown): v is string => WHITEBOARD_PEN_COLOURS.some((c) => c.hex === v);
// Widths are stored by preset NAME, so retuning a preset's px never
// reinterprets somebody's choice; anything else (a bare px) falls back.
const widthPxOf = (v: unknown): number | undefined =>
  WHITEBOARD_PEN_WIDTHS.find((w) => w.id === v)?.px;

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
      colour:
        penAdjustsColour(preset) && isNamedColour(found.colour) ? found.colour : preset.colour,
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
