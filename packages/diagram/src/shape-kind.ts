// The shape vocabulary: every kind a shape element can be, from the basic
// geometry through the flowchart set, the UML set, the device frames and the
// self-drawing data shapes.
//
// Split out of index.ts the same way element-types.ts and arrow-types.ts were,
// and it is the easiest of the three to justify: one union, ~100 members, and
// it references nothing else in the package and nothing else references it by
// anything other than name. A closed vocabulary that only ever grows is
// exactly the kind of thing that should not sit in the middle of the file
// holding the package's public surface.
//
// Pure types; re-exported through index.ts so the public
// `@livediagram/diagram` surface is unchanged.

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
  // Mind node (docs/specs/009-elements/mind-node.md): a labelled node that knows its parent, grown from
  // the keyboard with Tab (child) and Enter (sibling).
  | 'mind-node'
  // Lane (docs/specs/009-elements/lane.md): a titled horizontal band that carries its contents.
  | 'lane'
  // Record (docs/specs/009-elements/entity.md): a UML class / ER entity box — a title over rows.
  | 'entity'
  // The web components (docs/specs/009-elements/web-components-and-no-groups.md): single elements that lay themselves out,
  // replacing the grouped composites the Components palette used to build.
  // Banner: an accent bar, title (the label) over a subtitle line.
  | 'banner'
  // Callout: a card with an accent badge, a heading line and a body (label).
  | 'callout'
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
  // Session button (docs/specs/012-collaboration/session-button.md): pressing it starts a session tool for the room
  // — a timer, a dot vote, or a live poll. Which one lives in `session`.
  | 'session-button'
  // Reveal zone (docs/specs/009-elements/reveal-zone.md): a cover over part of the canvas. Click it to
  // uncover it for yourself; `revealed` uncovers it for everyone.
  | 'reveal'
  // Picker (docs/specs/012-collaboration/picker.md): press it to choose a person or an option at random.
  | 'picker'
  // Reaction pad (docs/specs/009-elements/reaction-pad.md): press it, or walk an Avatar-mode character onto
  // it, and a burst of reaction plays over the pad. Which reaction lives in
  // the element's `reaction` field.
  | 'reaction-pad'
  // Comment pin (docs/specs/012-collaboration/comment-pin.md): a standalone marker whose whole job is to carry a
  // comment thread. Every element can already hold one; this one exists ONLY
  // to hold one, so a remark can be pinned to a spot on the board rather than
  // to whichever shape happens to be nearest.
  | 'comment-pin'
  // Action panel (docs/specs/012-collaboration/action-panel.md): the Comment panel's sibling for assigned
  // actions. A card whose whole job is to carry ONE `action` (docs/specs/012-collaboration/assigned-actions.md) and
  // show it on the board, so a follow-up can live where the room can read it.
  | 'action-card'
  // Done check (docs/specs/012-collaboration/done-check.md): everyone marks themselves finished, and the card
  // shows who has and who has not. Live: the not-yet list is read from who is
  // actually in the room, so it shrinks as people leave rather than accusing
  // somebody who went home.
  | 'done-check'
  // Chair (docs/specs/009-elements/chair.md): furniture an Avatar-mode character sits down in when it
  // walks into one. Which way the seat points lives in `chairFacing`.
  | 'chair'
  // The collaboration family — elements that record what the ROOM thinks
  // rather than what one author drew.
  //
  // Estimate card (docs/specs/012-collaboration/estimate-card.md): planning poker. Everyone picks privately from
  // `estimateScale`, and `responsesRevealed` shows every answer at once.
  | 'estimate'
  // Temperature check (docs/specs/012-collaboration/temperature-check.md): a fist-of-five gauge. Same `responses`
  // primitive, deliberately never hidden.
  | 'temperature'
  // Idea box (docs/specs/012-collaboration/idea-box.md): anonymous submissions in `ideaCards`, held until
  // `ideasRevealed`. There is nowhere to put an author, on purpose.
  | 'idea-box'
  // Q&A board (docs/specs/012-collaboration/qa-board.md): a self-sorting list of upvotable notes in
  // `qaNotes`, owned by the server so view links can add and vote.
  | 'qa-board'
  // Agenda (docs/specs/012-collaboration/agenda.md): ordered `agendaItems` with minutes; pressing one starts
  // the tab timer and sets `agendaCurrent`.
  | 'agenda'
  // Decision record (docs/specs/012-collaboration/decision-record.md): the statement (the label) plus a status chip,
  // a date and the drivers.
  | 'decision'
  // Roll call (docs/specs/012-collaboration/roll-call.md): a frozen snapshot of who was in the room, in
  // `rollCall`.
  | 'roll-call'
  | 'stadium'
  | 'actor'
  | 'cloud'
  | 'triangle'
  | 'trapezoid'
  | 'star'
  // Speech bubble / callout: a rounded body with a tail at the bottom-left.
  | 'speech-bubble'
  // Frame / section: a transparent outlined container with its label in the
  // top-left, drawn around a cluster of elements. See docs/specs/008-canvas/canvas-and-palette.md.
  | 'frame'
  // UI device frames (wireframing). See docs/specs/008-canvas/canvas-and-palette.md "Devices" accordion.
  | 'browser'
  | 'monitor'
  | 'laptop'
  | 'phone'
  | 'tablet'
  // A book-style foldable phone, shown OPEN on its inner screen: a
  // near-square panel with the hinge crease down the middle. Folded it is
  // just `phone`, so only the unfolded state earns its own frame.
  | 'foldable'
  | 'smartwatch'
  // Progress elements (docs/specs/009-elements/progress.md): a horizontal bar + a donut ring that show a
  // 0–100 percentage. They carry `progress` / `progressAnim` (below).
  | 'progress-bar'
  | 'progress-ring'
  // Timeline rail (docs/specs/009-elements/timeline-rail.md): a horizontal line with evenly-spaced points above
  // it. Carries `railCount` (below); a canvas affordance adds points at the
  // right end. The first of a family of composite "rail" components.
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
  // a jump to it, at your zoom, on your tab.
  | 'focus-button'
  // Curated single-colour glyph from the icon catalogue. Which glyph
  // is carried by `iconId` (a registry key resolved in the live app's
  // icon catalogue, NOT a closed enum here, so adding icons is a
  // one-file change with no model migration). Tinted by `strokeColor`
  // like a line drawing; keeps aspect ratio when resized. See docs/specs/008-canvas/canvas-and-palette.md
  // "Icons" accordion.
  | 'icon'
  // Sticker (docs/specs/010-palette/stickers.md): a die-cut colour sticker you slap on the board — a
  // colour emoji, or a word badge like APPROVED / BLOCKED. Which one is
  // carried by `stickerId` (a catalogue key, not a closed enum here, same as
  // `iconId`). Deliberately NOT an icon: it paints its own plate + shadow,
  // is never tinted by the theme, carries no caption, and never folds into
  // another shape as an inline glyph.
  | 'sticker';
