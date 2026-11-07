// The shape vocabulary: every kind a shape element can be, from the basic
// geometry through the flowchart symbols, the UML set and the self-drawing data
// shapes.
//
// Split out of index.ts the same way element-types.ts and arrow-types.ts were,
// and it is the easiest of the three to justify: one union, ~100 members, and
// it references nothing else in the package and nothing else references it by
// anything other than name. A closed vocabulary that only ever grows is
// exactly the kind of thing that should not sit in the middle of the file
// holding the package's public surface.
//
// Pure types; re-exported through index.ts so the public
// `@livehuddle/document` surface is unchanged.

export type ShapeKind =
  | 'square'
  | 'circle'
  | 'diamond'
  | 'cylinder'
  | 'parallelogram'
  | 'hexagon'
  | 'document'
  // Document element (docs/specs/009-elements/page-element.md). Named 'page' because 'document' above is
  // the flowchart output symbol.
  | 'page'
  // Lane (docs/specs/009-elements/lane.md): a titled horizontal band that carries its contents.
  | 'lane'
  // The web components (docs/specs/009-elements/web-components-and-no-groups.md): single elements that lay themselves out,
  // replacing the grouped composites the Components palette used to build.
  // Banner: an accent bar, title (the label) over a subtitle line.
  | 'banner'
  // Callout: a card with an accent badge, a heading line and a body (label).
  | 'callout'
  // Card (docs/specs/009-elements/card.md): a diagram node with slots (header band, media, title, meta line,
  // body, tags). The Callout is its preset; a stored `callout` migrates to one on read.
  | 'card'
  // Badge and Step number (docs/specs/009-elements/badge.md, step-number.md): small marks that may attach to a
  // point on a host element (`attachedTo` / `attachAt`) and travel with it.
  | 'badge'
  | 'step'
  // Pointer note (docs/specs/009-elements/pointer-note.md): a note with a leader to a tip that may attach to a point.
  | 'pointer-note'
  // Diagram key (docs/specs/009-elements/diagram-key.md): a legend of the tab's line patterns and tag colours.
  | 'diagram-key'
  // Stack (docs/specs/009-elements/stack.md): a container that lays out what it holds in a row, column or grid.
  | 'stack'
  // Boundary (docs/specs/009-elements/boundary.md): a titled, tinted container (a region, a VPC, a C4 system).
  | 'boundary'
  // Stat row: KPI cards, a big value over a caption each, in `stats`.
  | 'stat-row'
  // Process steps: numbered circles joined by arrows, captions in
  // `processSteps`.
  | 'process'
  // Header: a website header bar, logo + brand (the label) + `navLinks`.
  | 'site-header'
  // Mode button (docs/specs/009-elements/mode-button.md): a pressable pill that switches whoever clicks it
  // into a selection mode — Avatar by default. Which mode lives in the
  // element's `mode` field.
  | 'mode-button'
  // Portal (docs/specs/009-elements/portal-element.md): a portal. Clicking one — or walking an Avatar-mode
  // character into it — takes you to the portal it is paired with, in
  // `portalTarget`.
  | 'portal'
  // Chair (docs/specs/009-elements/chair.md): furniture an Avatar-mode character sits down in when it
  // walks into one. Which way the seat points lives in `chairFacing`.
  | 'chair'
  // Fence (docs/specs/009-elements/fence.md): one straight run of posts and rails an Avatar-mode
  // character cannot walk through. The run lies along the longer side; no fields of its own.
  | 'fence'
  // Avatar Pad (docs/specs/009-elements/avatar-pad.md): where Avatar-mode characters start. A pixel teleport platform
  // drawn in the sprite's palette; no fields of its own.
  | 'avatar-pad'
  // Desk and sofa (docs/specs/009-elements/chair.md "Desk and sofa"): seating like the chair, with
  // the chair's `chairFacing`. A desk seats one at a computer; a sofa seats two side by side.
  | 'desk'
  | 'sofa'
  // The virtual office (docs/specs/009-elements/office.md): a room (walls, a doorway, `roomDoor`), a meeting table
  // with six seats, scenery that blocks (plant, bookshelf), machines that give a character a drink (water
  // cooler, coffee machine), a rug on the floor, and a stage whoever stands on is heard by the whole tab
  // (docs/specs/012-collaboration/meeting-rooms-and-stage.md "The stage").
  | 'room'
  // A Corridor (docs/specs/009-elements/corridor.md): a passage between rooms, its type in `variant`.
  | 'corridor'
  | 'meeting-table'
  | 'plant'
  | 'bookshelf'
  | 'water-cooler'
  | 'coffee-machine'
  | 'rug'
  | 'stage'
  // The Office Pod, the bar and the garden (docs/specs/009-elements/office.md "Office Pod" to "Garden Fence").
  | 'office-pod'
  | 'bar'
  | 'bar-stool'
  | 'drinks-cabinet'
  | 'drinks-fridge'
  | 'outdoor-plant'
  | 'tree'
  | 'garden-path'
  | 'grass'
  | 'garden-fence'
  // The social pieces (docs/specs/009-elements/social-pieces.md).
  | 'notice-board'
  | 'world-clock'
  | 'jukebox'
  | 'ping-pong-table'
  | 'arcade-machine'
  | 'fireplace'
  | 'campfire'
  | 'bench'
  | 'picnic-table'
  | 'hammock'
  | 'garden-umbrella'
  | 'fountain'
  | 'pond'
  // The social pieces' second set (docs/specs/009-elements/social-pieces.md).
  | 'pool-table'
  | 'foosball-table'
  | 'dartboard'
  | 'vending-machine'
  | 'bean-bag'
  | 'reading-nook'
  // The office amenities (docs/specs/009-elements/office-amenities.md).
  | 'printer'
  | 'copier'
  | 'lockers'
  | 'coat-rack'
  | 'umbrella-stand'
  | 'kitchen-counter'
  | 'kitchen-sink'
  | 'fridge'
  | 'microwave'
  | 'kettle'
  | 'toilet-cubicle'
  | 'washbasin'
  | 'hand-dryer'
  // The venue pieces (docs/specs/009-elements/venue-pieces.md).
  | 'pillar'
  | 'column'
  | 'car-park'
  | 'bike-rack'
  | 'swimming-pool'
  | 'stage-curtains'
  | 'podium'
  // The workday pieces (docs/specs/009-elements/workday-pieces.md).
  | 'nap-pod'
  | 'treadmill'
  | 'weight-bench'
  | 'phone-booth'
  | 'standing-desk'
  | 'hot-desk'
  | 'pet-bed'
  | 'reception-desk'
  // The team pieces (docs/specs/009-elements/team-pieces.md).
  | 'calendar-wall'
  | 'suggestion-box'
  | 'signpost'
  | 'photo-wall'
  // A Door (docs/specs/009-elements/room-builder.md "Door"): a doorway that snaps onto any room wall and cuts it.
  | 'door'
  // Wayfinding (docs/specs/009-elements/directory.md, elevator.md): a stand listing the space's rooms and who is in
  // each, and a lift between the space's tabs (its floors).
  | 'directory'
  | 'elevator'
  // The meeting pieces (docs/specs/009-elements/screen-and-room-sign.md): a wall screen showing a share from someone in
  // its room, and a sign by a room's door saying whether it is free.
  | 'screen'
  | 'room-sign'
  // The Timer and Stopwatch (docs/specs/009-elements/timer-and-stopwatch.md): a meeting room's clock, counting down or up.
  | 'timer'
  | 'stopwatch'
  | 'stadium'
  | 'actor'
  // UML final state (docs/specs/008-canvas/canvas-and-palette.md "UML"): a ring around a solid dot, one element, so the
  // bullseye moves, pins and lints as one stop.
  | 'final-state'
  | 'cloud'
  | 'triangle'
  | 'trapezoid'
  | 'star'
  // Speech bubble / callout: a rounded body with a tail at the bottom-left.
  | 'speech-bubble'
  // Progress elements (docs/specs/009-elements/progress.md): a horizontal bar + a donut ring that show a
  // 0–100 percentage. They carry `progress` / `progressAnim` (below).
  | 'progress-bar'
  | 'progress-ring'
  // The Timeline (docs/specs/009-elements/timeline.md): milestones along a spine.
  | 'timeline-rail'
  // Rating (docs/specs/009-elements/rating.md): a row of five stars showing a 1–5 score. Carries
  // `rating` / `ratingAnim` (below).
  | 'rating'
  // Pie + bar charts (docs/specs/009-elements/pie-chart.md): data charts sized by value. Share `pieSlices` /
  // `pieAnim` / `chartLegend` (below). The "Data" component family.
  | 'pie-chart'
  | 'bar-chart'
  // Line chart (docs/specs/009-elements/pie-chart.md): a 2-D chart with `lineCategories` + `lineSeries`
  // (CSV-importable). Shares `pieAnim` / `chartLegend`.
  | 'line-chart'
  // Code block (docs/specs/009-elements/code-block.md): a monospace snippet card. Carries `code` +
  // `codeLanguage` (below); keeps a fixed dark identity regardless of theme.
  | 'code-block'
  // Checklist (docs/specs/009-elements/checklist.md): checkable to-do rows. Carries `checklistItems`
  // (below); boxes toggle on-canvas like the rating's stars.
  | 'checklist'
  // Legend (docs/specs/009-elements/pie-chart.md): a card of colour-coded rows (a swatch + a label), the
  // key you put beside a chart or a colour-coded board.
  | 'legend'
  // Bring Focus (docs/specs/012-collaboration/bring-focus.md): press it and everyone else in the room is offered
  // a jump to it, on your tab.
  | 'focus-button'
  // Curated single-colour glyph from the icon catalogue. Which glyph
  // is carried by `iconId` (a registry key resolved in the editor app's
  // icon catalogue, NOT a closed enum here, so adding icons is a
  // one-file change with no model migration). Tinted by `strokeColor`
  // like a line drawing; keeps aspect ratio when resized. See docs/specs/008-canvas/canvas-and-palette.md
  // "Icons" accordion.
  | 'icon'
  // Sticker (docs/specs/010-palette/stickers.md): a die-cut colour sticker you slap on the canvas — a
  // colour emoji, or a word badge like APPROVED / BLOCKED. Which one is
  // carried by `stickerId` (a catalogue key, not a closed enum here, same as
  // `iconId`). Deliberately NOT an icon: it paints its own plate + shadow,
  // is never tinted by the theme, carries no caption, and never folds into
  // another shape as an inline glyph.
  | 'sticker';
