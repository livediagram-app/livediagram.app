// Retired elements (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements"): a stored shape whose
// kind livehuddle no longer has. Work Tracker #423 part 4 deleted the Collaborate elements' code; a Space that
// already holds one keeps it exactly as stored and draws a plain labelled placeholder in its box. Nothing here
// reads the element's own fields beyond its kind (and a session button's tool, for its name), so whatever it
// carries rides through a save, a sync, a copy and an undo untouched.

import { SHAPE_KINDS } from './shape-kinds';

// The kinds part 4 deleted, by the name a person knew them by. A kind livehuddle never had reads as
// UNKNOWN_ELEMENT_NAME.
export const RETIRED_SHAPE_NAMES: Readonly<Record<string, string>> = {
  'session-button': 'Session Button',
  reveal: 'Reveal Zone',
  picker: 'Picker',
  'comment-pin': 'Comment Panel',
  'action-card': 'Action Panel',
  'done-check': 'Done Check',
  estimate: 'Estimate Card',
  temperature: 'Temperature Check',
  'idea-box': 'Idea Box',
  'qa-board': 'Q&A Board',
  agenda: 'Agenda',
  decision: 'Decision Record',
  'roll-call': 'Roll Call',
  quiz: 'Quiz',
  // The Reaction Pad left with the presenting tools (docs/specs/002-project-scope/not-in-livehuddle.md "The presenting
  // tools, Isometric and Zen").
  'reaction-pad': 'Reaction Pad',
  // The Frame left on its own (docs/specs/002-project-scope/not-in-livehuddle.md "The Frame").
  frame: 'Frame',
};

// A session button was named after the tool it started.
const SESSION_TOOL_NAMES: Readonly<Record<string, string>> = {
  timer: 'Timer',
  stopwatch: 'Stopwatch',
  vote: 'Dot Vote',
  poll: 'Poll',
};

export const UNKNOWN_ELEMENT_NAME = 'Unknown Element';

// The line under the name on every placeholder.
export const RETIRED_ELEMENT_NOTE = 'Not in livehuddle';

type MaybeShape = { type: string; shape?: unknown };

// A stored Frame (docs/specs/002-project-scope/not-in-livehuddle.md "The Frame") was a backdrop: what sat on it was
// drawn above it. Its placeholder keeps that place at the back, so it never covers what sat on it.
export function isRetiredBackdrop(el: MaybeShape): boolean {
  return el.type === 'shape' && el.shape === 'frame';
}

// Is this a shape whose kind livehuddle cannot draw: one part 4 deleted, or one it never had?
export function isRetiredElement(el: MaybeShape): boolean {
  return el.type === 'shape' && !(typeof el.shape === 'string' && SHAPE_KINDS.has(el.shape));
}

// What the placeholder calls it.
export function retiredElementName(el: { shape?: unknown; session?: unknown }): string {
  const kind = typeof el.shape === 'string' ? el.shape : '';
  if (kind === 'session-button') {
    const tool = (el.session as { tool?: unknown } | undefined)?.tool;
    const name =
      typeof tool === 'string' && Object.hasOwn(SESSION_TOOL_NAMES, tool)
        ? SESSION_TOOL_NAMES[tool]
        : undefined;
    if (name) return name;
  }
  return (
    (Object.hasOwn(RETIRED_SHAPE_NAMES, kind) ? RETIRED_SHAPE_NAMES[kind] : undefined) ??
    UNKNOWN_ELEMENT_NAME
  );
}
