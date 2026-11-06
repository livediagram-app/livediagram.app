// Every valid ShapeKind, as a runtime set. A LEAF module (no runtime imports), so the kind predicates
// (./collab-shapes, ./retired-kinds) can read it without joining the index <-> factories module cycle; re-exported
// through ./validate.
//
// The editor renders only these. An off-vocabulary kind from an agent (e.g. "rectangle", which is NOT a kind: the
// rectangular box is "square") is coerced through `coerceShapeKind`; a stored one is a retired element
// (./retired-kinds), kept as stored and drawn as a placeholder. Keep in sync with the ShapeKind union in shape-kind.ts.
export const SHAPE_KINDS = new Set<string>([
  'square',
  'circle',
  'diamond',
  'cylinder',
  'parallelogram',
  'hexagon',
  'document',
  // Document element (docs/specs/009-elements/page-element.md): a paper-proportioned page you write
  // prose into. Named 'page' internally because the flowchart output symbol
  // above already owns 'document'.
  'page',
  // Lane (docs/specs/009-elements/lane.md).
  'lane',
  // The web components (docs/specs/009-elements/web-components-and-no-groups.md).
  'banner',
  'callout',
  'card',
  'badge',
  'step',
  'pointer-note',
  'diagram-key',
  'stack',
  'boundary',
  'stat-row',
  'process',
  'site-header',
  // Mode button (docs/specs/009-elements/mode-button.md): a pressable pill that switches whoever clicks it
  // into a selection mode.
  'mode-button',
  // Portal (docs/specs/009-elements/portal-element.md): a portal to the portal it is paired with.
  'portal',
  // Chair (docs/specs/009-elements/chair.md): an Avatar-mode character sits down in one.
  'chair',
  // Fence (docs/specs/009-elements/fence.md): Avatar-mode characters cannot walk through one.
  'fence',
  // Avatar Pad (docs/specs/009-elements/avatar-pad.md): where Avatar-mode characters start.
  'avatar-pad',
  // Desk and sofa (docs/specs/009-elements/chair.md "Desk and sofa").
  'desk',
  'sofa',
  // The virtual office (docs/specs/009-elements/office.md).
  'room',
  'meeting-table',
  'plant',
  'bookshelf',
  'water-cooler',
  'coffee-machine',
  'rug',
  'stage',
  // The Office Pod, the bar and the garden (docs/specs/009-elements/office.md "Office Pod" to "Garden Fence").
  'office-pod',
  'bar',
  'bar-stool',
  'drinks-cabinet',
  'drinks-fridge',
  'outdoor-plant',
  'tree',
  'garden-path',
  'grass',
  'garden-fence',
  // The social pieces (docs/specs/009-elements/social-pieces.md).
  'notice-board',
  'world-clock',
  'jukebox',
  'ping-pong-table',
  'arcade-machine',
  'fireplace',
  'campfire',
  'bench',
  'picnic-table',
  'hammock',
  'garden-umbrella',
  'fountain',
  'pond',
  // The social pieces' second set (docs/specs/009-elements/social-pieces.md).
  'pool-table',
  'foosball-table',
  'dartboard',
  'vending-machine',
  'bean-bag',
  'reading-nook',
  // Door (docs/specs/009-elements/room-builder.md "Door").
  'door',
  // Wayfinding (docs/specs/009-elements/directory.md, elevator.md).
  'directory',
  'elevator',
  // The meeting pieces (docs/specs/009-elements/screen-and-room-sign.md).
  'screen',
  'room-sign',
  // The Timer and Stopwatch (docs/specs/009-elements/timer-and-stopwatch.md).
  'timer',
  'stopwatch',
  'stadium',
  'actor',
  'final-state',
  'cloud',
  'triangle',
  'trapezoid',
  'star',
  'speech-bubble',
  'progress-bar',
  'progress-ring',
  'timeline-rail',
  'rating',
  'pie-chart',
  'bar-chart',
  'line-chart',
  'code-block',
  'checklist',
  'legend',
  'focus-button',
  'icon',
  'sticker',
]);
