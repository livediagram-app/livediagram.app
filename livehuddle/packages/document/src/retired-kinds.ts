// Retired elements (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements"): a stored element whose
// kind livehuddle no longer has, a shape kind or a whole element type. Work Tracker #423 part 4 deleted the
// Collaborate elements' code and #459 deletes the diagram tools' ("The element engine"); a Space that already holds
// one keeps it exactly as stored and draws a plain labelled placeholder in its box. Nothing here reads the
// element's own fields beyond its type and kind (and a session button's tool, for its name), so whatever it carries
// rides through a save, a sync, a copy and an undo untouched.

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
  // The element engine, part 1 (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine"): the
  // content widgets.
  'pie-chart': 'Pie Chart',
  'bar-chart': 'Bar Chart',
  'line-chart': 'Line Chart',
  legend: 'Legend',
  'progress-bar': 'Progress Bar',
  'progress-ring': 'Progress Ring',
  rating: 'Rating',
  'code-block': 'Code Block',
  checklist: 'Checklist',
  page: 'Page',
  banner: 'Banner',
  'stat-row': 'Stat Row',
  process: 'Process',
  'site-header': 'Site Header',
  // Part 3: the layout containers.
  lane: 'Lane',
  stack: 'Stack',
  boundary: 'Boundary',
  'timeline-rail': 'Timeline',
  'diagram-key': 'Diagram Key',
  card: 'Card',
  callout: 'Callout',
  badge: 'Badge',
  step: 'Step Number',
  'pointer-note': 'Pointer Note',
  // Part 5: the diagram shapes, the Shapes category's kinds and the UML ones (DEFAULTS.md D29).
  square: 'Square',
  circle: 'Circle',
  diamond: 'Diamond',
  cylinder: 'Cylinder',
  parallelogram: 'Parallelogram',
  hexagon: 'Hexagon',
  document: 'Document',
  stadium: 'Stadium',
  actor: 'Actor',
  'final-state': 'Final State',
  cloud: 'Cloud',
  triangle: 'Triangle',
  trapezoid: 'Trapezoid',
  star: 'Star',
  'speech-bubble': 'Speech Bubble',
};

// The element TYPES the element engine deleted (docs/specs/002-project-scope/not-in-livehuddle.md "The element
// engine"), by the name a person knew them by. Validation still accepts a stored one on its box, so it loads.
export const RETIRED_TYPE_NAMES: Readonly<Record<string, string>> = {
  // The video and website embeds (part 1), named Embed since they carried Figma files and Google Docs too.
  video: 'Embed',
  // Tables (part 2), with their cell links and styles.
  table: 'Table',
  // Part 4: arrows and lines (named Line when stored without heads, retiredElementName), every pen and highlighter
  // stroke, paths and annotation markers.
  arrow: 'Arrow',
  freehand: 'Drawing',
  path: 'Path',
  annotation: 'Annotation',
};

// The boxed retired types: every one but the arrow, which has two ends rather than a box (./retired-arrow).
export const RETIRED_ELEMENT_TYPES: ReadonlySet<string> = new Set(
  Object.keys(RETIRED_TYPE_NAMES).filter((type) => type !== 'arrow'),
);

// Is this a boxed element type the element engine deleted? (A stored arrow is retired too, but has no box:
// isRetiredElement answers for both.)
export function isRetiredElementType(type: unknown): boolean {
  return typeof type === 'string' && RETIRED_ELEMENT_TYPES.has(type);
}

// A session button was named after the tool it started.
const SESSION_TOOL_NAMES: Readonly<Record<string, string>> = {
  timer: 'Timer',
  stopwatch: 'Stopwatch',
  vote: 'Dot Vote',
  poll: 'Poll',
};

export const UNKNOWN_ELEMENT_NAME = 'Unknown Element';

// The line under the name on every placeholder: with the name above it, it reads as one sentence about the element.
export const RETIRED_ELEMENT_NOTE = 'No longer supported in livehuddle';

type MaybeShape = { type: string; shape?: unknown };

// A stored Frame (docs/specs/002-project-scope/not-in-livehuddle.md "The Frame") was a backdrop: what sat on it was
// drawn above it. So were the containers part 3 of the element engine deleted (a lane, a stack, a boundary). Their
// placeholders keep that place at the back, so they never cover what sat on them.
const RETIRED_BACKDROPS: ReadonlySet<string> = new Set(['frame', 'lane', 'stack', 'boundary']);

export function isRetiredBackdrop(el: MaybeShape): boolean {
  return el.type === 'shape' && typeof el.shape === 'string' && RETIRED_BACKDROPS.has(el.shape);
}

// Is this an element livehuddle cannot draw: a shape of a kind it deleted or never had, or an element of a type it
// deleted?
export function isRetiredElement(el: MaybeShape): boolean {
  if (el.type === 'arrow' || isRetiredElementType(el.type)) return true;
  return el.type === 'shape' && !(typeof el.shape === 'string' && SHAPE_KINDS.has(el.shape));
}

// What the placeholder calls it.
export function retiredElementName(el: {
  type?: unknown;
  shape?: unknown;
  session?: unknown;
  arrowEnds?: unknown;
}): string {
  if (el.type === 'arrow' && el.arrowEnds === 'none') return 'Line';
  if (typeof el.type === 'string' && Object.hasOwn(RETIRED_TYPE_NAMES, el.type))
    return RETIRED_TYPE_NAMES[el.type]!;
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
