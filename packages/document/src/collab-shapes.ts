// The collaboration element family: the temperature check (docs/specs/012-collaboration/temperature-check.md) and
// the decision record (docs/specs/012-collaboration/decision-record.md) — their kind predicates, closed enums,
// bounds and defaults.
//
// A LEAF module (types only) for the same reason data-shapes.ts is one:
// factories.ts reads these at module-init time, and importing them from
// './index' would put a runtime read inside the index ⇄ factories cycle.
// Everything here is re-exported from './index'.

import type { ShapeKind } from './index';
import { isSelfDrawingShape } from './data-shapes';

// --- Temperature check (docs/specs/012-collaboration/temperature-check.md) -----------------------------------------

// Fist-of-five, fixed. Not configurable: it is a named ritual with a shared
// meaning (1 = blocked, 5 = enthusiastic), and a 1-to-7 variant would be a
// different instrument wearing the same face.
export const TEMPERATURE_VALUES: readonly string[] = ['1', '2', '3', '4', '5'];

function isTemperatureShape(kind: ShapeKind): boolean {
  return kind === 'temperature';
}

// The ritual's meaning said out loud, one word per value, so a first-timer
// doesn't have to be told what a 2 means (docs/specs/012-collaboration/temperature-check.md "The face").
export const TEMPERATURE_MOODS: readonly string[] = [
  'Blocked',
  'Doubtful',
  'Okay',
  'Keen',
  'All in',
];

// Cool to warm, fixed hues rather than the theme's: "the low one is the cold
// one" is the glanceable part, and a theme recolouring them would make five
// arbitrary bars. Shared by the canvas face and the export.
export const TEMPERATURE_COLORS: readonly string[] = [
  '#60a5fa',
  '#22d3ee',
  '#a3e635',
  '#fbbf24',
  '#fb7185',
];

// The mouth of each fist-of-five face, frown (1) to beam (5), in a 16-unit box
// whose face is a circle of radius 6.4 at (8, 8) with eyes at (5.9, 6.6) and
// (10.1, 6.6). One definition for the canvas buttons and the export, so the
// two draw the same five faces (docs/specs/012-collaboration/temperature-check.md "The face").
export const TEMPERATURE_FACE_MOUTHS: readonly string[] = [
  'M5.2 11.4Q8 8.9 10.8 11.4',
  'M5.5 11Q8 10 10.5 11',
  'M5.5 10.6H10.5',
  'M5.4 9.9Q8 11.9 10.6 9.9',
  'M5 9.4Q8 13.4 11 9.4Z',
];

// Where an average sits on the cool-to-warm track, 0 (all 1s) to 1 (all 5s).
export function temperaturePosition(average: number): number {
  return Math.min(1, Math.max(0, (average - 1) / 4));
}

// --- Decision record (docs/specs/012-collaboration/decision-record.md) -------------------------------------------

export type DecisionStatus = 'proposed' | 'accepted' | 'rejected' | 'superseded';
export const DECISION_STATUSES: readonly DecisionStatus[] = [
  'proposed',
  'accepted',
  'rejected',
  'superseded',
];
export const DEFAULT_DECISION_STATUS: DecisionStatus = 'proposed';

export const DECISION_STATUS_LABELS: Record<DecisionStatus, string> = {
  proposed: 'Proposed',
  accepted: 'Accepted',
  rejected: 'Rejected',
  superseded: 'Superseded',
};

// Chip colours only — never the element's fill, so the theme still owns the
// box (docs/specs/012-collaboration/decision-record.md). `text` is the chip's foreground on `bg`.
export const DECISION_STATUS_COLORS: Record<DecisionStatus, { bg: string; text: string }> = {
  proposed: { bg: '#e2e8f0', text: '#334155' }, // slate
  accepted: { bg: '#dcfce7', text: '#166534' }, // green
  rejected: { bg: '#ffe4e6', text: '#9f1239' }, // rose
  superseded: { bg: '#fef3c7', text: '#92400e' }, // amber
};

// One hue per status, for the badge, the glow and the driver markers
// (docs/specs/012-collaboration/decision-record.md "The face"). The badge is tinted from it, so it reads
// on light and dark canvases alike, where the light chip colours above sat pasted
// onto a dark card. Shared by the canvas face and the export.
export const DECISION_STATUS_HUES: Record<DecisionStatus, string> = {
  proposed: '#64748b',
  accepted: '#22c55e',
  rejected: '#f43f5e',
  superseded: '#f59e0b',
};

export const DECISION_MAX_DRIVERS = 20;
export const DECISION_MAX_TEXT = 200;

export function isDecisionStatus(value: unknown): value is DecisionStatus {
  return (DECISION_STATUSES as readonly string[]).includes(value as string);
}

// A date, not a timestamp: a decision is taken on a day (docs/specs/012-collaboration/decision-record.md).
export function isDecisionDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isDecisionShape(kind: ShapeKind): boolean {
  return kind === 'decision';
}

// --- The family ------------------------------------------------------------

// Every collaboration kind that draws a PRESSABLE FACE in place of the plain
// label — the same shape as the session button and the picker
// (docs/specs/012-collaboration/session-button.md, picker.md), which each render a face while `!isEditing` and fall
// back to the ordinary label editor mid-edit. So the label is still typed,
// formatted and exported like any other; it is just drawn by the face.
//
// The decision record is here despite having nothing to press, because it owns
// its whole layout for the same reason: its label is a SENTENCE, and a
// free-flowing label sized to the box ran under the status chip and over the
// drivers. Drawing the card itself is what makes the collision impossible.
export function isCollabPanelShape(kind: ShapeKind): boolean {
  return isTemperatureShape(kind) || isDecisionShape(kind);
}

// Kinds whose resting face draws its own layout and shows the label as a
// plain title (the collab panels, the session tools, the comment and action
// panels, the portal): the editor's ElementFaceRouter hands them
// the label string, never the aligned label node, so text alignment has
// nothing to move on them. Kept here, beside the kind predicates, so the
// router's list and the text-align gate below can't drift apart.
export function hasOwnFace(kind: ShapeKind): boolean {
  return (
    isCollabPanelShape(kind) ||
    kind === 'session-button' ||
    kind === 'picker' ||
    kind === 'comment-pin' ||
    kind === 'action-card' ||
    kind === 'portal'
  );
}

// Whether double-click, Space or typing opens the inline label editor on this
// kind. Not on a self-drawing kind (it has no label).
export function opensInlineLabelEditor(kind: ShapeKind): boolean {
  // A sequence diagram's words are its rows, written in its dialog (docs/specs/009-elements/sequence-diagram.md); its
  // box keeps its border controls, so it is not self-drawing, but a click never opens a label editor on it.
  return !isSelfDrawingShape(kind) && kind !== 'sequence';
}

// Whether text alignment does anything on this kind: not a self-drawing kind
// (no label at all) and not one with its own face (the label is a fixed
// title). An icon keeps it: its alignment places the caption above, below or
// beside the glyph, and the glyph moves to make room
// (docs/specs/010-palette/technology-icons.md "caption's alignment"); left out, an
// icon's caption could never be moved. The one gate for both the context menu
// and the quick style panel. Web components (banner, callout, header) and
// pages keep it: they render the aligned label.
export function supportsTextAlign(kind: ShapeKind): boolean {
  return !isSelfDrawingShape(kind) && !hasOwnFace(kind);
}

// Whether shape markers (docs/specs/009-elements/shape-markers.md) do anything on this kind: a marker
// decorates the label, so not on a self-drawing kind (no label) and not on one
// with its own face (the label is a fixed title the face draws, and a marker
// never shows on it). The one gate for the single-element and multi-selection
// menus.
export function supportsMarkers(kind: ShapeKind): boolean {
  return !isSelfDrawingShape(kind) && !hasOwnFace(kind);
}
