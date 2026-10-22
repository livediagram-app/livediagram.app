// The Behaviour elements' stored configuration (docs/specs/012-collaboration/session-button.md,
// docs/specs/012-collaboration/picker.md): the DATA half — what a saved element may carry — so it belongs with
// the model, where validation can reach it.

// Shape kinds that are a FIXED SIZE: a control, not a box you draw. They get no
// resize handles, ignore a drag-to-draw's size, and are left alone when a
// multi-selection is scaled — a button that is 40px on one canvas and 400 on
// another stops looking like part of the product.
const FIXED_SIZE_SHAPES: ReadonlySet<string> = new Set([
  'session-button',
  // A badge fits its text (docs/specs/009-elements/badge.md): it is never resized by hand.
  'badge',
]);

export function isFixedSizeShape(kind: string): boolean {
  return FIXED_SIZE_SHAPES.has(kind);
}

// The element-level answer to "can this be resized?" — true for the
// fixed-size shape KINDS above, and for any element stamped `fixedSize` at
// creation (event-storming notes, docs/specs/021-event-storming/event-storming.md: the workshop stationery has
// fixed silhouettes). Structural param so leaf callers don't need the full
// Element union.
export function isFixedSizeElement(el: {
  type: string;
  shape?: string;
  fixedSize?: boolean;
}): boolean {
  if (el.fixedSize === true) return true;
  return el.type === 'shape' && el.shape != null && isFixedSizeShape(el.shape);
}

// The light control skin the session button and the picker wear (colors.ts pairs it with a dark one).
export const CONTROL_SKIN = { fill: '#ffffff', stroke: '#cbd5e1', text: '#0f172a' } as const;

// --- Session button (docs/specs/012-collaboration/session-button.md) ----------------------------------------------

// Which session tool a `session-button` starts when pressed. The vocabulary
// lives here with the other Behaviour-element data (rather than in the editor)
// because a saved element carries it, so validation has to reach it.
// `stopwatch` is its own tool rather than a mode of `timer` (docs/specs/012-collaboration/session-button.md). The
// two share a clock and nothing else: a countdown is placed with a LENGTH and
// the question is "how long", a stopwatch has no length and the question is
// only "start it". Folding them together meant a timer element's settings
// offered to turn it into a different element, which is not a setting.
export const SESSION_TOOLS = ['timer', 'stopwatch', 'vote'] as const;
export type SessionTool = (typeof SESSION_TOOLS)[number];

// What a button with no configuration does. A timer is the safest default: it
// starts nothing that anyone has to answer, and it is the tool most often
// reached for.
export const DEFAULT_SESSION_TOOL: SessionTool = 'timer';
export const DEFAULT_TIMER_MINUTES = 5;
export const DEFAULT_VOTE_DOTS = 3;

// Bounds, applied wherever a value is read rather than only where it is typed:
// a hand-written API payload gets the same treatment as the menu's own input.
export const TIMER_MINUTES_RANGE = { min: 1, max: 120 } as const;

export const VOTE_DOTS_RANGE = { min: 1, max: 10 } as const;

// What pressing a session button starts. One object rather than loose
// fields on ShapeElement: the settings only mean anything together, and only
// for this kind.
export type SessionButtonConfig = {
  tool: SessionTool;
  // Timer: how long to count down. Vote: dots per person.
  minutes?: number;
  dots?: number;
};

/**
 * A ready-to-use config for one session tool (docs/specs/012-collaboration/session-button.md).
 *
 * The palette offers a tile PER TOOL rather than one button you then
 * reconfigure, so each tile places a button that starts its tool as it is.
 */
export function defaultSessionConfig(tool: SessionTool): SessionButtonConfig {
  // A stopwatch has nothing to configure — that is the whole difference.
  if (tool === 'stopwatch') return { tool };
  if (tool === 'vote') return { tool, dots: DEFAULT_VOTE_DOTS };
  return { tool, minutes: DEFAULT_TIMER_MINUTES };
}

export function isSessionTool(value: unknown): value is SessionTool {
  return typeof value === 'string' && (SESSION_TOOLS as readonly string[]).includes(value);
}

// What a press actually starts, once defaults are filled in and the numbers
// are clamped.
export type SessionPlan =
  | { tool: 'timer'; minutes: number }
  // No length: a stopwatch counts up until somebody stops it.
  | { tool: 'stopwatch' }
  | { tool: 'vote'; dots: number };

const clamp = (
  value: number | undefined,
  fallback: number,
  range: { min: number; max: number },
) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(range.max, Math.max(range.min, Math.round(value)));
};

// Read a button's configuration into the thing to do. Clamping lives HERE
// rather than in the menu that types the number, so a value that arrived from
// the API, an import, or an older client gets the same treatment as one typed
// today — and a tab never fails to load over a duration someone can just fix.
export function sessionButtonPlan(config: SessionButtonConfig | undefined): SessionPlan {
  const tool = isSessionTool(config?.tool) ? config.tool : DEFAULT_SESSION_TOOL;
  if (tool === 'stopwatch') return { tool };
  if (tool === 'vote') {
    return { tool, dots: clamp(config?.dots, DEFAULT_VOTE_DOTS, VOTE_DOTS_RANGE) };
  }
  return { tool, minutes: clamp(config?.minutes, DEFAULT_TIMER_MINUTES, TIMER_MINUTES_RANGE) };
}

// --- Picker (docs/specs/012-collaboration/picker.md) ------------------------------------------------------

// Where a picker draws its candidates from: the people currently in the room,
// or a list written on the element.
export const PICKER_SOURCES = ['participants', 'options'] as const;
export type PickerSource = (typeof PICKER_SOURCES)[number];
export const DEFAULT_PICKER_SOURCE: PickerSource = 'participants';
export const PICKER_MAX_OPTIONS = 24;

export function isPickerSource(value: unknown): value is PickerSource {
  return typeof value === 'string' && (PICKER_SOURCES as readonly string[]).includes(value);
}
