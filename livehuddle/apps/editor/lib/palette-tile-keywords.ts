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
  stairs:
    'stairs staircase stairway steps flight floor floors upstairs downstairs up down climb tab tabs travel building level',
  room: 'office room walls door doorway meeting kitchen lounge area space zone floor virtual office boardroom open plan l-shaped octagon preset',
  corridor:
    'corridor hallway hall passage walkway junction corner crossroads tee walls open ends join rooms',
  door: 'door doorway entrance exit way in opening wall gap room builder double sliding revolving glass',
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
  timer:
    'timer countdown count down timebox time box minutes clock alarm chime meeting stand-up standup pomodoro',
  stopwatch: 'stopwatch stop watch count up elapsed time clock lap meeting how long',
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
  'pool-table': 'pool table snooker billiards cue balls pockets game play recreation games room',
  'foosball-table':
    'foosball table football soccer table football rods game play recreation games room',
  dartboard: 'dartboard darts board wall game pub play recreation games room',
  'vending-machine': 'vending machine snacks drinks cans soda break room kitchen lit glow',
  'bean-bag': 'bean bag beanbag seat sit lounge relax breakout chill',
  'reading-nook': 'reading nook armchair lamp books quiet corner seat sit lounge library breakout',
  printer: 'printer print laser paper office copy page tray',
  copier: 'copier photocopier copy machine printer scanner paper trays office',
  lockers: 'lockers locker bank storage gym changing room entrance hot desk',
  'coat-rack': 'coat rack stand hat stand hooks coats jacket scarf entrance hallway',
  'umbrella-stand': 'umbrella stand umbrellas rain entrance hallway',
  'kitchen-counter': 'kitchen counter worktop cupboard unit cabinet kitchenette',
  'kitchen-sink': 'kitchen sink tap wash up washing up worktop unit kitchenette',
  fridge: 'fridge refrigerator freezer kitchen kitchenette',
  microwave: 'microwave oven kitchen kitchenette worktop',
  kettle: 'kettle tea hot water kitchen kitchenette worktop',
  'toilet-cubicle': 'toilet cubicle stall wc loo lavatory bathroom restroom washroom',
  washbasin: 'washbasin basin sink mirror wash hands bathroom restroom washroom',
  'hand-dryer': 'hand dryer drier wall bathroom restroom washroom',
  pillar: 'pillar post support structure hall lobby atrium square concrete',
  column: 'column pillar classical greek roman ionic stone hall lobby grand structure',
  'car-park': 'car park parking lot garage cars bays arrivals campus drive',
  'bike-rack': 'bike rack bicycle cycle stand parking arrivals campus commute',
  'swimming-pool': 'swimming pool swim water lanes hotel rooftop beach resort spa lido',
  'stage-curtains': 'stage curtains drapes theatre theater proscenium velvet backdrop show event',
  podium: 'podium lectern speaker microphone mic talk keynote stage presentation event',
  'nap-pod': 'nap pod sleep rest quiet focus lounger cocoon recharge wellbeing heads down',
  treadmill: 'treadmill running machine gym fitness exercise run walk break wellbeing',
  'weight-bench':
    'weight bench weights barbell dumbbells gym fitness lift exercise break wellbeing',
  'phone-booth': 'phone booth call private quiet pod one person busy telephone',
  'standing-desk': 'standing desk stand up sit stand adjustable desk work monitor',
  'hot-desk': 'hot desk hot-desking hotdesk desk claim name card flexible seat work',
  'pet-bed': 'pet bed dog cat office dog pet corner puppy animal pat',
  'reception-desk': 'reception desk front desk welcome lobby arrival bell service bell concierge',
  'calendar-wall': 'calendar wall planner month dates days schedule events notes year diary',
  'suggestion-box': 'suggestion box ideas feedback anonymous idea box comments survey drop note',
  signpost: 'signpost sign post arrows directions wayfinding finger post way walk rooms nearest',
  'photo-wall': 'team photo wall photos portraits pictures frames people faces who is here gallery',
  screen:
    'screen tv television monitor display wall screen share presentation video youtube meeting room',
  'room-sign':
    'room sign door sign plaque free busy in use occupied do not disturb knock meeting room',
  'garden-fence': 'garden fence picket low fence barrier outdoor',
  rug: 'rug carpet mat floor lounge reception office round bordered runner striped persian kilim doormat pattern',
  stage:
    'stage platform podium all-hands all hands town hall keynote presenter speaker speak broadcast audience',
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
