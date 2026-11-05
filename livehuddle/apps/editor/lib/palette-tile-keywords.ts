// The words a palette tile is found by, beyond its name: shared by the global Search panel's "Add to
// canvas" results (lib/palette-search.ts) and the Toolbar strip's Search
// (docs/specs/007-editor/toolbar-layout.md "Search: every element type"), so both find an element by
// the same words. Kept apart from palette-search, which also enumerates the icon catalogues, so the
// strip pulls in only this.

import type { ShapeKind } from '@livehuddle/document';

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
// 'estimate' (retired in Work Tracker #423 part 4) keeps its row until open PR #1310, which adds the stage beside it,
// merges; the row matches no tile, so it finds nothing.
export const SHAPE_KEYWORDS: Partial<Record<ShapeKind | 'estimate', string>> = {
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
  page: 'document doc write article heading',
  lane: 'swimlane band row track process',
  card: 'node service component box tile persona tag title',
  badge: 'tag pill label chip status version beta new count',
  step: 'number numbered sequence order walkthrough marker 1 2 3',
  stack: 'stack row column grid auto layout flex align distribute even gap spacing container list',
  'diagram-key': 'legend key line styles dashed solid meaning tag colours colour code explain',
  'pointer-note':
    'annotation callout leader line pointer note comment explain here arrow pin label',
  boundary: 'region zone vpc network container group cloud system c4 subnet cluster',
  'mode-button': 'mode switch button press avatar',
  portal: 'teleport jump link warp travel',
  chair: 'seat sit stool furniture',
  desk: 'computer office workstation monitor screen sit seat furniture',
  sofa: 'couch settee loveseat two seater sit seat furniture lounge',
  fence: 'barrier wall block boundary enclosure keep out avatar walk',
  'avatar-pad': 'spawn start entrance arrive arrival teleport beam lobby avatar walk pad',
  directory:
    'directory kiosk map wayfinding rooms who is where people find go walk there sign lobby',
  elevator: 'elevator lift floor floors tab tabs stairs up down travel go building level',
  room: 'office room walls door doorway meeting kitchen lounge area space zone floor virtual office',
  'meeting-table': 'meeting table conference boardroom seats chairs sit together team office',
  plant: 'plant pot potted green leaves foliage decoration office scenery',
  bookshelf: 'bookshelf books shelves library bookcase office scenery',
  'water-cooler': 'water cooler drink cup kitchen break chat office',
  'coffee-machine': 'coffee machine espresso drink cup mug kitchen break office',
  'office-pod': 'office pod booth phone booth focus private call meeting two seats door quiet',
  bar: 'bar counter pub drinks bottles social after work',
  'bar-stool': 'bar stool seat sit high chair',
  'drinks-cabinet': 'drinks cabinet juice bottles drink cup bar',
  'drinks-fridge': 'drinks fridge soda cans cold drink cup bar cooler',
  'outdoor-plant': 'outdoor plant shrub bush flowers planter garden scenery',
  tree: 'tree garden park outdoor shade scenery',
  'garden-path': 'garden path stepping stones gravel walkway outdoor floor',
  grass: 'grass lawn turf green garden park field outdoor floor',
  'notice-board': 'notice board cork board pin pinned notes announcements wall bulletin message',
  'world-clock':
    'world clock time zone timezone wall clock hours london new york tokyo remote team',
  jukebox: 'jukebox music radio stream song background audio play lounge',
  'ping-pong-table': 'ping pong table tennis game play recreation two players',
  'arcade-machine': 'arcade machine game cabinet retro video game play recreation insert coin',
  fireplace: 'fireplace fire hearth cosy lounge warm gather flames',
  campfire: 'campfire fire camp stones logs gather garden outdoor flames',
  bench: 'bench garden park seat sit outdoor two seats',
  'picnic-table': 'picnic table garden park outdoor lunch seats sit six',
  hammock: 'hammock relax rest garden outdoor sit lie',
  'garden-umbrella': 'garden umbrella parasol shade sun patio outdoor',
  fountain: 'fountain water stone basin garden park outdoor',
  pond: 'pond water lily pads lake garden park outdoor',
  screen:
    'screen tv television monitor display wall screen share presentation video youtube meeting room',
  'room-sign':
    'room sign door sign plaque free busy in use occupied do not disturb knock meeting room',
  'garden-fence': 'garden fence picket low fence barrier outdoor',
  rug: 'rug carpet mat floor lounge reception office',
  stage:
    'stage platform podium all-hands all hands town hall keynote presenter speaker speak broadcast audience',
  estimate: 'points sizing poker fist estimate vote',
  'focus-button':
    'look here attention bring everyone jump navigate spotlight point show gather focus',
  actor: 'person stick figure user role uml',
  'progress-bar': 'bar meter percent loading completion',
  'progress-ring': 'donut ring percent gauge dial',
  'timeline-rail': 'timeline roadmap milestones track history plan dates schedule',
  rating: 'stars score review out of five',
  legend: 'key colour code swatch label caption guide colour key',
  'pie-chart': 'donut doughnut ring share split proportion chart',
  'bar-chart': 'column bar horizontal histogram chart graph',
  'line-chart': 'trend series graph chart plot area scatter xy',
  'code-block': 'code snippet syntax monospace program',
  checklist: 'todo tasks tick checkbox list',
};

/** A tile's search keywords: for a shape, its kind's synonyms; for any other tile, its label and
 *  blurb. Either way the tile's own description joins them, so the sentence the palette already
 *  writes about an element is searchable without being written twice. */
export function tileKeywords(tile: PaletteTileDef): string {
  const a = tile.action;
  if (a.type === 'shape') return `shape ${SHAPE_KEYWORDS[a.kind] ?? ''} ${tile.description}`;
  return `${tile.label} ${tile.blurb ?? ''} ${tile.description}`;
}
