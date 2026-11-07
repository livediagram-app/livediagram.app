// The self-drawing shape family: kind predicates and bounds shared by the renderers and the menus, split out of
// index.ts as a LEAF module (it imports only types) because factories.ts needs these at module-init time; importing
// them from './index' put a runtime read inside the index <-> factories cycle, which crashes plain-Node ESM consumers.
// Everything here is re-exported from './index', so the public package surface is unchanged. The data widgets that
// lived here (progress, rating, the charts, the code block, the checklist, the legend) left livehuddle's element
// engine (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine"); a stored one is a retired element.

import type { ShapeKind } from './index';

// The Timeline (docs/specs/009-elements/timeline.md); it keeps the rail's kind, so every saved one opens.
export function isRailShape(kind: ShapeKind): boolean {
  return kind === 'timeline-rail';
}

// A card's, a callout's and a boundary's heading lines (docs/specs/009-elements/card.md). A title line, not a
// paragraph: the renderer clamps it to one line anyway, so anything longer is a paste accident.
export const PAGE_HEADING_MAX = 200;

// The "self-drawing" shape kinds: the timeline, the sticker and the Space pieces. They render their own bespoke
// content (no fill/border box) and carry no editable text label, so the editor suppresses markers, text alignment,
// the inline label editor, morphing, and double-click / type-to-edit for them.
//
// The sticker (docs/specs/010-palette/stickers.md) is here for the label half specifically: it says what
// it says in its own artwork, so there is nothing to type into it.
export function isSelfDrawingShape(kind: ShapeKind): boolean {
  return (
    isRailShape(kind) ||
    kind === 'sticker' ||
    // A fence (docs/specs/009-elements/fence.md) is posts and rails, with nothing to write on.
    kind === 'fence' ||
    // An Avatar Pad (docs/specs/009-elements/avatar-pad.md) is pixels, with nothing to write on.
    kind === 'avatar-pad' ||
    // The office's scenery and machines (docs/specs/009-elements/office.md) have nothing to write on; a room
    // keeps its label (its name plate) and a meeting table and the furniture theirs (under them).
    kind === 'plant' ||
    kind === 'bookshelf' ||
    kind === 'water-cooler' ||
    kind === 'coffee-machine' ||
    kind === 'rug' ||
    // A corridor (docs/specs/009-elements/corridor.md) is floor and walls, with nothing to write on.
    kind === 'corridor' ||
    // The bar and the garden (office.md): scenery and machines likewise; a pod and a stool keep theirs.
    kind === 'bar' ||
    kind === 'drinks-cabinet' ||
    kind === 'drinks-fridge' ||
    kind === 'outdoor-plant' ||
    kind === 'tree' ||
    kind === 'garden-path' ||
    kind === 'grass' ||
    kind === 'garden-fence' ||
    // The social pieces (docs/specs/009-elements/social-pieces.md) have nothing to write on.
    kind === 'notice-board' ||
    kind === 'world-clock' ||
    kind === 'jukebox' ||
    kind === 'ping-pong-table' ||
    kind === 'arcade-machine' ||
    kind === 'fireplace' ||
    kind === 'campfire' ||
    kind === 'bench' ||
    kind === 'picnic-table' ||
    kind === 'hammock' ||
    kind === 'garden-umbrella' ||
    kind === 'fountain' ||
    kind === 'pond' ||
    kind === 'pool-table' ||
    kind === 'foosball-table' ||
    kind === 'dartboard' ||
    kind === 'vending-machine' ||
    kind === 'bean-bag' ||
    kind === 'reading-nook' ||
    kind === 'printer' ||
    kind === 'copier' ||
    kind === 'lockers' ||
    kind === 'coat-rack' ||
    kind === 'umbrella-stand' ||
    kind === 'kitchen-counter' ||
    kind === 'kitchen-sink' ||
    kind === 'fridge' ||
    kind === 'microwave' ||
    kind === 'kettle' ||
    kind === 'toilet-cubicle' ||
    kind === 'washbasin' ||
    kind === 'hand-dryer' ||
    kind === 'pillar' ||
    kind === 'column' ||
    kind === 'car-park' ||
    kind === 'bike-rack' ||
    kind === 'swimming-pool' ||
    kind === 'stage-curtains' ||
    kind === 'podium' ||
    kind === 'nap-pod' ||
    kind === 'treadmill' ||
    kind === 'weight-bench' ||
    kind === 'phone-booth' ||
    kind === 'standing-desk' ||
    kind === 'hot-desk' ||
    kind === 'pet-bed' ||
    kind === 'reception-desk' ||
    // The team pieces (docs/specs/009-elements/team-pieces.md).
    kind === 'calendar-wall' ||
    kind === 'suggestion-box' ||
    kind === 'signpost' ||
    kind === 'photo-wall' ||
    // A door (docs/specs/009-elements/room-builder.md) is a doorway, with nothing to write on.
    kind === 'door' ||
    // A window (room-builder.md "Window") is glass in a wall.
    kind === 'window' ||
    // The Directory (docs/specs/009-elements/directory.md) draws its own words; an Elevator keeps its name.
    kind === 'directory' ||
    // Stairs (docs/specs/009-elements/stairs.md) carry no name.
    kind === 'stairs' ||
    // The Screen and the Room Sign (docs/specs/009-elements/screen-and-room-sign.md): a sign's name is its room's.
    kind === 'screen' ||
    kind === 'room-sign' ||
    // The Timer and Stopwatch (docs/specs/009-elements/timer-and-stopwatch.md) draw their own time.
    kind === 'timer' ||
    kind === 'stopwatch'
  );
}

// The five reactions a walking character throws (docs/specs/008-canvas/avatar-mode.md "Reactions"), their names and
// glyphs, are @liveworkspace/avatar's.
export * from '@liveworkspace/avatar/reaction-bursts';
