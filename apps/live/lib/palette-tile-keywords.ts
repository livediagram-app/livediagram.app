// The words a palette tile is found by, beyond its name: shared by the global Search panel's "Add to
// canvas" results (lib/palette-search.ts) and the Toolbar strip's Search
// (docs/specs/007-editor/toolbar-layout.md "Search: every element type"), so both find an element by
// the same words. Kept apart from palette-search, which also enumerates the icon catalogues, so the
// strip pulls in only this.

import type { ShapeKind } from '@livediagram/document';

import type { PaletteTileDef } from '@/components/palette/palette-tile-defs';

// Search synonyms per shape: the words somebody types when they don't know
// what we called it ("database" for the cylinder, "swimlane" for the lane).
// Only the extra vocabulary lives here — the NAME and the description come
// from the shared tile catalogue, so a new element type shows up in search the
// moment its tile exists, with or without an entry below.
//
// This used to be a hand-written list of the shapes themselves, and it had
// silently fallen 22 kinds behind the palette: every Devices, Data, Media and
// Behaviour element was unfindable from the search panel.
export const SHAPE_KEYWORDS: Partial<Record<ShapeKind, string>> = {
  square: 'square box rect node',
  circle: 'oval ellipse round node',
  diamond: 'decision rhombus flowchart',
  cylinder: 'database storage db disk',
  parallelogram: 'input output io flowchart',
  hexagon: 'preparation milestone',
  document: 'page report file',
  stadium: 'pill terminator start end rounded',
  cloud: 'internet network external',
  triangle: 'warning delta',
  trapezoid: 'manual operation',
  star: 'favourite highlight rating',
  'speech-bubble': 'comment callout chat note',
  frame: 'section container group region',
  page: 'document doc write article heading',
  'mind-node': 'mind map brainstorm branch idea tree',
  lane: 'swimlane band row track process',
  entity: 'record table uml class er schema field',
  'mode-button': 'mode switch button press avatar',
  portal: 'teleport jump link warp travel',
  'session-button': 'timer vote poll session start',
  reveal: 'hide cover spoiler blur uncover',
  picker: 'random pick spinner wheel choose',
  chair: 'seat sit stool furniture',
  estimate: 'points sizing poker fist estimate vote',
  temperature: 'mood check pulse gauge feeling',
  quiz: 'quiz question trivia test answer correct right wrong multiple choice timed kahoot',
  'idea-box': 'suggestions ideas inbox submit',
  'qa-board': 'slido q&a questions ask upvote vote rank queue audience ama',
  agenda: 'plan schedule topics running order',
  decision: 'decided outcome record resolution',
  'roll-call': 'attendance present who register',
  'comment-pin': 'annotate feedback discuss thread remark marker note',
  'action-card': 'task todo to-do assign assignee follow-up owner action item',
  'focus-button':
    'look here attention bring everyone jump navigate spotlight point show gather focus',
  'done-check': 'complete finished tick ready everyone signed off',
  'reaction-pad': 'emoji react clap applause celebrate burst',
  actor: 'person stick figure user role uml',
  browser: 'web page window chrome site',
  monitor: 'screen desktop display computer',
  laptop: 'macbook notebook computer',
  phone: 'mobile iphone android handset',
  tablet: 'ipad slate',
  foldable: 'fold flip unfolded hinge dual screen book phone',
  smartwatch: 'watch wearable wrist',
  'progress-bar': 'bar meter percent loading completion',
  'progress-ring': 'donut ring percent gauge dial',
  'timeline-rail': 'timeline roadmap milestones track',
  rating: 'stars score review out of five',
  legend: 'key colour code swatch label caption guide colour key',
  'pie-chart': 'donut share split proportion chart',
  'bar-chart': 'column histogram chart graph',
  'line-chart': 'trend series graph chart plot',
  'code-block': 'code snippet syntax monospace program',
  checklist: 'todo tasks tick checkbox list',
  // Plan (docs/specs/026-plan/plan-mode.md): the words people bring from Jira, Trello and retros.
  'plan-board':
    'board kanban scrum sprint retro retrospective roadmap backlog columns swimlanes wip jira trello triage week planner',
  'plan-card': 'card ticket task story bug epic issue item todo note idea action risk jira trello',
  'plan-view':
    'gantt timeline calendar due dates workload capacity status breakdown donut chart dashboard report widget priority matrix',
  // The Sheet (docs/specs/029-sheets/sheet.md).
  'plan-sheet':
    'spreadsheet sheet excel google sheets table grid cells formula budget csv numbers calculate',
};

/** A tile's search keywords: for a shape, its kind's synonyms; for any other tile, its label and
 *  blurb. Either way the tile's own description joins them, so the sentence the palette already
 *  writes about an element is searchable without being written twice. */
export function tileKeywords(tile: PaletteTileDef): string {
  const a = tile.action;
  if (a.type === 'shape') return `shape ${SHAPE_KEYWORDS[a.kind] ?? ''} ${tile.description}`;
  return `${tile.label} ${tile.blurb ?? ''} ${tile.description}`;
}
