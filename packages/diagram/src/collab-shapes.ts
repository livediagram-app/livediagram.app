// The collaboration element family: the estimate card (spec/123), the
// temperature check (spec/124), the idea box (spec/125), the agenda
// (spec/127), the decision record (spec/128), the roll call (spec/129) and the
// chair (spec/130) — their kind predicates, closed enums, bounds and defaults.
//
// A LEAF module (types only) for the same reason data-shapes.ts is one:
// factories.ts reads these at module-init time, and importing them from
// './index' would put a runtime read inside the index ⇄ factories cycle.
// Everything here is re-exported from './index'.

import type { ShapeKind } from './index';

// --- Estimate card (spec/123) ---------------------------------------------

// Which ladder of values the card offers. Every scale ends in '?', which is a
// real answer ("I can't size this") and often the most useful one on the card.
export type EstimateScale = 'fibonacci' | 'tshirt' | 'powers';
export const ESTIMATE_SCALES: readonly EstimateScale[] = ['fibonacci', 'tshirt', 'powers'];
export const DEFAULT_ESTIMATE_SCALE: EstimateScale = 'fibonacci';

export const ESTIMATE_SCALE_VALUES: Record<EstimateScale, readonly string[]> = {
  fibonacci: ['1', '2', '3', '5', '8', '13', '21', '?'],
  tshirt: ['XS', 'S', 'M', 'L', 'XL', '?'],
  powers: ['1', '2', '4', '8', '16', '?'],
};

export const ESTIMATE_SCALE_LABELS: Record<EstimateScale, string> = {
  fibonacci: 'Fibonacci',
  tshirt: 'T-shirt',
  powers: 'Powers of two',
};

export function isEstimateScale(value: unknown): value is EstimateScale {
  return (ESTIMATE_SCALES as readonly string[]).includes(value as string);
}

export function estimateValues(scale: EstimateScale | undefined): readonly string[] {
  return ESTIMATE_SCALE_VALUES[scale ?? DEFAULT_ESTIMATE_SCALE];
}

export function isEstimateShape(kind: ShapeKind): boolean {
  return kind === 'estimate';
}

// --- Temperature check (spec/124) -----------------------------------------

// Fist-of-five, fixed. Not configurable: it is a named ritual with a shared
// meaning (1 = blocked, 5 = enthusiastic), and a 1-to-7 variant would be a
// different instrument wearing the same face.
export const TEMPERATURE_VALUES: readonly string[] = ['1', '2', '3', '4', '5'];

export function isTemperatureShape(kind: ShapeKind): boolean {
  return kind === 'temperature';
}

// --- Idea box (spec/125) ---------------------------------------------------

// Submissions are STRINGS, with nowhere to put an author. That is the
// anonymity guarantee expressed in the schema rather than in the UI.
export const IDEA_MAX_CARDS = 300;
export const IDEA_MAX_TEXT = 500;

export function isIdeaBoxShape(kind: ShapeKind): boolean {
  return kind === 'idea-box';
}

// --- Agenda (spec/127) -----------------------------------------------------

export type AgendaItem = { label: string; minutes: number };

export const AGENDA_MAX_ITEMS = 60;
export const AGENDA_MAX_TEXT = 120;
// One segment's bounds, in minutes. Clamped where read rather than rejected on
// load, the same rule the session button's duration takes.
export const AGENDA_MIN_MINUTES = 1;
export const AGENDA_MAX_MINUTES = 240;
export const AGENDA_DEFAULT_MINUTES = 5;

export function clampAgendaMinutes(minutes: number | undefined): number {
  if (!Number.isFinite(minutes)) return AGENDA_DEFAULT_MINUTES;
  return Math.max(AGENDA_MIN_MINUTES, Math.min(AGENDA_MAX_MINUTES, Math.round(minutes as number)));
}

// The number in the header: what the plan costs if every segment runs to time.
export function agendaTotalMinutes(items: AgendaItem[] | undefined): number {
  return (items ?? []).reduce((sum, item) => sum + clampAgendaMinutes(item.minutes), 0);
}

export function isAgendaShape(kind: ShapeKind): boolean {
  return kind === 'agenda';
}

// --- Decision record (spec/128) -------------------------------------------

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
// box (spec/128). `text` is the chip's foreground on `bg`.
export const DECISION_STATUS_COLORS: Record<DecisionStatus, { bg: string; text: string }> = {
  proposed: { bg: '#e2e8f0', text: '#334155' }, // slate
  accepted: { bg: '#dcfce7', text: '#166534' }, // green
  rejected: { bg: '#ffe4e6', text: '#9f1239' }, // rose
  superseded: { bg: '#fef3c7', text: '#92400e' }, // amber
};

export const DECISION_MAX_DRIVERS = 20;
export const DECISION_MAX_TEXT = 200;

export function isDecisionStatus(value: unknown): value is DecisionStatus {
  return (DECISION_STATUSES as readonly string[]).includes(value as string);
}

// A date, not a timestamp: a decision is taken on a day (spec/128).
export function isDecisionDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isDecisionShape(kind: ShapeKind): boolean {
  return kind === 'decision';
}

// --- Roll call (spec/129) --------------------------------------------------

// A FROZEN snapshot. `name` + `color` are copied at the moment the roll is
// taken and never re-joined to the live participant — the opposite of the
// change log's migration 0013, and deliberately so: minutes are a statement
// about a past moment, so someone since renamed or deleted must still appear
// under the name they were in the room under.
export type RollCallEntry = { name: string; color: string; at: number };

export const ROLL_CALL_MAX = 500;
export const ROLL_CALL_MAX_TEXT = 120;

export function isRollCallShape(kind: ShapeKind): boolean {
  return kind === 'roll-call';
}

// --- Chair (spec/130) ------------------------------------------------------

// Which way the seat points. 'n' = the chair's back is at the top, so the
// sitter faces down the board toward the reader.
export type ChairFacing = 'n' | 'e' | 's' | 'w';
export const CHAIR_FACINGS: readonly ChairFacing[] = ['n', 'e', 's', 'w'];
export const DEFAULT_CHAIR_FACING: ChairFacing = 'n';

export const CHAIR_FACING_LABELS: Record<ChairFacing, string> = {
  n: 'Facing down',
  e: 'Facing left',
  s: 'Facing up',
  w: 'Facing right',
};

export function isChairFacing(value: unknown): value is ChairFacing {
  return (CHAIR_FACINGS as readonly string[]).includes(value as string);
}

export function isChairShape(kind: ShapeKind): boolean {
  return kind === 'chair';
}

// Where a seated character's FEET go, in canvas coords: the middle of the
// chair, a little below centre so the figure sits ON the seat rather than
// floating at the box's midpoint. Shared by the walk hook (which snaps the
// sitter here) and the chair's own face (which draws the ring there).
export const CHAIR_SEAT_DROP = 0.62;

export function chairSeatPoint(box: { x: number; y: number; width: number; height: number }): {
  x: number;
  y: number;
} {
  return { x: box.x + box.width / 2, y: box.y + box.height * CHAIR_SEAT_DROP };
}

// --- The family ------------------------------------------------------------

// Every collaboration kind that draws a PRESSABLE FACE in place of the plain
// label — the same shape as the mode button / session button / reveal / picker
// (spec/103 to spec/107), which each render a face while `!isEditing` and fall
// back to the ordinary label editor mid-edit. So the label is still typed,
// formatted and exported like any other; it is just drawn by the face.
//
// The decision record is here despite having nothing to press, because it owns
// its whole layout for the same reason: its label is a SENTENCE, and a
// free-flowing label sized to the box ran under the status chip and over the
// drivers. Drawing the card itself is what makes the collision impossible.
//
// The chair is NOT here — it renders furniture under an ordinary label, the
// way the record box (spec/120) renders its rows under its title.
export function isCollabPanelShape(kind: ShapeKind): boolean {
  return (
    isEstimateShape(kind) ||
    isTemperatureShape(kind) ||
    isIdeaBoxShape(kind) ||
    isAgendaShape(kind) ||
    isRollCallShape(kind) ||
    isDecisionShape(kind)
  );
}
