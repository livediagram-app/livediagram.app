// The collaboration element family: the estimate card (docs/specs/012-collaboration/estimate-card.md), the
// temperature check (docs/specs/012-collaboration/temperature-check.md), the idea box (docs/specs/012-collaboration/idea-box.md), the agenda
// (docs/specs/012-collaboration/agenda.md), the decision record (docs/specs/012-collaboration/decision-record.md), the roll call (docs/specs/012-collaboration/roll-call.md) and the
// chair (docs/specs/009-elements/chair.md) — their kind predicates, closed enums, bounds and defaults.
//
// A LEAF module (types only) for the same reason data-shapes.ts is one:
// factories.ts reads these at module-init time, and importing them from
// './index' would put a runtime read inside the index ⇄ factories cycle.
// Everything here is re-exported from './index'.

import type { ShapeKind } from './index';
import { isQaBoardShape } from './qa-board';
import { isQuizShape } from './quiz';
import { isSelfDrawingShape } from './data-shapes';

// --- Estimate card (docs/specs/012-collaboration/estimate-card.md) ---------------------------------------------

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

// Whether an estimate card is still waiting for its scale (docs/specs/012-collaboration/estimate-card.md
// "Choosing a scale"): the palette places ONE Estimate card with no scale, and
// the card asks on the canvas. A card with no scale that already holds answers
// is an older card from before the choice existed, when no scale meant
// Fibonacci, so it keeps meaning that rather than hiding its round behind the
// chooser.
export function estimateScalePending(el: {
  shape?: string;
  estimateScale?: EstimateScale;
  responses?: readonly unknown[];
}): boolean {
  return (
    el.shape === 'estimate' && el.estimateScale === undefined && (el.responses ?? []).length === 0
  );
}

// Where a value sits on its scale, for sorting revealed cards low to high: the
// scale's own order (so a t-shirt round reads XS .. XL), with anything off the
// scale after it (docs/specs/012-collaboration/estimate-card.md "The two states").
export function estimateRank(scale: EstimateScale | undefined, value: string): number {
  const i = estimateValues(scale).indexOf(value);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

// The spread the card calls out once revealed: nobody, everyone agreeing, or
// the lowest and highest answers by the scale's order ('?' is an answer but
// not an end of the spread). `low` / `high` are the values to ring, absent
// when unanimous. Shared by the canvas face and the export.
export type EstimateSpread =
  | { kind: 'none' }
  | { kind: 'unanimous'; value: string }
  | { kind: 'range'; low: string; high: string };

export function estimateSpread(
  scale: EstimateScale | undefined,
  values: readonly string[],
): EstimateSpread {
  if (values.length === 0) return { kind: 'none' };
  const distinct = [...new Set(values)];
  if (distinct.length === 1) return { kind: 'unanimous', value: distinct[0]! };
  const sized = distinct.filter((v) => v !== '?');
  if (sized.length <= 1) return { kind: 'unanimous', value: sized[0] ?? '?' };
  const sorted = [...sized].sort((a, b) => estimateRank(scale, a) - estimateRank(scale, b));
  return { kind: 'range', low: sorted[0]!, high: sorted[sorted.length - 1]! };
}

export function estimateSpreadLabel(spread: EstimateSpread): string {
  if (spread.kind === 'none') return 'No answers';
  if (spread.kind === 'unanimous') return `Unanimous · ${spread.value}`;
  return `Spread ${spread.low} → ${spread.high}`;
}

// --- Temperature check (docs/specs/012-collaboration/temperature-check.md) -----------------------------------------

// Fist-of-five, fixed. Not configurable: it is a named ritual with a shared
// meaning (1 = blocked, 5 = enthusiastic), and a 1-to-7 variant would be a
// different instrument wearing the same face.
export const TEMPERATURE_VALUES: readonly string[] = ['1', '2', '3', '4', '5'];

export function isTemperatureShape(kind: ShapeKind): boolean {
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

// --- Idea box (docs/specs/012-collaboration/idea-box.md) ---------------------------------------------------

// Submissions are STRINGS, with nowhere to put an author. That is the
// anonymity guarantee expressed in the schema rather than in the UI.
export const IDEA_MAX_CARDS = 300;
export const IDEA_MAX_TEXT = 500;

export function isIdeaBoxShape(kind: ShapeKind): boolean {
  return kind === 'idea-box';
}

// --- Agenda (docs/specs/012-collaboration/agenda.md) -----------------------------------------------------

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
// on light and dark boards alike, where the light chip colours above sat pasted
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

export function isDecisionShape(kind: ShapeKind): boolean {
  return kind === 'decision';
}

// --- Roll call (docs/specs/012-collaboration/roll-call.md) --------------------------------------------------

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

// --- Chair (docs/specs/009-elements/chair.md) ------------------------------------------------------

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

// Which way somebody sitting in the chair looks, in the avatar's own facing
// vocabulary (the same four words CHAIR_FACING_LABELS prints). The seat points
// AWAY from the back, so a chair with its back at the top ('n') faces its
// sitter down the board.
export type ChairSitterFacing = 'down' | 'left' | 'up' | 'right';

export const CHAIR_SITTER_FACING: Record<ChairFacing, ChairSitterFacing> = {
  n: 'down',
  e: 'left',
  s: 'up',
  w: 'right',
};

// Where a seated character's FEET go, in canvas coords: the middle of the
// seat, a little off centre AWAY from the back so the figure sits ON the seat
// rather than floating at the box's midpoint. The chair's drawing rotates
// with its facing, so the seat does too. Shared by the walk hook (which snaps
// the sitter here) and the chair's own face (which draws the ring there).
export const CHAIR_SEAT_DROP = 0.62;

export function chairSeatPoint(
  box: { x: number; y: number; width: number; height: number },
  facing: ChairFacing = DEFAULT_CHAIR_FACING,
): { x: number; y: number } {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const offset = CHAIR_SEAT_DROP - 0.5;
  switch (facing) {
    case 'e':
      return { x: cx - box.width * offset, y: cy };
    case 's':
      return { x: cx, y: cy - box.height * offset };
    case 'w':
      return { x: cx + box.width * offset, y: cy };
    default:
      return { x: cx, y: box.y + box.height * CHAIR_SEAT_DROP };
  }
}

// --- The family ------------------------------------------------------------

// Every collaboration kind that draws a PRESSABLE FACE in place of the plain
// label — the same shape as the mode button / session button / reveal / picker
// (docs/specs/009-elements/mode-button.md to docs/specs/012-collaboration/picker.md), which each render a face while `!isEditing` and fall
// back to the ordinary label editor mid-edit. So the label is still typed,
// formatted and exported like any other; it is just drawn by the face.
//
// The decision record is here despite having nothing to press, because it owns
// its whole layout for the same reason: its label is a SENTENCE, and a
// free-flowing label sized to the box ran under the status chip and over the
// drivers. Drawing the card itself is what makes the collision impossible.
//
// The chair is NOT here — it renders furniture under an ordinary label, the
// way the record box (docs/specs/009-elements/entity.md) renders its rows under its title.
// Done check (docs/specs/012-collaboration/done-check.md): a room-response card like the rest of this family,
// so it takes the same panel chrome and the same viewer context.
export function isDoneCheckShape(kind: ShapeKind): boolean {
  return kind === 'done-check';
}

export function isCollabPanelShape(kind: ShapeKind): boolean {
  return (
    isDoneCheckShape(kind) ||
    isEstimateShape(kind) ||
    isTemperatureShape(kind) ||
    isIdeaBoxShape(kind) ||
    isQaBoardShape(kind) ||
    isAgendaShape(kind) ||
    isRollCallShape(kind) ||
    isDecisionShape(kind) ||
    isQuizShape(kind)
  );
}

// Kinds whose resting face draws its own layout and shows the label as a
// plain title (the collab panels, the session tools, the chair, the comment
// and action panels, the portal): the editor's ElementFaceRouter hands them
// the label string, never the aligned label node, so text alignment has
// nothing to move on them. Kept here, beside the kind predicates, so the
// router's list and the text-align gate below can't drift apart.
export function hasOwnFace(kind: ShapeKind): boolean {
  return (
    isCollabPanelShape(kind) ||
    kind === 'chair' ||
    kind === 'mode-button' ||
    kind === 'session-button' ||
    kind === 'focus-button' ||
    kind === 'reveal' ||
    kind === 'picker' ||
    kind === 'comment-pin' ||
    kind === 'action-card' ||
    kind === 'reaction-pad' ||
    kind === 'portal' ||
    isQuizShape(kind)
  );
}

// Whether double-click, Space or typing opens the inline label editor on this
// kind. Not on a self-drawing kind (it has no label), and not on a quiz
// (docs/specs/012-collaboration/quiz.md): its label is the question, which the
// Edit Quiz dialog owns, and editing it inline would print the hidden question
// over the closed disc for anybody who double-clicked the card.
export function opensInlineLabelEditor(kind: ShapeKind): boolean {
  return !isSelfDrawingShape(kind) && !isQuizShape(kind);
}

// Whether text alignment does anything on this kind: not a self-drawing kind
// (no label at all) and not one with its own face (the label is a fixed
// title), nor an icon (a glyph with a short caption under it; the alignment
// grid on it only ever nudged a caption nobody wanted moved; a sticker is
// self-drawing, so it is already out). The one gate for both the context menu
// and the quick style panel. Web components (banner, callout, header) and
// pages keep it: they render the aligned label.
export function supportsTextAlign(kind: ShapeKind): boolean {
  return !isSelfDrawingShape(kind) && !hasOwnFace(kind) && kind !== 'icon';
}

// Whether shape markers (docs/specs/009-elements/shape-markers.md) do anything on this kind: a marker
// decorates the label, so not on a self-drawing kind (no label) and not on one
// with its own face (the label is a fixed title the face draws, and a marker
// never shows on it). The one gate for the single-element and multi-selection
// menus.
export function supportsMarkers(kind: ShapeKind): boolean {
  return !isSelfDrawingShape(kind) && !hasOwnFace(kind);
}
