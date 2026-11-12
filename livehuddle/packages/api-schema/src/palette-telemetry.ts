// livehuddle's palette telemetry tokens (docs/specs/017-telemetry/telemetry.md "The palette's categories"), split out of
// telemetry-schema.ts, which re-exports them so `@livehuddle/api-schema` callers keep one import.

// The `Element·Added` type tokens that correspond to a PALETTE item, in the buckets the public dashboard ranks them
// by (docs/specs/017-telemetry/telemetry.md "The palette's categories"): one per category of livehuddle's palette,
// in the category bar's order (docs/specs/010-palette/palette-top-level-categories.md "The strip's order"), so the
// dashboard's Elements Added and Palette section read the way a Space is built.
//
// Shared here, rather than hand-mirrored in the dashboard, because both ends of this have to agree exactly: the
// editor picks the token when it emits, the dashboard buckets by it when it renders, and a token in one but not the
// other is invisible in the worst way: the event is emitted, validated, and stored, and simply never appears on the
// page. That had already happened once: the dashboard still expected `Code-block` long after the editor settled on
// `CodeBlock`, so every code block anyone drew was missing from the Palette ranking.
//
// `retired` holds the kinds that came from livediagram and that no palette category offers any more
// (docs/specs/002-project-scope/not-in-livehuddle.md): a stored one still loads, and the element code stays until
// Work Tracker #459 removes it, so a pasted or agent-made one is still counted, under Other Elements Added rather
// than a category of its own.
//
// Not every `Element·Added` token belongs here. `TableRow` / `TableColumn` are structure edits inside an existing
// table, not palette picks, so they are deliberately absent.
export const PALETTE_TELEMETRY_TYPES = {
  // Write: a word or a note, and the stickers Search finds.
  write: ['Text', 'Sticky', 'Sticker'],
  // Rooms: the floor plan, rooms and doors first, then what lays out the floor.
  rooms: [
    'Room',
    // A room drawn with the Room Builder (docs/specs/009-elements/room-builder.md "Telemetry").
    'CustomRoom',
    // The Corridor (docs/specs/009-elements/corridor.md), beside the rooms.
    'Corridor',
    'Door',
    // The Window (docs/specs/009-elements/room-builder.md "Window").
    'Window',
    'Fence',
    'Stage',
    'Stage-curtains',
    'Podium',
    'Office-pod',
    'Phone-booth',
    'Nap-pod',
    'Reception-desk',
    'Rug',
    'Pillar',
    'Column',
  ],
  // Seats: where people sit.
  seats: [
    'Chair',
    'Desk',
    'Sofa',
    'Meeting-table',
    'Bean-bag',
    'Reading-nook',
    'Hot-desk',
    'Standing-desk',
  ],
  // Perks: the office, the kitchen and the restroom.
  perks: [
    'Plant',
    'Bookshelf',
    'Printer',
    'Copier',
    'Lockers',
    'Coat-rack',
    'Umbrella-stand',
    'Water-cooler',
    'Coffee-machine',
    'Vending-machine',
    'Kitchen-counter',
    'Kitchen-sink',
    'Fridge',
    'Microwave',
    'Kettle',
    'Toilet-cubicle',
    'Washbasin',
    'Hand-dryer',
  ],
  // Play: the bar, the games, the gym and the lounge.
  play: [
    'Bar',
    'Bar-stool',
    'Drinks-cabinet',
    'Drinks-fridge',
    'Ping-pong-table',
    'Pool-table',
    'Foosball-table',
    'Arcade-machine',
    'Dartboard',
    'Treadmill',
    'Weight-bench',
    'Jukebox',
    'Fireplace',
    'Pet-bed',
  ],
  // Garden: plants, paths, garden furniture, water and fire, and the parking.
  garden: [
    'Outdoor-plant',
    'Tree',
    'Grass',
    'Garden-path',
    'Garden-fence',
    'Bench',
    'Picnic-table',
    'Hammock',
    'Garden-umbrella',
    'Fountain',
    'Pond',
    'Swimming-pool',
    'Campfire',
    'Car-park',
    'Bike-rack',
  ],
  // Meet: a meeting room's own pieces.
  meet: [
    'Screen',
    'Room-sign',
    'Notice-board',
    'World-clock',
    'Calendar-wall',
    'Suggestion-box',
    'Photo-wall',
    'Timer',
    'Stopwatch',
  ],
  // Travel: what takes people somewhere.
  travel: [
    'Portal',
    'Focus-button',
    'Avatar-pad',
    'Directory',
    'Signpost',
    'Elevator',
    'Stairs',
    'ModeButton',
  ],
  // Retired: what came from livediagram and no category offers (above).
  retired: [
    'Square',
    'Circle',
    'Diamond',
    'Cylinder',
    'Parallelogram',
    'Hexagon',
    'Document',
    'Stadium',
    'Cloud',
    'Triangle',
    'Trapezoid',
    'Star',
    'Speech-bubble',
    'Final-state',
    'Freehand',
    'Arrow',
    'Table',
    'Image',
    'Avatar',
    'Actor',
    'Frame',
    'Annotation',
    'PointerNote',
    'LinkCard',
    'Video',
    'Highlighter',
    'Polygon',
    'Polyline',
    'Timeline-rail',
    'CodeBlock',
    'Page',
    'MindNode',
    'Flowchart',
    'FlowchartStep',
    'Lane',
    'Boundary',
    'OrgChart',
    'Stack',
    'Sequence',
    'DiagramKey',
    'Entity',
    'Checklist',
    'SessionButton',
    'Reveal',
    'Picker',
    'ReactionPad',
    'DoneCheck',
    'Quiz',
    'Pie-chart',
    'Bar-chart',
    'Line-chart',
    'Progress-bar',
    'Progress-ring',
    'Rating',
    'Legend',
    'Sankey',
    'Estimate',
    'Temperature',
    'Idea-box',
    'Qa-board',
    'Agenda',
    'Decision',
    'Roll-call',
    'CommentPin',
    'ActionPanel',
    'Banner',
    'Hero',
    'Header',
    'Callout',
    'StatRow',
    'ProcessSteps',
    'Card',
    'Badge',
    'Step',
    'LayerStack',
    'Pyramid',
    'Cycle',
    'Hub',
    'Onion',
    'Chevrons',
    'Browser',
    'Monitor',
    'Laptop',
    'Phone',
    'Tablet',
    'Foldable',
    'Smartwatch',
    'Icon',
    'TechIcon',
  ],
} as const satisfies Record<string, readonly string[]>;

// Every palette token, flattened, the set an emitter can be checked against.
export const ALL_PALETTE_TELEMETRY_TYPES: readonly string[] =
  Object.values(PALETTE_TELEMETRY_TYPES).flat();
