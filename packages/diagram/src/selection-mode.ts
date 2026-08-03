// The selection modes a Mode Button element can switch someone into
// (spec/103). The editor's own `CanvasTool` union is the same vocabulary, but it
// lives in the live app; this is the DATA half — what a saved element may carry
// — so it belongs with the model, where validation can reach it.
//
// Kept deliberately as the full set: a button that hands someone the Eraser is
// odd but not our call to forbid, and the author picks from a menu that names
// each one.

export const SELECTION_MODES = [
  'select',
  'pan',
  'laser',
  'spotlight',
  'avatar',
  'eraser',
  'format',
  'isometric',
] as const;

export type SelectionMode = (typeof SELECTION_MODES)[number];

// The mode a Mode Button switches to when it carries none — the reason the
// element exists (spec/101 walkthroughs), so it is the default rather than
// Select.
export const DEFAULT_BUTTON_MODE: SelectionMode = 'avatar';

export function isSelectionMode(value: unknown): value is SelectionMode {
  return typeof value === 'string' && (SELECTION_MODES as readonly string[]).includes(value);
}

// Shape kinds that are a FIXED SIZE: a control, not a box you draw. They get no
// resize handles, ignore a drag-to-draw's size, and are left alone when a
// multi-selection is scaled — a button that is 40px on one diagram and 400 on
// another stops looking like part of the product.
export const FIXED_SIZE_SHAPES: ReadonlySet<string> = new Set(['mode-button', 'session-button']);

export function isFixedSizeShape(kind: string): boolean {
  return FIXED_SIZE_SHAPES.has(kind);
}

// The Selection Mode button's original default skin (spec/103): a solid brand
// fill with white text. It was replaced by a light button surface, but the
// colours are stored ON the element, so every button authored before the
// change would keep the old slab look forever.
//
// So the exact original trio is treated as "the author never picked colours",
// and such a button renders with today's defaults. An author who genuinely
// wants that blue can pick it again from the menu — at which point it is a
// deliberate choice on a NEW-look button (the text colour differs), and this
// no longer matches.
const LEGACY_BUTTON_SKIN = { fill: '#0ea5e9', stroke: '#0284c7', text: '#ffffff' };

export function isLegacyModeButtonSkin(el: {
  shape?: string;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
}): boolean {
  return (
    el.shape === 'mode-button' &&
    el.fillColor === LEGACY_BUTTON_SKIN.fill &&
    el.strokeColor === LEGACY_BUTTON_SKIN.stroke &&
    el.textColor === LEGACY_BUTTON_SKIN.text
  );
}

// Today's default skin, for the elements above.
export const MODE_BUTTON_SKIN = { fill: '#ffffff', stroke: '#cbd5e1', text: '#0f172a' } as const;

// --- Session button (spec/105) ----------------------------------------------

// Which session tool a `session-button` starts when pressed. The vocabulary
// lives here with the other Behaviour-element data (rather than in the editor)
// because a saved element carries it, so validation has to reach it.
export const SESSION_TOOLS = ['timer', 'vote', 'poll'] as const;
export type SessionTool = (typeof SESSION_TOOLS)[number];

// What a button with no configuration does. A timer is the safest default: it
// starts nothing that anyone has to answer, and it is the tool a board reaches
// for most often.
export const DEFAULT_SESSION_TOOL: SessionTool = 'timer';
export const DEFAULT_TIMER_MINUTES = 5;
export const DEFAULT_VOTE_DOTS = 3;

// Bounds, applied wherever a value is read rather than only where it is typed:
// a hand-written API payload gets the same treatment as the menu's own input.
export const TIMER_MINUTES_RANGE = { min: 1, max: 120 } as const;
export const VOTE_DOTS_RANGE = { min: 1, max: 10 } as const;
export const SESSION_POLL_MAX_OPTIONS = 6;

// What pressing a session button starts. One object rather than five loose
// fields on ShapeElement: the settings only mean anything together, and only
// for this kind.
export type SessionButtonConfig = {
  tool: SessionTool;
  // Timer: how long to count down. Vote: dots per person.
  minutes?: number;
  dots?: number;
  // Poll: the question and its answers, written in advance so the press opens
  // the poll rather than a composer.
  question?: string;
  options?: string[];
};

/**
 * A ready-to-use config for one session tool (spec/105).
 *
 * The palette offers a tile PER TOOL rather than one button you then
 * reconfigure, so "Add poll" has to place a working poll. A poll in
 * particular needs a question and two answers to be startable at all —
 * `sessionPlan` returns null below that — so dropping one with an empty
 * config would place a button that cannot be pressed.
 */
export function defaultSessionConfig(tool: SessionTool): SessionButtonConfig {
  if (tool === 'vote') return { tool, dots: DEFAULT_VOTE_DOTS };
  if (tool === 'poll') {
    return { tool, question: 'Which option?', options: ['Option A', 'Option B'] };
  }
  return { tool, minutes: DEFAULT_TIMER_MINUTES };
}

/** The button's own caption per tool, so a placed tile names what it starts. */
export const SESSION_TOOL_LABEL: Record<SessionTool, string> = {
  timer: 'Start timer',
  vote: 'Start dot vote',
  poll: 'Start poll',
};

export function isSessionTool(value: unknown): value is SessionTool {
  return typeof value === 'string' && (SESSION_TOOLS as readonly string[]).includes(value);
}

// What a press actually starts, once defaults are filled in and the numbers
// are clamped. Null means "this button can't start anything yet" — today only
// a poll with fewer than two answers, which is a half-written button rather
// than a broken one, so the face goes inert and says so.
export type SessionPlan =
  | { tool: 'timer'; minutes: number }
  | { tool: 'vote'; dots: number }
  | { tool: 'poll'; question: string; options: string[] };

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
export function sessionButtonPlan(config: SessionButtonConfig | undefined): SessionPlan | null {
  const tool = isSessionTool(config?.tool) ? config!.tool : DEFAULT_SESSION_TOOL;
  if (tool === 'timer') {
    return { tool, minutes: clamp(config?.minutes, DEFAULT_TIMER_MINUTES, TIMER_MINUTES_RANGE) };
  }
  if (tool === 'vote') {
    return { tool, dots: clamp(config?.dots, DEFAULT_VOTE_DOTS, VOTE_DOTS_RANGE) };
  }
  const options = (config?.options ?? [])
    .map((option) => (typeof option === 'string' ? option.trim() : ''))
    .filter((option) => option.length > 0)
    .slice(0, SESSION_POLL_MAX_OPTIONS);
  if (options.length < 2) return null;
  return { tool, question: (config?.question ?? '').trim() || 'Quick question', options };
}

// --- Picker (spec/107) ------------------------------------------------------

// Where a picker draws its candidates from: the people currently in the room,
// or a list written on the element.
export const PICKER_SOURCES = ['participants', 'options'] as const;
export type PickerSource = (typeof PICKER_SOURCES)[number];
export const DEFAULT_PICKER_SOURCE: PickerSource = 'participants';
export const PICKER_MAX_OPTIONS = 24;

export function isPickerSource(value: unknown): value is PickerSource {
  return typeof value === 'string' && (PICKER_SOURCES as readonly string[]).includes(value);
}
